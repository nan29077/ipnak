"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

/**
 * 청크 로드 실패인지 판별.
 * 모바일·터널(trycloudflare 등) 환경에서 /_next/static/chunks/* 요청이 끊기면
 * 클라이언트 라우팅 도중 ChunkLoadError가 나면서 이 에러 바운더리로 떨어진다.
 * (랜딩처럼 이미 로드된 페이지는 멀쩡하고, 새 청크가 필요한 페이지로
 *  이동할 때만 터지는 게 이 유형의 특징)
 */
function isChunkLoadError(error: Error) {
  return (
    error.name === "ChunkLoadError" ||
    /Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
      error.message ?? ""
    )
  );
}

// 새로고침으로도 안 고쳐지는 경우 무한 새로고침에 빠지지 않도록 1회만 시도
const RELOAD_KEY = "ipnak_chunk_reload";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  const chunkError = isChunkLoadError(error);

  // ChunkLoadError + 아직 reload 미시도 → 화면 렌더 없이 즉시 reload 예정
  // (useEffect보다 먼저 판별해 에러 화면이 순간이라도 보이지 않도록 한다)
  const willAutoReload =
    chunkError &&
    typeof window !== "undefined" &&
    !sessionStorage.getItem(RELOAD_KEY);

  useEffect(() => {
    // 모니터링 연동을 위해 콘솔에 기록
    console.error(error);

    if (chunkError && typeof window !== "undefined") {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        // 청크가 유실된 상태라 클라이언트 라우팅(reset)으로는 복구되지 않는다 → 하드 리로드
        window.location.reload();
      }
    } else if (typeof window !== "undefined") {
      sessionStorage.removeItem(RELOAD_KEY);
    }
  }, [error, chunkError]);

  // 자동 새로고침 예정이면 빈 화면 반환 (에러 UI 노출 없음)
  if (willAutoReload) return null;

  return (
    <div className="animate-fadein flex min-h-[70vh] items-center justify-center px-4">
      <Card className="flex w-full max-w-sm flex-col items-center gap-3 p-8 text-center">
        <div className="rounded-full bg-red-50 p-5">
          <TriangleAlert className="text-red-500" size={40} strokeWidth={1.6} />
        </div>
        <h1 className="text-lg font-bold text-navy-800">문제가 발생했어요</h1>
        <p className="max-w-xs text-sm leading-relaxed text-navy-400">
          {chunkError
            ? "네트워크가 불안정해 페이지 파일을 받지 못했어요. 다시 시도해 주세요."
            : "페이지를 불러오는 중 오류가 생겼어요. 잠시 후 다시 시도해 주세요."}
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset} leftIcon={<RotateCcw size={18} />}>
            다시 시도
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem(RELOAD_KEY);
                window.location.reload();
              }
            }}
          >
            새로고침
          </Button>
        </div>

        {/* 실제 에러 내용 — 개발 환경에서는 기기에서 바로 확인할 수 있어야 한다.
            (모바일·터널 테스트 중에는 devtools 콘솔을 볼 수 없어 원인 파악이 불가능했음) */}
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-3 w-full text-left">
            <button
              type="button"
              onClick={() => setDetailOpen((v) => !v)}
              className="text-xs font-semibold text-navy-400 underline"
            >
              {detailOpen ? "오류 상세 숨기기" : "오류 상세 보기"}
            </button>
            {detailOpen && (
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-navy-50 p-3 text-[11px] leading-relaxed text-navy-700">
                {error.name}: {error.message}
                {error.digest ? `\n\ndigest: ${error.digest}` : ""}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
