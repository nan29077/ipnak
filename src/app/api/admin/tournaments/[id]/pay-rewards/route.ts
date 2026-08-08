import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { applyPoints } from "@/lib/points";
import { effectiveStatus } from "@/lib/tournamentStatus";

const RANK_LABEL = ["1위", "2위", "3위"] as const;

/**
 * POST /api/admin/tournaments/[id]/pay-rewards
 * 종료된 대회의 1/2/3위에게 보상 포인트를 지급한다. (SUPER_ADMIN 전용, 대회당 1회)
 * 순위는 APPROVED 엔트리 중 "1인 최고 기록" 기준 — 길이 내림차순, 동점이면 먼저 등록한 순.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 }); }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const t = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: {
      id: true, title: true, startAt: true, endAt: true, rewardPaid: true,
      reward1st: true, reward2nd: true, reward3rd: true,
    },
  });
  if (!t) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (t.rewardPaid) return NextResponse.json({ error: "이미 보상이 지급된 대회입니다." }, { status: 409 });

  // 진행 중에 지급하면 이후 기록으로 순위가 뒤집힌다 — 기간이 끝난 대회만 허용
  if (effectiveStatus(t) !== "ENDED") {
    return NextResponse.json({ error: "종료된 대회만 보상을 지급할 수 있습니다." }, { status: 400 });
  }

  const rewards = [t.reward1st ?? 0, t.reward2nd ?? 0, t.reward3rd ?? 0];
  if (rewards.every((r) => r <= 0)) {
    return NextResponse.json({ error: "지급할 보상이 설정되지 않은 대회입니다." }, { status: 400 });
  }

  // 1인 1기록(본인 최고 기록)으로 순위를 매긴다 — 여러 건 제출한 참가자의 상위권 독식 방지
  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId: t.id, status: "APPROVED" },
    select: { userId: true, sizeCm: true, createdAt: true },
  });
  const bestByUser = new Map<string, { userId: string; sizeCm: number; createdAt: Date }>();
  for (const e of entries) {
    const prev = bestByUser.get(e.userId);
    if (!prev || e.sizeCm > prev.sizeCm || (e.sizeCm === prev.sizeCm && e.createdAt < prev.createdAt)) {
      bestByUser.set(e.userId, e);
    }
  }
  const ranked = [...bestByUser.values()]
    .sort((a, b) => b.sizeCm - a.sizeCm || a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 3);
  if (ranked.length === 0) {
    return NextResponse.json({ error: "승인된 기록이 없어 지급할 수상자가 없습니다." }, { status: 400 });
  }

  const payouts = ranked
    .map((e, i) => ({ rank: i + 1, userId: e.userId, sizeCm: e.sizeCm, amount: rewards[i] }))
    .filter((p) => p.amount > 0);
  if (payouts.length === 0) {
    return NextResponse.json({ error: "수상자에게 지급할 보상이 설정되지 않았습니다." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // rewardPaid 를 먼저 잠근다 — 동시에 두 번 눌러도 한 번만 지급된다
      const locked = await tx.tournament.updateMany({
        where: { id: t.id, rewardPaid: false },
        data: { rewardPaid: true },
      });
      if (locked.count === 0) throw new Error("ALREADY_PAID");
      for (const p of payouts) {
        await applyPoints(
          tx, p.userId, p.amount, "ADMIN",
          `${t.title} ${RANK_LABEL[p.rank - 1]} 보상`,
        );
      }
    });
  } catch (e: any) {
    if (e?.message === "ALREADY_PAID") {
      return NextResponse.json({ error: "이미 보상이 지급된 대회입니다." }, { status: 409 });
    }
    // 지급 대상 회원이 탈퇴한 경우 등 — 전체 롤백되므로 rewardPaid 도 false 로 남는다
    console.error("[admin/tournaments/pay-rewards]", e);
    return NextResponse.json({ error: "보상 지급 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  await prisma.adminLog.create({
    data: {
      actorId: user.id,
      action: "TOURNAMENT_PAY_REWARDS",
      target: t.id,
      detail: `${t.title} — ${payouts.map((p) => `${RANK_LABEL[p.rank - 1]} ${p.amount}P`).join(", ")}`,
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    paid: payouts.map((p) => ({ rank: p.rank, userId: p.userId, amount: p.amount })),
    total: payouts.reduce((s, p) => s + p.amount, 0),
  });
}
