export const dynamic = "force-dynamic"; // 프로덕션 빌드 시 정적 캐싱 방지 — 항상 최신 진행중 대회 반환
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tournaments — 진행중 대회 목록 (DiarySheet 대회 참가 버튼용)
export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { status: "ONGOING" },
      orderBy: { startAt: "asc" },
      include: { _count: { select: { entries: true } } },
    });
    return NextResponse.json(
      tournaments.map((t) => ({
        id: t.id, title: t.title, type: t.type, speciesName: t.speciesName,
        startDate: t.startAt?.toISOString() ?? null,
        endDate: t.endAt?.toISOString() ?? null,
        entryCount: t._count.entries,
      }))
    );
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}
