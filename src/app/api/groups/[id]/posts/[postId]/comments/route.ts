import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  readGroupPosts, readGroupComments, writeGroupComments,
  newId, getGroupRole, isApprovedRole, type StoredGroupComment,
} from "@/lib/groupPosts";

// GET /api/groups/[id]/posts/[postId]/comments — 댓글 목록 (승인된 회원만)
export async function GET(_req: Request, { params }: { params: { id: string; postId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = await getGroupRole(params.id, user.id);
  if (!isApprovedRole(role)) {
    return NextResponse.json({ error: "낚시단 회원만 이용할 수 있습니다." }, { status: 403 });
  }

  const post = readGroupPosts().find((p) => p.id === params.postId && p.groupId === params.id);
  if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  const comments = readGroupComments()
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

  const post = readGroupPosts().find((p) => p.id === params.postId && p.groupId === params.id);
  if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });

  const comment: StoredGroupComment = {
    id: newId(),
    postId: params.postId,
    authorId: user.id,
    authorNickname: user.nickname,
    authorAvatar: user.avatarUrl ?? null,
    content,
    createdAt: new Date().toISOString(),
  };

  const comments = readGroupComments();
  comments.push(comment);
  writeGroupComments(comments);

  return NextResponse.json({ comment });
}
