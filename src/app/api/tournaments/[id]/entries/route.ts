import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  const t = await prisma.tournament.findUnique({ where: { id: params.id } });
  if (!t) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  try {
    const entry = await prisma.tournamentEntry.create({
      data: {
        tournamentId: t.id, userId: user.id, speciesName: b.speciesName || t.speciesName || "미상",
        sizeCm: Number(b.sizeCm) || 0, photoUrl: b.photoUrl || null, measuredImageUrl: b.measuredImageUrl || null,
        region: b.region || null, lat: num(b.lat), lng: num(b.lng), status: "REVIEW",
        originalImageUrl: b.originalImageUrl || null,
        calibrationStart: json(b.calibrationStart), calibrationEnd: json(b.calibrationEnd),
        calibrationLengthCm: num(b.calibrationLengthCm),
        fishHeadPoint: json(b.fishHeadPoint), fishTailPoint: json(b.fishTailPoint),
        measuredLengthCm: num(b.measuredLengthCm), confidence: num(b.confidence),
        tamperFlag: false,
      },
    });
    return NextResponse.json({ ok: true, id: entry.id });
  } catch {
    return NextResponse.json({ error: "참가 접수 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
