import "server-only";
import { prisma } from "./prisma";

// 낚시단 커뮤니티 글/좋아요/댓글 — Prisma Client 기반 저장소 (GroupPost / GroupComment / GroupPostLike 모델)
// 기존에는 raw SQL로 테이블을 직접 만들고 CRUD 했으나, SQLite 전용 구문(INSERT OR IGNORE,
// 더블쿼트 식별자, sqlite_master 등)이 MariaDB 실서버에서 구문 오류를 일으켜 Prisma Client로 전면 교체했다.
// 테이블은 prisma migrate / db push로 생성된다 (schema.prisma에 모델 정의됨).

// ──────────────────────────────────────────
// 타입 정의 (API 라우트와의 호환성 유지)
// ──────────────────────────────────────────

export type StoredGroupPost = {
  id: string;
  groupId: string;
  authorId: string;
  authorNickname: string;
  authorAvatar: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: string;
};

export type StoredGroupLike = {
  postId: string;
  userId: string;
  createdAt: string;
};

export type StoredGroupComment = {
  id: string;
  postId: string;
  authorId: string;
  authorNickname: string;
  authorAvatar: string | null;
  content: string;
  imageUrl?: string | null; // 댓글 첨부 사진 (1장)
  createdAt: string;
  parentId?: string | null;
};

// ──────────────────────────────────────────
// ID 생성
// ──────────────────────────────────────────

export function newId() {
  return `gp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ──────────────────────────────────────────
// GroupPost CRUD
// ──────────────────────────────────────────

export async function readGroupPosts(): Promise<StoredGroupPost[]> {
  const rows = await prisma.groupPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { nickname: true, avatarUrl: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    authorId: r.authorId,
    authorNickname: r.author?.nickname ?? "알 수 없음",
    authorAvatar: r.author?.avatarUrl ?? null,
    content: r.content,
    imageUrl: r.imageUrl ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function writeGroupPost(post: Omit<StoredGroupPost, "authorNickname" | "authorAvatar">): Promise<void> {
  await prisma.groupPost.create({
    data: {
      id: post.id,
      groupId: post.groupId,
      authorId: post.authorId,
      content: post.content,
      imageUrl: post.imageUrl ?? null,
      ...(post.createdAt ? { createdAt: new Date(post.createdAt) } : {}),
    },
  });
}

// ──────────────────────────────────────────
// GroupPostLike CRUD
// ──────────────────────────────────────────

export async function readGroupLikes(): Promise<StoredGroupLike[]> {
  const rows = await prisma.groupPostLike.findMany({
    select: { postId: true, userId: true, createdAt: true },
  });
  return rows.map((r) => ({ postId: r.postId, userId: r.userId, createdAt: r.createdAt.toISOString() }));
}

export async function addGroupLike(postId: string, userId: string): Promise<void> {
  // upsert — unique(postId, userId) 제약이 있어 이미 눌렀으면 no-op (기존 INSERT OR IGNORE 대체)
  await prisma.groupPostLike.upsert({
    where: { postId_userId: { postId, userId } },
    update: {},
    create: { id: newId(), postId, userId },
  });
}

export async function removeGroupLike(postId: string, userId: string): Promise<void> {
  await prisma.groupPostLike.deleteMany({ where: { postId, userId } });
}

export async function groupLikeExists(postId: string, userId: string): Promise<boolean> {
  const row = await prisma.groupPostLike.findUnique({
    where: { postId_userId: { postId, userId } },
    select: { id: true },
  });
  return row != null;
}

export async function groupLikeCount(postId: string): Promise<number> {
  return prisma.groupPostLike.count({ where: { postId } });
}

// ──────────────────────────────────────────
// GroupComment CRUD
// ──────────────────────────────────────────

export async function readGroupComments(): Promise<StoredGroupComment[]> {
  const rows = await prisma.groupComment.findMany({
    orderBy: { createdAt: "asc" },
    include: { author: { select: { nickname: true, avatarUrl: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    postId: r.postId,
    authorId: r.authorId,
    authorNickname: r.author?.nickname ?? "알 수 없음",
    authorAvatar: r.author?.avatarUrl ?? null,
    content: r.content,
    imageUrl: r.imageUrl ?? null,
    createdAt: r.createdAt.toISOString(),
    parentId: r.parentId ?? null,
  }));
}

export async function writeGroupComment(comment: Omit<StoredGroupComment, "authorNickname" | "authorAvatar">): Promise<void> {
  await prisma.groupComment.create({
    data: {
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      content: comment.content,
      imageUrl: comment.imageUrl ?? null,
      parentId: comment.parentId ?? null,
      ...(comment.createdAt ? { createdAt: new Date(comment.createdAt) } : {}),
    },
  });
}

// ──────────────────────────────────────────
// 낚시단 멤버 역할 조회 — leader | sub_leader | member | pending | null
// ──────────────────────────────────────────

export async function getGroupRole(groupId: string, userId: string): Promise<string | null> {
  const mem = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });
  return mem?.role ?? null;
}

export function isApprovedRole(role: string | null): boolean {
  return role === "leader" || role === "sub_leader" || role === "member";
}

// ──────────────────────────────────────────
// 직렬화 — API 응답용 (likeCount / commentCount / liked 포함)
// ──────────────────────────────────────────

export function serializePost(post: StoredGroupPost, likes: StoredGroupLike[], comments: StoredGroupComment[], currentUserId: string) {
  const postLikes = likes.filter((l) => l.postId === post.id);
  return {
    ...post,
    likeCount: postLikes.length,
    commentCount: comments.filter((c) => c.postId === post.id).length,
    liked: postLikes.some((l) => l.userId === currentUserId),
  };
}
