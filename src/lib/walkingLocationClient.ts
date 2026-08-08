"use client";

/**
 * 잠긴 워킹 피드 카드의 수계명 조회 (클라이언트 전용)
 *
 * 한 화면에 잠긴 카드가 여러 장 있으면 동시에 조회 요청이 나가는데, 캐시가 없는 글은
 * 서버에서 Overpass API 를 호출하므로 동시 요청은 rate limit 을 유발한다.
 * → 요청을 한 건씩 직렬로 흘려보내고, 조회한 결과는 세션 동안 메모리에 캐시한다.
 */

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
/** 직렬 실행용 체인 — 앞 요청이 끝난 뒤 다음 요청을 보낸다 */
let queue: Promise<unknown> = Promise.resolve();

export function fetchWalkingLocationLabel(postId: string): Promise<string | null> {
  const cached = cache.get(postId);
  if (cached !== undefined) return Promise.resolve(cached);

  const pending = inflight.get(postId);
  if (pending) return pending;

  const task = queue.then(async () => {
    try {
      const res = await fetch(`/api/walking/${postId}/location`);
      const data = await res.json();
      const label = typeof data?.label === "string" && data.label ? data.label : null;
      cache.set(postId, label);
      return label;
    } catch {
      // 실패는 캐시하지 않는다 — 다음 렌더에서 재시도 가능
      return null;
    } finally {
      inflight.delete(postId);
    }
  });

  inflight.set(postId, task);
  queue = task.catch(() => null);
  return task;
}
