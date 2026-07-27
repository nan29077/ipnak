import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "IpnakBallProduct" ORDER BY "createdAt" DESC`
    );
    return NextResponse.json({ products: products.map((p) => ({ ...p, isActive: Boolean(p.isActive), optionEnabled: Boolean(p.optionEnabled) })) });
  } catch (e: any) {
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

    // 상품 1개 제한
    const existing = await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM "IpnakBallProduct" LIMIT 1`);
    if (existing.length > 0) {
      return NextResponse.json({ error: "입낚볼 상품은 1개만 등록할 수 있습니다. 기존 상품을 수정하거나 삭제해주세요." }, { status: 400 });
    }

    const body = await req.json();
    const { name, price, description, stock, imageUrl, isActive, optionEnabled, optionOneLabel, optionOnePrice, optionTwoLabel, optionTwoPrice } = body;
    if (!String(name || "").trim() || !price) {
      return NextResponse.json({ error: "이름과 가격을 입력해주세요." }, { status: 400 });
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "IpnakBallProduct" ("id","name","price","description","stock","imageUrl","isActive","optionEnabled","optionOneLabel","optionOnePrice","optionTwoLabel","optionTwoPrice","createdAt","updatedAt")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      String(name).trim(),
      Number(price),
      description ? String(description).trim() : null,
      Number(stock) || 0,
      imageUrl ? String(imageUrl).trim() : null,
      isActive !== false ? 1 : 0,
      optionEnabled ? 1 : 0,
      optionEnabled && optionOneLabel ? String(optionOneLabel).trim() : null,
      optionEnabled && optionOnePrice != null ? Number(optionOnePrice) : null,
      optionEnabled && optionTwoLabel ? String(optionTwoLabel).trim() : null,
      optionEnabled && optionTwoPrice != null ? Number(optionTwoPrice) : null,
      now, now
    );
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: "상품 등록에 실패했습니다." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    const body = await req.json();
    const { id, isActive, stock, optionEnabled, optionOneLabel, optionOnePrice, optionTwoLabel, optionTwoPrice } = body;
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    const now = new Date().toISOString();
    if (typeof isActive === "boolean") {
      await prisma.$executeRawUnsafe(
        `UPDATE "IpnakBallProduct" SET "isActive" = ?, "updatedAt" = ? WHERE "id" = ?`,
        isActive ? 1 : 0, now, id
      );
    }
    if (typeof stock === "number") {
      await prisma.$executeRawUnsafe(
        `UPDATE "IpnakBallProduct" SET "stock" = ?, "updatedAt" = ? WHERE "id" = ?`,
        stock, now, id
      );
    }
    if (typeof optionEnabled === "boolean") {
      await prisma.$executeRawUnsafe(
        `UPDATE "IpnakBallProduct" SET "optionEnabled" = ?, "optionOneLabel" = ?, "optionOnePrice" = ?, "optionTwoLabel" = ?, "optionTwoPrice" = ?, "updatedAt" = ? WHERE "id" = ?`,
        optionEnabled ? 1 : 0,
        optionEnabled && optionOneLabel ? String(optionOneLabel).trim() : null,
        optionEnabled && optionOnePrice != null ? Number(optionOnePrice) : null,
        optionEnabled && optionTwoLabel ? String(optionTwoLabel).trim() : null,
        optionEnabled && optionTwoPrice != null ? Number(optionTwoPrice) : null,
        now, id
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "수정에 실패했습니다." }, { status: 500 });
  }
}
