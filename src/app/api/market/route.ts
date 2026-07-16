import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 판매글 목록 (검색/필터/정렬) — 클라이언트 검색용 보조 API
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const category = searchParams.get("category") || "";
  const region = searchParams.get("region") || "";
  const sort = searchParams.get("sort") || "recent";

  const where: any = {};
  if (category && category !== "ALL") where.category = category;
  if (region && region !== "ALL") where.region = region;
  if (q) where.title = { contains: q };

  const orderBy =
    sort === "price_asc" ? { price: "asc" as const }
    : sort === "price_desc" ? { price: "desc" as const }
    : { createdAt: "desc" as const };

  const listings = await prisma.marketListing.findMany({
    where, orderBy,
    include: {
      images: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { favorites: true, chats: true } },
    },
  });
  return NextResponse.json({ listings });
}

// 판매글 등록
export async function POST(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  const title = (b.title || "").trim();
  if (!title) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  if (!b.category) return NextResponse.json({ error: "카테고리를 선택해주세요." }, { status: 400 });

  const images: string[] = Array.isArray(b.images) && b.images.length
    ? b.images.slice(0, 10)
    : [`https://picsum.photos/seed/market-${Date.now()}/800/800`];

  const listing = await prisma.marketListing.create({
    data: {
      sellerId: user.id,
      title,
      category: b.category,
      condition: b.condition === "NEW" ? "NEW" : "USED",
      price: Math.max(0, Math.round(Number(b.price) || 0)),
      region: b.region || null,
      description: b.description || null,
      status: "SELLING",
      images: { create: images.map((url: string, i: number) => ({ url, order: i })) },
    },
  });
  return NextResponse.json({ ok: true, id: listing.id });
}
