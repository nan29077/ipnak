import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFeedPostsPage } from "@/lib/queries";

// GET /api/posts/feed?cursor=xxx&limit=20&kind=FEED
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? "20")), 50);
    const kind = url.searchParams.get("kind") ?? "FEED";

    const user = await getCurrentUser();
    const { posts, nextCursor } = await getFeedPostsPage(user?.id, { kind }, cursor, limit);
    return NextResponse.json({ posts, nextCursor });
  } catch {
    return NextResponse.json({ posts: [], nextCursor: null });
  }
}
