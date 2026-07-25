/**
 * 서버 메모리 기반 간단 Rate Limiter
 * - Next.js 서버리스 환경에서 단일 인스턴스에 적용 (멀티 프로세스 환경에선 각 프로세스 독립)
 */
const store = new Map<string, { count: number; resetAt: number }>();

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
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
