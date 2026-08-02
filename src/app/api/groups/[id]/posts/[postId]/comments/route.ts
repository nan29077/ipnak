import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  readGroupPosts, readGroupComments, writeGroupComment,
  newId, getGroupRole, isApprovedRole,
} from "@/lib/groupPosts";
import { awardCommentReward } from "@/lib/points";

// GET /api/groups/[id]/posts/[postId]/comments — 댓글 목록 (승인된 회원만)
export async function GET(_req: Request, { params }: { params: { id: string; postId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = await getGroupRole(params.id, user.id);
  if (!isApprovedRole(role)) {
    return NextResponse.json({ error: "낚시단 회원만 이용할 수 있습니다." }, { status: 403 });
  }

  const allPosts = await readGroupPosts();
  const post = allPosts.find((p) => p.id === params.postId && p.groupId === params.id);
  if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  const allComments = await readGroupComments();
  const comments = allComments
    .filter((c) => c.postId === params.postId)
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

  return NextResponse.json({ comments });
}

// POST /api/groups/[id]/posts/[postId]/comments — 댓글 작성 (승인된 회원만)  body: { content }
export async function POST(req: Request, { params }: { params: { id: string; postId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = await getGroupRole(params.id, user.id);
  if (!isApprovedRole(role)) {
    return NextResponse.json({ error: "낚시단 회원만 댓글을 작성할 수 있습니다." }, { status: 403 });
  }

  const allPosts = await readGroupPosts();
  const post = allPosts.find((p) => p.id === params.postId && p.groupId === params.id);
  if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  // 사진만 첨부한 댓글도 허용 — 글·사진 둘 다 없을 때만 막는다
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  if (!content && !imageUrl) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  const parentId = typeof body.parentId === "string" ? body.parentId : null;

  const id = newId();
  const createdAt = new Date().toISOString();

  await writeGroupComment({
    id,
    postId: params.postId,
    authorId: user.id,
    content,
    imageUrl,
    createdAt,
    parentId: parentId || null,
  });

  const comment = {
    id,
    postId: params.postId,
    authorId: user.id,
    authorNickname: user.nickname,
    authorAvatar: user.avatarUrl ?? null,
    content,
    imageUrl,
    createdAt,
    parentId: parentId || null,
  };

  // 댓글 작성 적립 (+10P, 한도 없음) — 실패해도 댓글 등록은 성공 처리
  const pointsEarned = (await awardCommentReward(user.id)) ?? 0;

  return NextResponse.json({ comment, pointsEarned });
}
