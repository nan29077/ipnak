import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function ensureTable() {
  // 백틱 식별자 + VARCHAR 타입 — SQLite/MariaDB 양쪽에서 동작한다
  // (MariaDB는 더블쿼트를 문자열 리터럴로 해석하고, TEXT 컬럼은 PRIMARY KEY가 될 수 없다)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`ShippingAddress\` (
      \`id\`            VARCHAR(191) NOT NULL PRIMARY KEY,
      \`userId\`        VARCHAR(191) NOT NULL,
      \`name\`          VARCHAR(191) NOT NULL,
      \`phone\`         VARCHAR(191) NOT NULL,
      \`address\`       VARCHAR(500) NOT NULL,
      \`addressDetail\` VARCHAR(500) NOT NULL DEFAULT '',
      \`isDefault\`     INTEGER NOT NULL DEFAULT 0,
      \`createdAt\`     VARCHAR(64) NOT NULL
    )
  `);
}

export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  await ensureTable();

  const addresses = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM \`ShippingAddress\` WHERE \`userId\` = ? ORDER BY \`isDefault\` DESC, \`createdAt\` DESC`,
    user.id,
  );
  return NextResponse.json({ addresses });
}

export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  await ensureTable();

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const { name, phone, address, addressDetail, isDefault } = body;
  if (!name || !phone || !address) return NextResponse.json({ error: "이름, 전화번호, 주소는 필수입니다." }, { status: 400 });

  const id = randomUUID();
  const now = new Date().toISOString();

  // 기본 배송지 설정 시 기존 기본 배송지 해제
  if (isDefault) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`ShippingAddress\` SET \`isDefault\` = 0 WHERE \`userId\` = ?`,
      user.id,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`ShippingAddress\` (\`id\`,\`userId\`,\`name\`,\`phone\`,\`address\`,\`addressDetail\`,\`isDefault\`,\`createdAt\`)
     VALUES (?,?,?,?,?,?,?,?)`,
    id, user.id, name, phone, address, addressDetail ?? "", isDefault ? 1 : 0, now,
  );

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }

  await ensureTable();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  await prisma.$executeRawUnsafe(
    `DELETE FROM \`ShippingAddress\` WHERE \`id\` = ? AND \`userId\` = ?`,
    id, user.id,
  );
  return NextResponse.json({ ok: true });
}
