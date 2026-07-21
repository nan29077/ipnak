import "server-only";
import fs from "fs";
import path from "path";
import { prisma } from "./prisma";

// 낚시단 커뮤니티 글/좋아요/댓글 — 파일 기반 저장소 (.group-data/)
// Post 테이블에 groupId가 없어 기존 DB 스키마를 건드리지 않고 별도 JSON 파일로 관리한다.

const DATA_DIR = path.join(process.cwd(), ".group-data");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");
const LIKES_FILE = path.join(DATA_DIR, "likes.json");
const COMMENTS_FILE = path.join(DATA_DIR, "comments.json");

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
  createdAt: string;
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string): T[] {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T[];
  } catch {
    return [];
  }
}

function writeJson<T>(file: string, data: T[]) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data), "utf8");
}

export function readGroupPosts(): StoredGroupPost[] {
  return readJson<StoredGroupPost>(POSTS_FILE);
}
export function writeGroupPosts(posts: StoredGroupPost[]) {
  writeJson(POSTS_FILE, posts);
}

export function readGroupLikes(): StoredGroupLike[] {
  return readJson<StoredGroupLike>(LIKES_FILE);
}
export function writeGroupLikes(likes: StoredGroupLike[]) {
  writeJson(LIKES_FILE, likes);
}

export function readGroupComments(): StoredGroupComment[] {
  return readJson<StoredGroupComment>(COMMENTS_FILE);
}
export function writeGroupComments(comments: StoredGroupComment[]) {
  writeJson(COMMENTS_FILE, comments);
}

export function newId() {
  return `gp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// 낚시단 멤버 역할 조회 — leader | sub_leader | member | pending | null
export async function getGroupRole(groupId: string, userId: string): Promise<string | null> {
  const [mem] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "role" FROM "GroupMember" WHERE "groupId" = ? AND "userId" = ?`,
    groupId, userId
  );
  return mem?.role ?? null;
}

export function isApprovedRole(role: string | null): boolean {
  return role === "leader" || role === "sub_leader" || role === "member";
}

// API 응답용 Post 직렬화 (likeCount / commentCount / liked 포함)
export function serializePost(post: StoredGroupPost, likes: StoredGroupLike[], comments: StoredGroupComment[], currentUserId: string) {
  const postLikes = likes.filter((l) => l.postId === post.id);
  return {
    ...post,
    likeCount: postLikes.length,
    commentCount: comments.filter((c) => c.postId === post.id).length,
    liked: postLikes.some((l) => l.userId === currentUserId),
  };
}
