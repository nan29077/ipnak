/**
 * 입낚볼 히스토리 API
 * - GET /api/balls/[ballId]/history : 이 볼로 기록된 캐치 기록 + 측정 데이터 목록
 *
 * 주의: 스키마 변경분(CatchRecord.ballId)이 아직 prisma generate 에 반영되지 않아
 * prisma.$queryRaw (raw SQL) 로만 접근한다. (prisma db push 필요)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CatchRow = {
  id: string;
  speciesName: string;
  categoryPath: string | null;
  sizeCm: number | null;
  measuredLengthCm: number | null;
  calibrationLengthCm: number | null;
  confidence: number | null;
  photoUrl: string | null;
  originalImageUrl: string | null;
  measuredImageUrl: string | null;
  createdAt: Date | string;
};

export async function GET(
  _req: Request,
  { params }: { params: { ballId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const ballId = decodeURIComponent(params.ballId || "").trim();
    if (!ballId) {
      return NextResponse.json({ error: "ballId 가 필요합니다." }, { status: 400 });
    }

    const records = await prisma.$queryRaw<CatchRow[]>`
      SELECT
        id, speciesName, categoryPath, sizeCm,
        measuredLengthCm, calibrationLengthCm, confidence,
        photoUrl, originalImageUrl, measuredImageUrl, createdAt
      FROM CatchRecord
      WHERE ballId = ${ballId} AND userId = ${user.id}
      ORDER BY createdAt DESC
    `;

    return NextResponse.json({ ballId, count: records.length, records });
  } catch {
    return NextResponse.json({ error: "볼 히스토리를 불러오지 못했어요." }, { status: 500 });
  }
}
