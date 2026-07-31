import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLogPostsPage } from "@/lib/queries";

// GET /api/posts/log?cursor=xxx&limit=20&category=FREE
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? "20")), 50);
    const category = url.searchParams.get("category") ?? null;
    const user = await getCurrentUser().catch(() => null);

    const { posts, nextCursor } = await getLogPostsPage({ category }, cursor, limit, user?.id);
    return NextResponse.json({ posts, nextCursor });
  } catch {
    return NextResponse.json({ posts: [], nextCursor: null });
  }
}
