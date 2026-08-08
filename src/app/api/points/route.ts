export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blurCoord } from "@/lib/utils";

export async function GET() {
  const points = await prisma.fishingPoint.findMany({
    where: { visibility: { not: "PRIVATE" } },
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
      posts: { select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const data = points.map((p) => {
    const b = blurCoord(p.lat, p.lng, p.visibility);
    return {
      id: p.id, lat: b.lat, lng: b.lng, blurRadius: b.radius,
      speciesName: p.speciesName, sizeCm: p.sizeCm, photoUrl: p.photoUrl,
      gearSetup: p.gearSetup, region: p.region, visibility: p.visibility,
      tripId: p.tripId,
      createdAt: p.createdAt.toISOString(),
      user: p.user, postId: p.posts[0]?.id ?? null,
    };
  });
  return NextResponse.json({ points: data });
}
