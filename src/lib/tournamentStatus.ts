import { prisma } from "@/lib/prisma";

export const TOURNAMENT_STATUSES = ["UPCOMING", "ONGOING", "ENDED"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

/**
 * 기간(startAt~endAt)만으로 결정되는 "실제" 대회 상태.
 * DB의 status 컬럼은 관리자가 생성 시 임의로 넣은 값이라 시간이 지나면 어긋난다.
 */
export function effectiveStatus(
  t: { startAt: Date; endAt: Date },
  now: Date = new Date(),
): TournamentStatus {
  if (now < t.startAt) return "UPCOMING";
  if (now > t.endAt) return "ENDED";
  return "ONGOING";
}

/** 지금 참가(계측 제출)를 받을 수 있는 대회인지 */
export function isSubmittable(t: { startAt: Date; endAt: Date }, now: Date = new Date()): boolean {
  return effectiveStatus(t, now) === "ONGOING";
}

// 페이지마다 호출되므로 짧은 스로틀을 둔다 (updateMany 3회 × 매 렌더 방지)
let lastSyncAt = 0;
const SYNC_INTERVAL_MS = 30_000;

/**
 * 기간이 지난/시작된 대회의 status 컬럼을 실제 상태로 동기화한다.
 * 크론이 없는 구조라 대회를 읽는 지점에서 lazy 하게 맞춘다.
 * 실패해도 페이지 렌더를 막지 않는다.
 */
export async function syncTournamentStatuses(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_INTERVAL_MS) return;
  lastSyncAt = now;
  const at = new Date(now);
  try {
    await prisma.$transaction([
      prisma.tournament.updateMany({
        where: { startAt: { gt: at }, status: { not: "UPCOMING" } },
        data: { status: "UPCOMING" },
      }),
      prisma.tournament.updateMany({
        where: { startAt: { lte: at }, endAt: { gte: at }, status: { not: "ONGOING" } },
        data: { status: "ONGOING" },
      }),
      prisma.tournament.updateMany({
        where: { endAt: { lt: at }, status: { not: "ENDED" } },
        data: { status: "ENDED" },
      }),
    ]);
  } catch (e) {
    console.error("[tournamentStatus] sync 실패", e);
    lastSyncAt = 0; // 다음 요청에서 재시도
  }
}

/* ───────────── KST 날짜 파싱 ───────────── */
// 관리자 폼의 <input type="date"> 는 "2026-08-02" 형태를 보낸다.
// new Date("2026-08-02") 는 UTC 자정 = KST 09:00 이라 하루가 9시간 밀린다.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 날짜 문자열 → KST 그날 00:00:00.000 */
export function kstDayStart(input: unknown): Date | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const s = input.trim();
  const d = DATE_ONLY.test(s) ? new Date(`${s}T00:00:00+09:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 날짜 문자열 → KST 그날 23:59:59.999 (종료일을 하루 전체로 취급) */
export function kstDayEnd(input: unknown): Date | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const s = input.trim();
  const d = DATE_ONLY.test(s) ? new Date(`${s}T23:59:59.999+09:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
