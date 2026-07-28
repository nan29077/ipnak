import { NextResponse } from "next/server";
import { getLogPostsPage } from "@/lib/queries";

// GET /api/posts/log?cursor=xxx&limit=20&category=FREE
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? "20")), 50);
    const category = url.searchParams.get("category") ?? null;

    const { posts, nextCursor } = await getLogPostsPage({ category }, cursor, limit);
    return NextResponse.json({ posts, nextCursor });
  } catch {
    return NextResponse.json({ posts: [], nextCursor: null });
  }
}
