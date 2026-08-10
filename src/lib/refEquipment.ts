/**
 * 계측 기준물(입낚볼 · 입낚키링) 연동 여부 확인.
 *
 * AI 측정은 크기를 아는 기준물이 사진에 함께 찍혀야 성립한다.
 * 계정에 연동된 기준물이 하나도 없으면 카메라를 열지 않고 등록을 먼저 안내한다.
 *
 * 조회에 실패한 경우(네트워크 오류·비로그인 401 등)는 "unknown" 으로 두고 통과시킨다.
 * 일시적인 오류 때문에 측정 자체가 막히는 쪽이 더 나쁘기 때문이다.
 * (비로그인은 각 진입점의 로그인 안내가 따로 처리한다)
 */
export type RefLinkStatus = "has" | "none" | "unknown";

let cached: RefLinkStatus | null = null;
let inflight: Promise<RefLinkStatus> | null = null;

async function fetchCount(url: string, key: string): Promise<{ ok: boolean; count: number }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, count: 0 };
    const data = await res.json();
    const arr = data?.[key];
    return { ok: true, count: Array.isArray(arr) ? arr.length : 0 };
  } catch {
    return { ok: false, count: 0 };
  }
}

/** 이미 확인한 결과가 있으면 즉시 반환 (없으면 null) */
export function getCachedRefLinkStatus(): RefLinkStatus | null {
  return cached;
}

/** 연동 상태 조회 — 세션 동안 1회만 실제 요청하고 이후에는 캐시를 쓴다 */
export function checkRefLink(): Promise<RefLinkStatus> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    const run = (async (): Promise<RefLinkStatus> => {
      const [balls, keyrings] = await Promise.all([
        fetchCount("/api/balls", "balls"),
        fetchCount("/api/keyrings", "keyrings"),
      ]);
      let status: RefLinkStatus;
      if (balls.count > 0 || keyrings.count > 0) status = "has";
      // 둘 다 정상 응답인데 0건일 때만 "없음"으로 확정한다
      else if (balls.ok && keyrings.ok) status = "none";
      else status = "unknown";
      cached = status;
      return status;
    })();
    inflight = run;
    void run.finally(() => { inflight = null; });
  }
  return inflight;
}

/** 볼·키링을 등록/해제했거나 로그아웃했을 때 — 다음 조회에서 다시 확인한다 */
export function invalidateRefLink() {
  cached = null;
}
