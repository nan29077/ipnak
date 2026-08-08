import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFeedPostsPage } from "@/lib/queries";

// GET /api/posts/feed?cursor=xxx&limit=20&kind=FEED&tag=부산
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? "20")), 50);
    const kind = url.searchParams.get("kind") ?? "FEED";
    // 해시태그 검색어 (없으면 전체 피드)
    const tag = url.searchParams.get("tag") ?? undefined;

    const user = await getCurrentUser();
    const { posts, nextCursor } = await getFeedPostsPage(user?.id, { kind, tag }, cursor, limit);
    return NextResponse.json({ posts, nextCursor });
  } catch {
    return NextResponse.json({ posts: [], nextCursor: null });
  }
}
