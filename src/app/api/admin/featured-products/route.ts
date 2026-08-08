import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import { toDbDate } from "@/lib/dbDate";

export const dynamic = "force-dynamic";

type RawFeatured = { id: string; productId: string; section: string; order: number; createdAt: string };

// GET /api/admin/featured-products?section=TODAY
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");

    let featured: RawFeatured[];
    if (section) {
      featured = await prisma.$queryRaw<RawFeatured[]>`SELECT * FROM \`FeaturedProduct\` WHERE section = ${section} ORDER BY \`order\``;
    } else {
      featured = await prisma.$queryRaw<RawFeatured[]>`SELECT * FROM \`FeaturedProduct\` ORDER BY section, \`order\``;
    }
    return NextResponse.json({ featured });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/featured-products  { productId, section }
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
    const { productId, section } = await req.json();
    if (!productId || !section) {
      return NextResponse.json({ error: "productId, section 필수" }, { status: 400 });
    }
    const VALID = ["TODAY", "WEEKLY", "MONTHLY", "BEST"];
    if (!VALID.includes(section)) {
      return NextResponse.json({ error: "유효하지 않은 섹션" }, { status: 400 });
    }

    // 해당 섹션에 이미 5개면 거부
    const countRows = await prisma.$queryRaw<[{ cnt: bigint }]>`SELECT COUNT(*) as cnt FROM \`FeaturedProduct\` WHERE section = ${section}`;
    const count = Number(countRows[0]?.cnt ?? 0);
    if (count >= 5) {
      return NextResponse.json({ error: "섹션당 최대 5개까지 등록 가능합니다" }, { status: 400 });
    }

    // 중복 확인
    const existing = await prisma.$queryRaw<RawFeatured[]>`SELECT * FROM \`FeaturedProduct\` WHERE productId = ${productId} AND section = ${section}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "이미 등록된 상품입니다" }, { status: 400 });
    }

    // 최대 order 계산
    const maxRows = await prisma.$queryRaw<[{ maxOrder: number | null }]>`SELECT MAX(\`order\`) as maxOrder FROM \`FeaturedProduct\` WHERE section = ${section}`;
    const order = (maxRows[0]?.maxOrder ?? -1) + 1;

    const id = randomUUID();
    // MariaDB DATETIME 컬럼에는 ISO 문자열(…T…Z)을 바인딩할 수 없다 (Error 1292)
    const now = toDbDate();
    await prisma.$executeRaw`INSERT INTO \`FeaturedProduct\` (\`id\`,\`productId\`,\`section\`,\`order\`,\`createdAt\`) VALUES (${id},${productId},${section},${order},${now})`;

    // 생성된 레코드와 product 정보 반환
    const product = await prisma.product.findUnique({ where: { id: productId } });
    const record = { id, productId, section, order, createdAt: now, product };
    return NextResponse.json({ record });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/featured-products  { id }
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

    await prisma.$executeRaw`DELETE FROM \`FeaturedProduct\` WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
