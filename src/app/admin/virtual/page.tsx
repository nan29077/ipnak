import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AdminTitle } from "@/components/admin/ui";
import { VirtualMemberPanel } from "@/components/admin/VirtualMemberPanel";
import { getAiConnectionStatus } from "@/lib/aiCredentials";
import { getVirtualActivityConfig, kstDateKey, remainingQuota } from "@/lib/virtualActivity";
import {
  personalityLabel, regionGroupLabel, VIRTUAL_MEMBER_TOTAL,
} from "@/lib/virtualMembers";
import { virtualMembersActive } from "@/lib/virtualVisibility";

export const dynamic = "force-dynamic";

export default async function AdminVirtualMembersPage() {
  // admin/layout.tsx 에도 권한 검사가 있지만, 레이아웃의 redirect 가 하위 페이지 렌더를 막지 못해
  // 스트리밍 페이로드로 데이터가 나가는 것을 방지하기 위해 페이지에서도 직접 확인한다.
  const viewer = await getCurrentUser();
  if (!viewer || viewer.role !== "SUPER_ADMIN") redirect("/login");

  const [config, ai, active] = await Promise.all([
    getVirtualActivityConfig(),
    getAiConnectionStatus(),
    virtualMembersActive(),
  ]);

  const [members, activityTotal, remaining] = await Promise.all([
    prisma.virtualMember.findMany({
      include: { user: { select: { id: true, nickname: true, region: true, bio: true, avatarUrl: true } } },
      orderBy: [{ lastActiveAt: "desc" }, { createdAt: "asc" }],
    }),
    prisma.virtualActivity.count(),
    remainingQuota(config),
  ]);

  // 생성된 글 목록 — 피드·조행기·워킹·중고마켓 등 콘텐츠 활동만 (댓글·좋아요 제외)
  // 종류별 필터를 프론트에서 처리하므로, 특정 종류가 빠지지 않을 만큼 넉넉히 불러온다.
  // (100건만 받으면 최신 구간에 없는 종류가 0건으로 보여 필터가 고장난 것처럼 읽힌다.)
  const CONTENT_KINDS = ["FEED", "GENERAL", "LOG", "WALKING", "MARKET"];
  const [contentActivities, contentTotal] = await Promise.all([
    prisma.virtualActivity.findMany({
      where: { kind: { in: CONTENT_KINDS } },
      include: { member: { include: { user: { select: { nickname: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.virtualActivity.count({ where: { kind: { in: CONTENT_KINDS } } }),
  ]);

  return (
    <div>
      <AdminTitle
        title="가상회원 관리"
        desc={`AI 가상회원 ${members.length}/${VIRTUAL_MEMBER_TOTAL}명 · 누적 활동 ${activityTotal.toLocaleString()}건`}
      />
      <VirtualMemberPanel
        openaiConfigured={ai.openaiConfigured}
        config={{
          active,
          enabled: config.enabled,
          intervalHours: config.intervalHours,
          dailyLimit: config.dailyLimit,
          model: config.model,
          lastRun: config.lastRun,
        }}
        usage={{ usedToday: config.usageDate === kstDateKey() ? config.usageCount : 0, remainingToday: remaining }}
        members={members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          nickname: m.user.nickname,
          region: m.user.region ?? "",
          regionGroupLabel: regionGroupLabel(m.regionGroup),
          personality: m.personality,
          personalityLabel: personalityLabel(m.personality),
          bio: m.user.bio ?? "",
          avatarUrl: m.user.avatarUrl,
          active: m.active,
          activityCount: m.activityCount,
          lastActiveAt: m.lastActiveAt ? m.lastActiveAt.toISOString() : null,
        }))}
        contentTotal={contentTotal}
        contents={contentActivities.map((a) => ({
          id: a.id,
          kind: a.kind,
          targetType: a.targetType,
          targetId: a.targetId,
          summary: a.summary ?? "",
          nickname: a.member.user.nickname,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
