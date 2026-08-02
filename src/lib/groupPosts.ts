import "server-only";
import { prisma } from "./prisma";

// 낚시단 커뮤니티 글/좋아요/댓글 — Prisma DB 기반 저장소 (GroupPost / GroupComment / GroupPostLike 테이블)
// 기존 .group-data/*.json 파일 저장 방식을 DB로 대체한다.
// 서버 시작 시 테이블이 없으면 auto-create 한다 (idempotent).

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
// 테이블 자동 초기화 (CREATE TABLE IF NOT EXISTS)
// ──────────────────────────────────────────

let _tablesReady: Promise<void> | null = null;

function ensureTables(): Promise<void> {
  if (_tablesReady) return _tablesReady;
  _tablesReady = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GroupPost" (
          "id"        TEXT NOT NULL PRIMARY KEY,
          "groupId"   TEXT NOT NULL,
          "authorId"  TEXT NOT NULL,
          "content"   TEXT NOT NULL,
          "imageUrl"  TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GroupPost_groupId_idx" ON "GroupPost"("groupId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GroupPost_authorId_idx" ON "GroupPost"("authorId")`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GroupComment" (
          "id"        TEXT NOT NULL PRIMARY KEY,
          "postId"    TEXT NOT NULL,
          "authorId"  TEXT NOT NULL,
          "content"   TEXT NOT NULL,
          "imageUrl"  TEXT,
          "parentId"  TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GroupComment_postId_idx" ON "GroupComment"("postId")`);
      // 기존 DB(imageUrl 없이 생성된 테이블) 보정 — 이미 있으면 duplicate column 에러라 무시한다
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "GroupComment" ADD COLUMN "imageUrl" TEXT`);
      } catch { /* 이미 존재하는 컬럼 */ }

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GroupPostLike" (
          "id"        TEXT NOT NULL PRIMARY KEY,
          "postId"    TEXT NOT NULL,
          "userId"    TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "GroupPostLike_postId_userId_key" ON "GroupPostLike"("postId","userId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GroupPostLike_postId_idx" ON "GroupPostLike"("postId")`);
    } catch (e) {
      console.error("[groupPosts] 테이블 초기화 오류:", e);
    }
  })();
  return _tablesReady;
}

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
  await ensureTables();
  // DB에는 authorNickname / authorAvatar 가 없으므로 User 테이블 JOIN
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT p.id, p.groupId, p.authorId, u.nickname as authorNickname, u.avatarUrl as authorAvatar,
           p.content, p.imageUrl, p.createdAt
    FROM "GroupPost" p
    LEFT JOIN "User" u ON u.id = p.authorId
    ORDER BY p.createdAt DESC
  `);
  return rows.map(toStoredPost);
}

export async function writeGroupPost(post: Omit<StoredGroupPost, "authorNickname" | "authorAvatar">): Promise<void> {
  await ensureTables();
  const now = post.createdAt ?? new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GroupPost" (id, groupId, authorId, content, imageUrl, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    post.id, post.groupId, post.authorId, post.content, post.imageUrl ?? null, now, now
  );
}

// ──────────────────────────────────────────
// GroupPostLike CRUD
// ──────────────────────────────────────────

export async function readGroupLikes(): Promise<StoredGroupLike[]> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT postId, userId, createdAt FROM "GroupPostLike"`);
  return rows.map((r) => ({ postId: r.postId, userId: r.userId, createdAt: String(r.createdAt) }));
}

export async function addGroupLike(postId: string, userId: string): Promise<void> {
  await ensureTables();
  const id = newId();
  const now = new Date().toISOString();
  // INSERT OR IGNORE for upsert-like behavior (SQLite unique constraint)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "GroupPostLike" (id, postId, userId, createdAt) VALUES (?, ?, ?, ?)`,
    id, postId, userId, now
  );
}

export async function removeGroupLike(postId: string, userId: string): Promise<void> {
  await ensureTables();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "GroupPostLike" WHERE postId = ? AND userId = ?`,
    postId, userId
  );
}

export async function groupLikeExists(postId: string, userId: string): Promise<boolean> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 1 FROM "GroupPostLike" WHERE postId = ? AND userId = ? LIMIT 1`,
    postId, userId
  );
  return rows.length > 0;
}

export async function groupLikeCount(postId: string): Promise<number> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) as cnt FROM "GroupPostLike" WHERE postId = ?`,
    postId
  );
  return Number(rows[0]?.cnt ?? 0);
}

// ──────────────────────────────────────────
// GroupComment CRUD
// ──────────────────────────────────────────

export async function readGroupComments(): Promise<StoredGroupComment[]> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT c.id, c.postId, c.authorId, u.nickname as authorNickname, u.avatarUrl as authorAvatar,
           c.content, c.imageUrl, c.createdAt, c.parentId
    FROM "GroupComment" c
    LEFT JOIN "User" u ON u.id = c.authorId
    ORDER BY c.createdAt ASC
  `);
  return rows.map(toStoredComment);
}

export async function writeGroupComment(comment: Omit<StoredGroupComment, "authorNickname" | "authorAvatar">): Promise<void> {
  await ensureTables();
  const now = comment.createdAt ?? new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GroupComment" (id, postId, authorId, content, imageUrl, parentId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    comment.id, comment.postId, comment.authorId, comment.content,
    comment.imageUrl ?? null, comment.parentId ?? null, now
  );
}

// ──────────────────────────────────────────
// 낚시단 멤버 역할 조회 — leader | sub_leader | member | pending | null
// ──────────────────────────────────────────

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

// ──────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────

function toStoredPost(r: any): StoredGroupPost {
  return {
    id: r.id,
    groupId: r.groupId,
    authorId: r.authorId,
    authorNickname: r.authorNickname ?? "알 수 없음",
    authorAvatar: r.authorAvatar ?? null,
    content: r.content,
    imageUrl: r.imageUrl ?? null,
    createdAt: String(r.createdAt),
  };
}

function toStoredComment(r: any): StoredGroupComment {
  return {
    id: r.id,
    postId: r.postId,
    authorId: r.authorId,
    authorNickname: r.authorNickname ?? "알 수 없음",
    authorAvatar: r.authorAvatar ?? null,
    content: r.content,
    imageUrl: r.imageUrl ?? null,
    createdAt: String(r.createdAt),
    parentId: r.parentId ?? null,
  };
}

// ──────────────────────────────────────────
// 하위 호환 shim (기존 API 라우트가 readGroupPosts() 등 동기 함수를 호출하는 경우 대비)
// API 라우트들은 이미 await 패턴을 쓰므로 async 버전만 export 한다.
// ──────────────────────────────────────────
// (이전: writeGroupPosts/writeGroupLikes/writeGroupComments 함수들은 제거됨)
