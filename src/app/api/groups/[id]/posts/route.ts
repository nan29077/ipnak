import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  readGroupPosts, writeGroupPosts, readGroupLikes, readGroupComments,
  newId, getGroupRole, isApprovedRole, serializePost, type StoredGroupPost,
} from "@/lib/groupPosts";

// GET /api/groups/[id]/posts — 낚시단 피드 목록 (승인된 회원만)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = await getGroupRole(params.id, user.id);
  if (!isApprovedRole(role)) {
    return NextResponse.json({ error: "낚시단 회원만 이용할 수 있습니다." }, { status: 403 });
  }

  const likes = readGroupLikes();
  const comments = readGroupComments();
  const posts = readGroupPosts()
    .filter((p) => p.groupId === params.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((p) => serializePost(p, likes, comments, user.id));

  return NextResponse.json({ posts });
}

// POST /api/groups/[id]/posts — 새 글 작성 (승인된 회원만)  body: { content, imageUrl? }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = await getGroupRole(params.id, user.id);
  if (!isApprovedRole(role)) {
    return NextResponse.json({ error: "낚시단 회원만 글을 작성할 수 있습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl ? body.imageUrl : null;
  if (!content && !imageUrl) {
    return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  }

  const post: StoredGroupPost = {
    id: newId(),
    groupId: params.id,
    authorId: user.id,
    authorNickname: user.nickname,
    authorAvatar: user.avatarUrl ?? null,
    content,
    imageUrl,
    createdAt: new Date().toISOString(),
  };

  const posts = readGroupPosts();
  posts.push(post);
  writeGroupPosts(posts);

  return NextResponse.json({ post: { ...post, likeCount: 0, commentCount: 0, liked: false } });
}
