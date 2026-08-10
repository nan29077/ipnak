"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";
import {
  isChunkLoadError,
  getChunkReloadCount,
  chunkHardReload,
  reportClientError,
  MAX_CHUNK_RELOADS,
} from "@/lib/clientErrorRecovery";

/**
 * 청크 로드 실패(ChunkLoadError)는 배포 직후 옛 청크가 사라졌거나 캐시가 낡았을 때
 * 클라이언트 라우팅 도중 터진다. reset()으로는 복구되지 않으므로 하드 리로드가 필요하다.
 *
 * 재시도 횟수는 sessionStorage 가 아니라 URL 파라미터(_cr)로 센다.
 * NFC 태그 진입은 탭마다 새로 열려 sessionStorage 가 항상 초기화되고,
 * location.reload() 는 캐시를 재사용해 같은 에러가 재발했기 때문.
 * → 캐시버스터를 붙인 location.replace() 로 최대 2회 자동 재시도.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  const chunkError = isChunkLoadError(error);
  const reloadCount = getChunkReloadCount();

  // ChunkLoadError + 재시도 여유 있음 → 화면 렌더 없이 즉시 캐시버스터 리로드
  // (useEffect보다 먼저 판별해 에러 화면이 순간이라도 보이지 않도록 한다)
  const willAutoReload =
    chunkError && typeof window !== "undefined" && reloadCount < MAX_CHUNK_RELOADS;

  useEffect(() => {
    // 모니터링 연동을 위해 콘솔 + 서버 로그(pm2 logs 의 [client-error])에 기록
    console.error(error);
    reportClientError(error, "error");
    if (willAutoReload) chunkHardReload(reloadCount + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

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
          <Button
            onClick={() => {
              // 청크 유실은 클라이언트 라우팅(reset)으로 복구되지 않는다 → 하드 리로드
              if (chunkError) chunkHardReload(1);
              else reset();
            }}
            leftIcon={<RotateCcw size={18} />}
          >
            다시 시도
          </Button>
          <Button
            variant="ghost"
            onClick={() => chunkHardReload(1)}
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
