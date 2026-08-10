"use client";

import { useEffect } from "react";
import {
  isChunkLoadError,
  getChunkReloadCount,
  chunkHardReload,
  reportClientError,
  MAX_CHUNK_RELOADS,
} from "@/lib/clientErrorRecovery";

/**
 * 루트 레이아웃까지 뚫고 나온 에러의 최종 방어선.
 *
 * ChunkLoadError 복구는 sessionStorage 가 아니라 URL 파라미터(_cr)로 횟수를 센다.
 * NFC 태그는 탭마다 새로 열려 sessionStorage 가 항상 비어 있고,
 * location.reload() 는 캐시를 재사용해 같은 청크 404 가 재발했기 때문.
 * → 캐시버스터를 붙인 location.replace() 로 최대 2회 자동 재시도,
 *   그동안은 화면에 아무것도 그리지 않는다 (에러 화면 깜빡임 없음).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  const reloadCount = getChunkReloadCount();

  // ChunkLoadError + 재시도 여유 있음 → UI 없이 즉시 캐시버스터 리로드
  const willAutoReload =
    chunkError && typeof window !== "undefined" && reloadCount < MAX_CHUNK_RELOADS;

  useEffect(() => {
    console.error(error);
    // 실제 원인 파악용 서버 로그 (pm2 logs 에서 [client-error] 로 확인)
    reportClientError(error, "global-error");
    if (willAutoReload) chunkHardReload(reloadCount + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  if (willAutoReload) return null;

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f4f6f9",
          color: "#16243d",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            앱에 문제가 발생했어요
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#5b6b85", margin: "0 0 20px" }}>
            {chunkError
              ? "네트워크가 불안정해 앱 파일을 받지 못했어요. 다시 시도해 주세요."
              : "예기치 못한 오류가 생겼어요. 페이지를 새로고침해 주세요."}
          </p>
          <button
            onClick={() => {
              // 청크 유실은 클라이언트 라우팅(reset)으로 복구되지 않는다 → 하드 리로드
              if (chunkError) chunkHardReload(1);
              else reset();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 12,
              border: "none",
              background: "#1f3a63",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              padding: "12px 20px",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
