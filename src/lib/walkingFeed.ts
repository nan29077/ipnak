import "server-only";
import { prisma } from "@/lib/prisma";

// 스마트피싱(Trip) 기록 종료 시 워킹 피드 글을 자동 생성한다.
// 글 형식은 기존 수동 게시(RecordingProvider.postToFeed)와 동일하게 맞춘다.
//   kind: "WALKING" / postType: "WALKING_FEED"
//   body: 동선·통계 JSON (FeedCard / WalkingFeedPage 에서 파싱해 지도·거리 렌더링)

function km(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`;
}

function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

/**
 * 종료된 Trip 하나에 대한 워킹 피드 글을 생성한다.
 * - 이미 같은 tripId 로 만들어진 글이 있으면 아무것도 하지 않는다(중복 방지).
 * - 이동거리·경과시간이 모두 0인 빈 기록은 건너뛴다.
 * - 실패해도 기록 종료 자체는 영향받지 않도록 호출부에서 try/catch 로 감싼다.
 */
export async function createWalkingFeedPost(tripId: string, userId: string) {
  const existing = await prisma.post.findFirst({ where: { tripId }, select: { id: true } });
  if (existing) return null;

  const trip = await prisma.fishingTrip.findFirst({
    where: { id: tripId, userId },
    include: {
      routePoints: { orderBy: { order: "asc" } },
      fishingPoints: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!trip) return null;
  if (trip.distanceM <= 0 && trip.durationSec <= 0) return null;

  const routePoints = trip.routePoints.map((p) => ({ lat: p.lat, lng: p.lng }));
  const catches = trip.fishingPoints;
  const catchCount = Math.max(trip.catchCount, catches.length);

  const body = JSON.stringify({
    routePoints,
    distanceM: trip.distanceM,
    durationSec: trip.durationSec,
    points: routePoints.length,
    catchCount,
    catchMarkers: catches
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => ({ lat: c.lat as number, lng: c.lng as number })),
  });

  const images = catches.filter((c) => c.photoUrl).map((c) => c.photoUrl as string);

  const post = await prisma.post.create({
    data: {
      authorId: userId,
      kind: "WALKING",
      postType: "WALKING_FEED",
      tripId: trip.id,
      caption: `워킹 피드 — 이동거리 ${km(trip.distanceM)} · ${duration(trip.durationSec)} · 어획 ${catchCount}마리`,
      body,
      region: trip.region,
      speciesName: trip.topSpecies,
      visibility: "PUBLIC",
      hashtags: JSON.stringify(["워킹낚시", ...(trip.region ? [trip.region] : [])]),
      images: images.length ? { create: images.map((url, order) => ({ url, order })) } : undefined,
    },
  });

  return post;
}
