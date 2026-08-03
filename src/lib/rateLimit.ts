/**
 * 서버 메모리 기반 간단 Rate Limiter
 * - Next.js 서버리스 환경에서 단일 인스턴스에 적용 (멀티 프로세스 환경에선 각 프로세스 독립)
 */
const store = new Map<string, { count: number; resetAt: number }>();

// 키(IP·회원 ID)는 계속 새로 생기지만 지워지는 곳이 없어 프로세스가 오래 살면 Map 이 무한히 커진다.
// 새 윈도우를 열 때만, 그리고 항목이 일정 수를 넘었을 때만 만료분을 한 번에 청소한다.
const MAX_ENTRIES = 5000;
function pruneExpired(now: number) {
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * @param key     - 제한 대상 식별자 (예: `"scan:127.0.0.1"`)
 * @param limit   - 윈도우 내 최대 허용 횟수
 * @param windowMs - 윈도우 크기 (ms)
 * @returns true = 허용, false = 차단
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    if (store.size > MAX_ENTRIES) pruneExpired(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
