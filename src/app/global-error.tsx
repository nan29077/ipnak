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
 * - iOS Safari 는 ChunkLoadError 이름·메시지가 달라 isChunkLoadError() 감지에서 빠질 수 있다.
 * - global-error 는 SSR 단계에서도 에러 UI 를 렌더해 브라우저에 보낼 수 있다.
 * 이 두 이유로 에러 종류와 무관하게 재시도 여유가 있는 동안에는
 *   ① 화면을 비워두고(에러 UI 미노출)
 *   ② 캐시버스터를 붙인 location.replace() 로 하드 리로드한다.
 * MAX_CHUNK_RELOADS 회 소진 후에만 에러 UI 를 표시한다.
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

  // 에러 종류 무관: 재시도 여유가 있으면 항상 빈 화면 + 캐시버스터 리로드
  // (iOS Safari 는 ChunkLoadError 감지가 불완전하므로 isChunkLoadError 에 의존하지 않는다)
  const willAutoReload =
    typeof window !== "undefined" && reloadCount < MAX_CHUNK_RELOADS;

  useEffect(() => {
    console.error(error);
    // 실제 원인 파악용 서버 로그 (pm2 logs 에서 [client-error] 로 확인)
    reportClientError(error, "global-error");
    if (willAutoReload) chunkHardReload(reloadCount + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // 자동 리로드 예정 → 빈 화면만 반환 (에러 UI 노출 없음)
  if (willAutoReload) {
    return (
      <html lang="ko">
        <body style={{ margin: 0, background: "#f4f6f9" }} />
      </html>
    );
  }

  return (
    <html lang="ko">
      <head>
        {/*
         * SSR 에러(레이아웃/서버 컴포넌트 크래시) 발생 시 React hydration 없이도
         * 캐시버스터를 붙여 자동 재시도한다.
         * - _cr=0(최초 방문)일 때만 한 번 재시도 → _cr=1 로 이동.
         * - React가 클라이언트에서 이 컴포넌트를 렌더할 때는
         *   dangerouslySetInnerHTML script 가 실행되지 않으므로 useEffect 와 충돌 없음.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=new URLSearchParams(location.search),n=+p.get('_cr')||0;if(!n){var u=new URL(location.href);u.searchParams.set('_cr','1');u.searchParams.set('_cb',Date.now().toString(36));location.replace(u.toString());}}catch(e){}})()`,
          }}
        />
      </head>
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
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
            {/* 탈출구: 어떤 오류든 홈으로 이동할 수 있도록 항상 노출 */}
            <button
              onClick={() => {
                if (typeof window !== "undefined") window.location.href = "/";
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 12,
                border: "1px solid #c8d3e0",
                background: "transparent",
                color: "#5b6b85",
                fontSize: 15,
                fontWeight: 600,
                padding: "12px 20px",
                cursor: "pointer",
              }}
            >
              홈으로
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
