import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["SELLING", "RESERVED", "SOLD"];

// 판매글 수정 (상태 변경 / 내용 수정) — 판매자 본인만
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const listing = await prisma.marketListing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "판매글을 찾을 수 없습니다." }, { status: 404 });
  if (listing.sellerId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof b.status === "string" && STATUSES.includes(b.status)) data.status = b.status;
  if (typeof b.title === "string" && b.title.trim()) data.title = b.title.trim();
  if (typeof b.price !== "undefined") data.price = Math.max(0, Math.round(Number(b.price) || 0));
  if (typeof b.description === "string") data.description = b.description;
  if (typeof b.category === "string" && b.category) data.category = b.category;
  if (typeof b.region === "string") data.region = b.region;
  if (typeof b.condition === "string" && (b.condition === "NEW" || b.condition === "USED")) data.condition = b.condition;

  const updated = await prisma.marketListing.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, status: updated.status });
}

// 판매글 삭제 — 판매자 본인만
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const listing = await prisma.marketListing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "판매글을 찾을 수 없습니다." }, { status: 404 });
  if (listing.sellerId !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  await prisma.marketListing.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
