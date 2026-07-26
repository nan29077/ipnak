import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Order" (
      "id"                TEXT NOT NULL PRIMARY KEY,
      "userId"            TEXT NOT NULL,
      "productId"         TEXT NOT NULL,
      "productName"       TEXT NOT NULL,
      "price"             INTEGER NOT NULL DEFAULT 0,
      "quantity"          INTEGER NOT NULL DEFAULT 1,
      "shippingFee"       INTEGER NOT NULL DEFAULT 0,
      "totalAmount"       INTEGER NOT NULL DEFAULT 0,
      "shippingAddressId" TEXT,
      "status"            TEXT NOT NULL DEFAULT 'PAID',
      "paymentMethod"     TEXT NOT NULL DEFAULT 'CARD',
      "createdAt"         TEXT NOT NULL
    )
  `);
}

export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  await ensureTable();

  const orders = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Order" WHERE "userId" = ? ORDER BY "createdAt" DESC`,
    user.id,
  );
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  await ensureTable();

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const { productId, productName, price, quantity, shippingFee, totalAmount, shippingAddressId, paymentMethod } = body;
  if (!productId || !productName) return NextResponse.json({ error: "상품 정보가 필요합니다." }, { status: 400 });

  const id = randomUUID();
  const now = new Date().toISOString();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Order" ("id","userId","productId","productName","price","quantity","shippingFee","totalAmount","shippingAddressId","status","paymentMethod","createdAt")
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, user.id, productId, productName,
    Number(price) || 0, Number(quantity) || 1, Number(shippingFee) || 0, Number(totalAmount) || 0,
    shippingAddressId ?? null, "PAID", paymentMethod ?? "CARD", now,
  );

  return NextResponse.json({ ok: true, id });
}
