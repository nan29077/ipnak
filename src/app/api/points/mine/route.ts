export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// GET: 현재 로그인 유저의 모든 피싱 포인트 (지도 마커용 — 비공개 포함)
export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ points: [] }); }

  const points = await prisma.fishingPoint.findMany({
    where: { userId: user.id },
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
      posts: { select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    points: points.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      blurRadius: 0,
      speciesName: p.speciesName,
      sizeCm: p.sizeCm,
      photoUrl: p.photoUrl,
      gearSetup: p.gearSetup,
      region: p.region,
      visibility: p.visibility,
      tripId: p.tripId,
      createdAt: p.createdAt.toISOString(),
      user: p.user,
      postId: p.posts[0]?.id ?? null,
      isMine: true,
    })),
  });
}
