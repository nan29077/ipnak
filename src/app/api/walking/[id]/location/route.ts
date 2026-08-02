export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNearestWaterBody } from "@/lib/waterBodyLookup";

/**
 * GET /api/walking/[id]/location
 * 워킹 피드의 GPS 좌표 기반 수계명("영산강" 등)을 반환한다.
 *
 * - locationLabel 캐시가 있으면 즉시 반환 (Overpass API 재호출 없음)
 * - 없으면 Overpass API 조회 → DB 캐시 저장 → 반환
 * - 좌표가 없거나 조회 실패 시 { label: null } (UI 에서 표시 생략)
 *
 * 잠긴 워킹 피드도 조회 가능하다 — 노출되는 정보는 수계 이름뿐이고 좌표는 반환하지 않는다.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const post = await prisma.post.findFirst({
      where: { id: params.id, postType: "WALKING_FEED", hidden: false },
      select: { id: true, lat: true, lng: true, locationLabel: true },
    });
    if (!post) return NextResponse.json({ label: null }, { status: 404 });

    // 캐시 히트
    if (post.locationLabel) return NextResponse.json({ label: post.locationLabel });

    if (post.lat == null || post.lng == null) return NextResponse.json({ label: null });

    const label = await getNearestWaterBody(post.lat, post.lng);
    if (!label) return NextResponse.json({ label: null });

    // 캐시 저장 실패는 무시 — 라벨 자체는 반환한다
    try {
      await prisma.post.update({ where: { id: post.id }, data: { locationLabel: label } });
    } catch { /* noop */ }

    return NextResponse.json({ label });
  } catch {
    return NextResponse.json({ label: null });
  }
}
