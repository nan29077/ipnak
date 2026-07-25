export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// GET /api/me/log-posts — 내 조행기(내기록) 목록 (낚시단 포인트 공유용)
export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ records: [] }); }

  try {
    const posts = await (prisma.post as any).findMany({
      where: { authorId: user.id, kind: "LOG", hidden: false },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        region: true,
        lat: true,
        lng: true,
        createdAt: true,
        images: { select: { url: true }, orderBy: { order: "asc" }, take: 1 },
      },
    });

    return NextResponse.json({
      records: posts.map((p: any) => ({
        id: p.id,
        title: p.title || "조행기",
        excerpt: String(p.body || "").slice(0, 80),
        region: p.region ?? null,
        lat: p.lat != null ? Number(p.lat) : null,
        lng: p.lng != null ? Number(p.lng) : null,
        thumbnail: p.images?.[0]?.url ?? null,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      })),
    });
  } catch {
    // kind 컬럼이 아직 없는 경우 graceful 처리
    return NextResponse.json({ records: [] });
  }
}
