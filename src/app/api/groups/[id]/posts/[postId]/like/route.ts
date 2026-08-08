import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  readGroupPosts, addGroupLike, removeGroupLike, groupLikeExists, groupLikeCount,
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

  const allPosts = await readGroupPosts();
  const post = allPosts.find((p) => p.id === params.postId && p.groupId === params.id);
  if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  const already = await groupLikeExists(params.postId, user.id);
  let liked: boolean;
  if (already) {
    await removeGroupLike(params.postId, user.id);
    liked = false;
  } else {
    await addGroupLike(params.postId, user.id);
    liked = true;
  }

  const likeCount = await groupLikeCount(params.postId);
  return NextResponse.json({ liked, likeCount });
}
