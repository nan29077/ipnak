import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { excludeVirtualWhere } from "@/lib/virtualVisibility";

export const dynamic = "force-dynamic";

const TRADE_METHODS = ["DIRECT", "DELIVERY", "BOTH"];

// 판매글 목록 (검색/필터/정렬) — 클라이언트 검색용 보조 API
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const category = searchParams.get("category") || "";
  const region = searchParams.get("region") || "";
  const sort = searchParams.get("sort") || "recent";
  const sellerId = searchParams.get("sellerId") || "";

  const where: any = {};
  if (category && category !== "ALL") where.category = category;
  if (region && region !== "ALL") where.region = region;
  if (q) where.title = { contains: q };
  if (sellerId) where.sellerId = sellerId;
  // 특정 판매자를 지정한 조회(내 판매글 등)가 아니면 가상회원 판매글을 스위치 상태에 따라 제외
  else Object.assign(where, await excludeVirtualWhere("seller"));

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
  const description = (b.description || "").trim();
  if (!description) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  if (b.price === "" || b.price === null || b.price === undefined || !Number.isFinite(Number(b.price))) {
    return NextResponse.json({ error: "가격을 입력해주세요." }, { status: 400 });
  }
  // 카테고리는 선택사항 — 미선택 시 "기타 용품"으로 저장 (DB 컬럼이 non-null)
  const category = String(b.category || "ETC");

  // 이미지 배열 요소는 문자열만 허용 (숫자/객체 혼입 시 Prisma 타입 오류 → 500 방지)
  const rawImages: string[] = Array.isArray(b.images)
    ? b.images.filter((u: unknown) => typeof u === "string" && u).slice(0, 10)
    : [];
  const images: string[] = rawImages;

  try {
    const listing = await prisma.marketListing.create({
      data: {
        sellerId: user.id,
        title,
        category,
        condition: b.condition === "NEW" ? "NEW" : "USED",
        price: Math.max(0, Math.round(Number(b.price) || 0)),
        region: b.region || null,
        location: b.location || null, // 글쓰기 폼 거래 지역 선택값
        description,
        tradeMethod: TRADE_METHODS.includes(b.tradeMethod) ? b.tradeMethod : null,
        status: "SELLING",
        images: images.length
          ? { create: images.map((url: string, i: number) => ({ url, order: i })) }
          : undefined,
      },
    });
    return NextResponse.json({ ok: true, id: listing.id });
  } catch {
    return NextResponse.json({ error: "판매글 등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}
