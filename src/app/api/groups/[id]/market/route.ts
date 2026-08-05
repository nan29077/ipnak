import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/groups/[id]/market
 * 낚시단 회원들의 중고마켓 판매 상품 목록
 * - 승인 회원(leader/sub_leader/member)만 조회 가능
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  // 그룹 존재 확인
  const [group] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT \`id\`, \`leaderId\` FROM \`Group\` WHERE \`id\` = ?`,
    params.id
  );
  if (!group) return NextResponse.json({ error: "낚시단을 찾을 수 없습니다." }, { status: 404 });

  // 멤버 권한 확인
  const [mem] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT \`role\` FROM \`GroupMember\` WHERE \`groupId\` = ? AND \`userId\` = ?`,
    params.id, user.id
  );
  const myRole: string | null = mem?.role ?? null;
  if (!["leader", "sub_leader", "member"].includes(myRole ?? "")) {
    return NextResponse.json({ error: "낚시단 회원만 조회할 수 있습니다." }, { status: 403 });
  }

  // 승인된 회원 userId 목록
  const members = await prisma.$queryRawUnsafe<{ userId: string; nickname: string; avatarUrl: string | null }[]>(
    `SELECT m.\`userId\`, u.\`nickname\`, u.\`avatarUrl\`
     FROM \`GroupMember\` m
     LEFT JOIN \`User\` u ON u.\`id\` = m.\`userId\`
     WHERE m.\`groupId\` = ? AND m.\`role\` IN ('leader','sub_leader','member')`,
    params.id
  );

  if (members.length === 0) return NextResponse.json({ listings: [], memberCount: 0 });

  const memberIds = members.map((m) => m.userId);
  const sellerMap = Object.fromEntries(
    members.map((m) => [m.userId, { nickname: m.nickname, avatarUrl: m.avatarUrl }])
  );

  // 회원들의 판매 상품 조회
  const listings = await prisma.marketListing.findMany({
    where: { sellerId: { in: memberIds } },
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { favorites: true, chats: true } },
    },
  });

  const result = listings.map((l) => ({
    id: l.id,
    title: l.title,
    category: l.category,
    condition: l.condition,
    price: l.price,
    region: l.region,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    thumbnail: l.images[0]?.url ?? null,
    favoriteCount: l._count.favorites,
    chatCount: l._count.chats,
    sellerId: l.sellerId,
    sellerNickname: sellerMap[l.sellerId]?.nickname ?? "알 수 없음",
    sellerAvatar: sellerMap[l.sellerId]?.avatarUrl ?? null,
  }));

  return NextResponse.json({
    listings: result,
    memberCount: members.length,
  });
}
