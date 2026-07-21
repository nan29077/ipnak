/**
 * 입낚볼 히스토리 API
 * - GET /api/balls/[ballId]/history : 이 볼로 기록된 캐치 기록 + 측정 데이터 목록
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

    const records = await prisma.catchRecord.findMany({
      where: { ballId, userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        speciesName: true,
        categoryPath: true,
        sizeCm: true,
        measuredLengthCm: true,
        calibrationLengthCm: true,
        confidence: true,
        photoUrl: true,
        originalImageUrl: true,
        measuredImageUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ballId, count: records.length, records });
  } catch {
    return NextResponse.json({ error: "볼 히스토리를 불러오지 못했어요." }, { status: 500 });
  }
}
