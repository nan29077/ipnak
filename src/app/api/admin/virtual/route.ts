import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getAiConnectionStatus } from "@/lib/aiCredentials";
import {
  clampDailyLimit, clampInterval, getVirtualActivityConfig,
  remainingQuota, runVirtualActivityCycle,
} from "@/lib/virtualActivity";
import { resetVirtualMembers, seedVirtualMembers } from "@/lib/virtualMemberSeed";
import { seedVirtualContent } from "@/lib/virtualSeedContent";
import { resetToSuperAdminOnly } from "@/lib/dataReset";

export const dynamic = "force-dynamic";

// 가상회원 관리 통합 API. 관리자 화면(가상회원 관리)에서만 호출한다.
// 액션: SEED / RESET / RUN_NOW / SET_ENABLED / SET_INTERVAL / SET_LIMIT
//       MEMBER_TOGGLE / CONTENT_DELETE / DATA_RESET

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function GET() {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return NextResponse.json({ error: "권한이 없습니다." }, { status: forbidden ? 403 : 401 });
  }

  const [config, ai, memberCount] = await Promise.all([
    getVirtualActivityConfig(),
    getAiConnectionStatus(),
    prisma.virtualMember.count(),
  ]);

  return NextResponse.json({
    config: {
      enabled: config.enabled,
      intervalHours: config.intervalHours,
      dailyLimit: config.dailyLimit,
      model: config.model,
      lastRun: config.lastRun,
    },
    openaiConfigured: ai.openaiConfigured,
    memberCount,
    usedToday: config.usageCount,
    remainingToday: await remainingQuota(config),
    actorId: user.id,
  });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return NextResponse.json({ error: "권한이 없습니다." }, { status: forbidden ? 403 : 401 });
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const log = (action: string, target?: string, detail?: string) =>
    prisma.adminLog.create({ data: { actorId: user.id, action, target, detail } }).catch(() => null);

  const setSetting = (key: string, value: string) =>
    prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });

  try {
    switch (b.type) {
      case "SEED": {
        const summary = await seedVirtualMembers();
        await log("VIRTUAL_SEED", "virtual_member", `created=${summary.created} updated=${summary.updated}`);
        return NextResponse.json({
          ok: true,
          message: `가상회원 ${summary.total}명 준비 완료 (신규 ${summary.created}명 · 갱신 ${summary.updated}명)`,
          summary,
        });
      }

      case "SEED_CONTENT": {
        // 초기 시드 콘텐츠 — 이미 콘텐츠가 있는 회원은 건너뛴다(중복 방지).
        const days = Math.max(7, Math.min(365, Number(b.days) || 60));
        const memberCount = await prisma.virtualMember.count();
        if (memberCount === 0) {
          return NextResponse.json({ error: "가상회원이 없습니다. 먼저 100명을 생성하세요." }, { status: 400 });
        }
        const s = await seedVirtualContent({ days });
        await log("VIRTUAL_SEED_CONTENT", "virtual_member", `members=${s.members} posts=${s.feed + s.general + s.log + s.walking} market=${s.market}`);
        if (s.members === 0) {
          return NextResponse.json({
            ok: true,
            message: `이미 콘텐츠가 있는 회원 ${s.skipped}명은 건너뛰었습니다. 새로 채울 회원이 없습니다.`,
            summary: s,
          });
        }
        return NextResponse.json({
          ok: true,
          message:
            `${s.members}명에게 최근 ${days}일치 활동을 생성했습니다 — ` +
            `조황 ${s.feed} · 일상 ${s.general} · 조행기 ${s.log} · 워킹 ${s.walking} · 중고 ${s.market} · 댓글 ${s.comments} · 좋아요 ${s.likes}` +
            (s.skipped > 0 ? ` (기존 콘텐츠 보유 ${s.skipped}명 건너뜀)` : ""),
          summary: s,
        });
      }

      case "RESET": {
        const summary = await resetVirtualMembers();
        await log("VIRTUAL_RESET", "virtual_member", `members=${summary.deletedMembers} posts=${summary.deletedPosts}`);
        return NextResponse.json({
          ok: true,
          message: `가상회원 ${summary.deletedMembers}명과 글 ${summary.deletedPosts}건 · 댓글 ${summary.deletedComments}건 · 중고글 ${summary.deletedMarketListings}건을 삭제했습니다.`,
          summary,
        });
      }

      case "DATA_RESET": {
        // 최고관리자와 최고관리자가 등록한 콘텐츠만 남기고 전체 초기화
        const summary = await resetToSuperAdminOnly();
        await log("DATA_RESET", "all", `users=${summary.deletedUsers} posts=${summary.deletedPosts}`);
        return NextResponse.json({
          ok: true,
          message: `회원 ${summary.deletedUsers}명 · 글 ${summary.deletedPosts}건 · 중고글 ${summary.deletedMarketListings}건 · 낚시단 ${summary.deletedGroups}개를 삭제했습니다. 최고관리자 ${summary.keptAdmins}개 계정과 등록 콘텐츠는 유지됩니다.`,
          summary,
        });
      }

      case "RUN_NOW": {
        const result = await runVirtualActivityCycle({ force: true });
        if (!result.ok) {
          const reasons: Record<string, string> = {
            "no-key": "OpenAI API 키가 등록되지 않았습니다.",
            "no-members": "가상회원이 없습니다. 먼저 100명을 생성하세요.",
            "quota-exhausted": "오늘의 일일 호출 한도를 모두 사용했습니다.",
            disabled: "가상회원 활동이 꺼져 있습니다.",
          };
          return NextResponse.json({ error: reasons[result.reason ?? ""] ?? "실행할 수 없습니다." }, { status: 400 });
        }
        await log("VIRTUAL_RUN_NOW", "virtual_member", `posts=${result.posts} comments=${result.comments} calls=${result.calls}`);
        return NextResponse.json({
          ok: true,
          message: `활동 생성 완료 — 글 ${result.posts}건 · 댓글 ${result.comments}건 · 좋아요 ${result.likes}건 (API 호출 ${result.calls}회, 오늘 잔여 ${result.remaining}회)`,
          result,
        });
      }

      case "SET_ENABLED": {
        const value = b.value === true || b.value === "true" ? "true" : "false";
        await setSetting("virtual_member_enabled", value);
        await log("VIRTUAL_SET_ENABLED", "virtual_member_enabled", value);
        return NextResponse.json({ ok: true, message: value === "true" ? "가상회원 활동을 켰습니다." : "가상회원 활동을 껐습니다." });
      }

      case "SET_INTERVAL": {
        const hours = clampInterval(Number(b.value));
        await setSetting("virtual_member_interval_hours", String(hours));
        await log("VIRTUAL_SET_INTERVAL", "virtual_member_interval_hours", String(hours));
        return NextResponse.json({ ok: true, message: `활동 주기를 ${hours}시간으로 설정했습니다.`, value: hours });
      }

      case "SET_LIMIT": {
        const limit = clampDailyLimit(Number(b.value));
        await setSetting("virtual_member_daily_limit", String(limit));
        await log("VIRTUAL_SET_LIMIT", "virtual_member_daily_limit", String(limit));
        return NextResponse.json({ ok: true, message: `일일 호출 한도를 ${limit}회로 설정했습니다.`, value: limit });
      }

      case "MEMBER_TOGGLE": {
        const id = String(b.id || "");
        const member = await prisma.virtualMember.findUnique({ where: { id }, select: { active: true } });
        if (!member) return NextResponse.json({ error: "가상회원을 찾을 수 없습니다." }, { status: 404 });
        await prisma.virtualMember.update({ where: { id }, data: { active: !member.active } });
        await log("VIRTUAL_MEMBER_TOGGLE", id, String(!member.active));
        return NextResponse.json({ ok: true, message: member.active ? "해당 회원의 활동을 중지했습니다." : "해당 회원의 활동을 재개했습니다." });
      }

      case "CONTENT_DELETE": {
        // 가상회원이 만든 콘텐츠 개별 삭제 (활동 이력도 함께 정리)
        const activityId = String(b.activityId || "");
        const activity = await prisma.virtualActivity.findUnique({ where: { id: activityId } });
        if (!activity) return NextResponse.json({ error: "활동 이력을 찾을 수 없습니다." }, { status: 404 });

        const targetId = activity.targetId;
        if (targetId) {
          if (activity.targetType === "POST") {
            await prisma.post.delete({ where: { id: targetId } }).catch(() => null);
          } else if (activity.targetType === "MARKET_LISTING") {
            await prisma.marketMessage.deleteMany({ where: { chat: { listingId: targetId } } });
            await prisma.marketChat.deleteMany({ where: { listingId: targetId } });
            await prisma.marketFavorite.deleteMany({ where: { listingId: targetId } });
            await prisma.marketImage.deleteMany({ where: { listingId: targetId } });
            await prisma.marketListing.delete({ where: { id: targetId } }).catch(() => null);
          } else if (activity.targetType === "COMMENT") {
            await prisma.comment.delete({ where: { id: targetId } }).catch(() => null);
          } else if (activity.targetType === "LIKE") {
            const member = await prisma.virtualMember.findUnique({ where: { id: activity.memberId }, select: { userId: true } });
            if (member) await prisma.like.deleteMany({ where: { postId: targetId, userId: member.userId } });
          }
        }
        await prisma.virtualActivity.delete({ where: { id: activityId } }).catch(() => null);
        await log("VIRTUAL_CONTENT_DELETE", targetId ?? activityId, activity.kind);
        return NextResponse.json({ ok: true, message: "삭제했습니다." });
      }

      default:
        return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
    }
  } catch (e) {
    console.error("[admin/virtual]", e);
    return NextResponse.json({ error: "처리 실패" }, { status: 500 });
  }
}
