import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalkingFeedPostsPage } from "@/lib/queries";

// GET /api/posts/walking?cursor=xxx&limit=12
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? "12")), 50);

    const user = await getCurrentUser();
    const { posts, nextCursor } = await getWalkingFeedPostsPage(user?.id, undefined, cursor, limit);
    return NextResponse.json({ posts, nextCursor });
  } catch {
    return NextResponse.json({ posts: [], nextCursor: null });
  }
}
