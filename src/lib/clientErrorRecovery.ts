"use client";
/**
 * 에러 바운더리(error.tsx / global-error.tsx) 공용 복구 유틸
 *
 * ChunkLoadError 자동 복구가 sessionStorage 기반이면 NFC 태그 진입에서 깨진다:
 *   태그마다 새 탭 → sessionStorage 는 항상 비어 있음 → location.reload()
 *   → reload 는 캐시를 그대로 재사용하므로 같은 청크 404 재발
 *   → 이번엔 sessionStorage 키가 있어 에러 화면 노출.
 *
 * 그래서 재시도 횟수를 URL 파라미터(_cr)로 들고 다니고,
 * 캐시버스터(_cb)를 붙인 location.replace() 로 HTML 을 새로 받아온다.
 * (URL 이 매번 달라져 iOS Safari 의 HTML/청크 캐시를 우회한다)
 */

/** 청크 자동 재시도 횟수 URL 파라미터 */
export const CHUNK_RELOAD_PARAM = "_cr";
/** 캐시버스터 URL 파라미터 */
const CACHE_BUSTER_PARAM = "_cb";
/** 자동 재시도 최대 횟수 (초과 시에만 에러 UI 노출) */
export const MAX_CHUNK_RELOADS = 2;

/** 청크/모듈 로드 실패 여부 판별 (iOS Safari 포함) */
export function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    /Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload/i.test(
      error.message ?? ""
    )
  );
}

/** 현재 URL 에 기록된 자동 재시도 횟수 */
export function getChunkReloadCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(new URLSearchParams(window.location.search).get(CHUNK_RELOAD_PARAM));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * 캐시버스터를 붙여 하드 리로드.
 * @param nextCount URL 에 기록할 재시도 횟수 (자동: 현재+1, 수동 버튼: 1)
 */
export function chunkHardReload(nextCount: number) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(CHUNK_RELOAD_PARAM, String(nextCount));
    url.searchParams.set(CACHE_BUSTER_PARAM, Date.now().toString(36));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * 에러 내용을 서버(pm2 로그)로 전송 — 폰에서만 재현되는 에러의 원인 파악용.
 * 실패해도 무시 (복구 흐름에 영향 없음).
 */
export function reportClientError(error: Error & { digest?: string }, boundary: "error" | "global-error") {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      boundary,
      name: String(error?.name ?? "").slice(0, 200),
      message: String(error?.message ?? "").slice(0, 1000),
      stack: String(error?.stack ?? "").slice(0, 4000),
      digest: error?.digest ?? null,
      url: window.location.href.slice(0, 500),
      ua: navigator.userAgent?.slice(0, 300) ?? null,
      chunkReloadCount: getChunkReloadCount(),
    });
    fetch("/api/debug/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}
