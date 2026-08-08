import "server-only";
/**
 * NFC 태그 URL 랜딩(/ball?id=XXX, /keyring?id=XXX) 상태 판별
 *
 * 분기 (볼·키링 동일)
 *   invalid  : 레지스트리에 없거나 비활성 ID          → 안내 페이지
 *   mine     : 내 계정에 이미 등록된 ID               → 계측 화면으로 즉시 이동
 *   taken    : 다른 사용자에게 등록된 ID              → "다른 사용자의 볼입니다" 안내
 *   new      : 아무에게도 등록되지 않은 ID            → 등록 확인 후 등록
 */
import { prisma } from "@/lib/prisma";
import { ensureKeyringTables } from "@/lib/ensureKeyringTables";

export type TagStatus = "invalid" | "mine" | "taken" | "new" | "error";

/** 태그 URL 로 들어온 ID 를 정규화한다. 형식이 어긋나면 null */
export function normalizeTagId(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = (value ?? "").trim().toUpperCase();
  if (!id || !/^[A-Z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

/** 입낚볼 태그 상태 판별 */
export async function resolveBallTag(ballId: string, userId: string | null): Promise<TagStatus> {
  try {
    const registryRows = await prisma.$queryRawUnsafe<[{ cnt: number }]>(
      `SELECT COUNT(*) as cnt FROM IpnakBallRegistry WHERE ballId = ? AND isActive = 1`,
      ballId
    );
    if (Number(registryRows[0]?.cnt ?? 0) === 0) return "invalid";
    if (!userId) return "new"; // 호출부가 로그인 여부를 먼저 처리한다 (방어적 기본값)

    const owner = await prisma.linkedBall.findFirst({
      where: { ballId },
      select: { userId: true },
    });
    if (!owner) return "new";
    return owner.userId === userId ? "mine" : "taken";
  } catch (e) {
    // DB 장애 시 500 대신 폴백 — 호출부가 계측 화면으로 보낸다
    console.error("[tagLanding] resolveBallTag DB 오류", e);
    return "error";
  }
}

/** 입낚키링 태그 상태 판별 (볼과 동일 규칙, 테이블만 다름) */
export async function resolveKeyringTag(keyringId: string, userId: string | null): Promise<TagStatus> {
  try {
    await ensureKeyringTables();
    const registryRows = await prisma.$queryRawUnsafe<[{ cnt: number }]>(
      `SELECT COUNT(*) as cnt FROM IpnakKeyringRegistry WHERE keyringId = ? AND isActive = 1`,
      keyringId
    );
    if (Number(registryRows[0]?.cnt ?? 0) === 0) return "invalid";
    if (!userId) return "new";

    const rows = await prisma.$queryRawUnsafe<{ userId: string }[]>(
      `SELECT userId FROM LinkedKeyring WHERE keyringId = ? LIMIT 1`,
      keyringId
    );
    if (rows.length === 0) return "new";
    return rows[0].userId === userId ? "mine" : "taken";
  } catch (e) {
    // DB 장애 시 500 대신 폴백 — 호출부가 계측 화면으로 보낸다
    console.error("[tagLanding] resolveKeyringTag DB 오류", e);
    return "error";
  }
}
