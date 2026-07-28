import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  readGroupPosts, readGroupLikes, writeGroupLikes,
  getGroupRole, isApprovedRole,
} from "@/lib/groupPosts";

// POST /api/groups/[id]/posts/[postId]/like — 좋아요 토글 (승인된 회원만)
export async function POST(_req: Request, { params }: { params: { id: string; postId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = await getGroupRole(params.id, user.id);
  if (!isApprovedRole(role)) {
    return NextResponse.json({ error: "낚시단 회원만 이용할 수 있습니다." }, { status: 403 });
  }

  const post = readGroupPosts().find((p) => p.id === params.postId && p.groupId === params.id);
  if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  let likes = readGroupLikes();
  const existing = likes.find((l) => l.postId === params.postId && l.userId === user.id);
  let liked: boolean;
  if (existing) {
    likes = likes.filter((l) => !(l.postId === params.postId && l.userId === user.id));
    liked = false;
  } else {
    likes.push({ postId: params.postId, userId: user.id, createdAt: new Date().toISOString() });
    liked = true;
  }
  writeGroupLikes(likes);

  const likeCount = likes.filter((l) => l.postId === params.postId).length;
  return NextResponse.json({ liked, likeCount });
}
