import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

function isApproved(role: string | null | undefined) {
  return role === "leader" || role === "sub_leader" || role === "member";
}

// GET /api/groups/[id]/points — 낚시단 포인트 목록 (회원 전용)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const membership = await getMembership(params.id, user.id);
    if (!isApproved(membership?.role)) {
      return NextResponse.json({ error: "낚시단 회원만 포인트를 볼 수 있습니다." }, { status: 403 });
    }

    // Raw SQL — prisma generate 없이도 동작 (db push 로 테이블 생성 후 바로 사용 가능)
    const rows = await prisma.$queryRaw<
      {
        id: string; lat: number; lng: number; title: string;
        description: string | null; tripId: string | null; authorId: string; createdAt: string;
        authorNickname: string; authorAvatar: string | null;
        distanceM: number | null; durationSec: number | null; catchCount: number | null;
      }[]
    >`
      SELECT gp.id, gp.lat, gp.lng, gp.title, gp.description, gp.tripId, gp.authorId, gp.createdAt,
             u.nickname AS authorNickname, u.avatarUrl AS authorAvatar,
             ft.distanceM, ft.durationSec, ft.catchCount
      FROM GroupPoint gp
      JOIN User u ON u.id = gp.authorId
      LEFT JOIN FishingTrip ft ON ft.id = gp.tripId
      WHERE gp.groupId = ${params.id}
      ORDER BY gp.createdAt DESC
    `;

    return NextResponse.json({
      points: rows.map((r) => ({
        id: r.id,
        lat: Number(r.lat),
        lng: Number(r.lng),
        title: r.title,
        description: r.description,
        tripId: r.tripId,
        distanceM: r.distanceM == null ? null : Number(r.distanceM),
        durationSec: r.durationSec == null ? null : Number(r.durationSec),
        catchCount: r.catchCount == null ? null : Number(r.catchCount),
        authorId: r.authorId,
        authorNickname: r.authorNickname,
        authorAvatar: r.authorAvatar,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt as unknown as number).toISOString(),
      })),
    });
  } catch (err) {
    console.error("[GET /api/groups/points]", err);
    return NextResponse.json({ error: "포인트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

// POST /api/groups/[id]/points — 포인트 추가 (회원 전용)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const membership = await getMembership(params.id, user.id);
    if (!isApproved(membership?.role)) {
      return NextResponse.json({ error: "낚시단 회원만 포인트를 등록할 수 있습니다." }, { status: 403 });
    }

    const body = await req.json();
    let { lat, lng, title, description } = body;
    const tripId = typeof body.tripId === "string" ? body.tripId : null;

    if (tripId) {
      const trip = await prisma.fishingTrip.findFirst({
        where: { id: tripId, userId: user.id, endedAt: { not: null } },
        include: { routePoints: { orderBy: { order: "asc" } }, fishingPoints: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (!trip) return NextResponse.json({ error: "선택한 데이터피싱 기록을 찾을 수 없습니다." }, { status: 404 });
      const anchor = trip.fishingPoints[0] ?? trip.routePoints[trip.routePoints.length - 1] ?? trip.routePoints[0];
      if (!anchor) return NextResponse.json({ error: "위치 기록이 있는 데이터피싱만 공유할 수 있습니다." }, { status: 400 });
      lat = anchor.lat;
      lng = anchor.lng;
      title = String(title || trip.title || "내 데이터피싱 기록");
      description = description || `${trip.region ? `${trip.region} · ` : ""}이동 ${(trip.distanceM / 1000).toFixed(1)}km · 조과 ${trip.catchCount}마리`;
    }

    if (typeof lat !== "number" || typeof lng !== "number" || !title?.trim()) {
      return NextResponse.json({ error: "위치와 제목은 필수입니다." }, { status: 400 });
    }

    const id = `gp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const desc = description?.trim() || null;

    await prisma.$executeRaw`
      INSERT INTO GroupPoint (id, groupId, authorId, lat, lng, title, description, tripId, createdAt)
      VALUES (${id}, ${params.id}, ${user.id}, ${lat}, ${lng}, ${title.trim()}, ${desc}, ${tripId}, ${now})
    `;

    return NextResponse.json({
      point: {
        id,
        lat,
        lng,
        title: title.trim(),
        description: desc,
        tripId,
        authorId: user.id,
        authorNickname: user.nickname,
        authorAvatar: user.avatarUrl ?? null,
        createdAt: now,
      },
    });
  } catch (err) {
    console.error("[POST /api/groups/points]", err);
    return NextResponse.json({ error: "포인트 등록에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
