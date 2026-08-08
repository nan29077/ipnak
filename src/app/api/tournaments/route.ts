export const dynamic = "force-dynamic"; // 프로덕션 빌드 시 정적 캐싱 방지 — 항상 최신 진행중 대회 반환
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncTournamentStatuses } from "@/lib/tournamentStatus";

// GET /api/tournaments — 진행중 대회 목록 (DiarySheet 대회 참가 버튼용)
export async function GET() {
  try {
    await syncTournamentStatuses();
    const now = new Date();
    const tournaments = await prisma.tournament.findMany({
      // status 동기화가 실패해도 기간 조건으로 한 번 더 거른다
      where: { status: "ONGOING", startAt: { lte: now }, endAt: { gte: now } },
      orderBy: { startAt: "asc" },
      include: { _count: { select: { entries: true } } },
    });
    return NextResponse.json(
      tournaments.map((t) => ({
        id: t.id, title: t.title, type: t.type, speciesName: t.speciesName,
        startDate: t.startAt?.toISOString() ?? null,
        endDate: t.endAt?.toISOString() ?? null,
        entryCount: t._count.entries,
        entryFee: t.entryFee,
        reward1st: t.reward1st, reward2nd: t.reward2nd, reward3rd: t.reward3rd,
      }))
    );
  } catch (e) {
    // 빈 배열 200 으로 위장하면 클라이언트가 "진행중 대회 없음"으로 오인한다
    console.error("[api/tournaments]", e);
    return NextResponse.json({ error: "대회 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
