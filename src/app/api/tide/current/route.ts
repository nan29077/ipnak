export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getMarineSnapshot } from "@/lib/marineData";

/** TideService._getMoonPhase() 로직 그대로 — 라인 아이콘/텍스트 표기용 (이모지 미사용) */
function getMoonPhase(): string {
  const synodic = 29.53058867;
  const known = new Date("2000-01-06T18:14:00Z");
  const diff = (Date.now() - known.getTime()) / (1000 * 60 * 60 * 24);
  const idx = Math.floor((((diff % synodic) / synodic) * 8 + 0.5) % 8);
  return ["삭", "초승달", "상현달", "차오르는 달", "보름달", "기우는 달", "하현달", "그믐달"][idx];
}

const NULL_RESULT = { tidePhase: null, nextTideTime: null, nextTideKind: null, mulddae: null, moonPhase: null };

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");

  const moonPhase = getMoonPhase();

  const lat = latRaw !== null ? Number(latRaw) : NaN;
  const lng = lngRaw !== null ? Number(lngRaw) : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ...NULL_RESULT, moonPhase });
  }

  try {
    const snapshot = await getMarineSnapshot(lat, lng);
    return NextResponse.json({
      tidePhase: snapshot.tide?.phase ?? null,
      nextTideTime: snapshot.tide?.next?.label ?? null,
      nextTideKind: snapshot.tide?.next?.kind ?? null,
      mulddae: snapshot.tide?.mulddae ?? null,
      moonPhase,
    });
  } catch {
    return NextResponse.json({ ...NULL_RESULT, moonPhase });
  }
}
