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
 * 클라이언트 IP 추출 (레이트 리밋 키 용도).
 * - X-Forwarded-For 는 클라이언트가 임의 값을 붙여 보낼 수 있어 스푸핑에 취약하다.
 * - 신뢰 우선순위: 프록시(Nginx)가 직접 설정하는 x-real-ip → XFF 의 "마지막" IP(프록시가 추가한 값).
 *   (첫 번째 IP 는 클라이언트가 위조해 넣을 수 있으므로 사용하지 않는다)
 * - 개발 환경에서는 항상 127.0.0.1 로 처리한다.
 */
export function getClientIp(req: Request): string {
  if (process.env.NODE_ENV !== "production") return "127.0.0.1";
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
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
