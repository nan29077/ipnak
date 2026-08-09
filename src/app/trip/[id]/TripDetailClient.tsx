"use client";
/**
 * /trip/[id] 페이지의 인터랙티브 클라이언트 컴포넌트
 *
 * 서버 컴포넌트(page.tsx)에서 분리해 관리한다.
 * - 동선 지도 + 크게보기 버튼 (풀스크린 모달)
 * - 카카오톡/공유/이미지저장 버튼 (TripShareActions 재사용)
 *
 * captureRef 는 이 컴포넌트 내부에 두어 전체 지도 영역 + 피쉬 기록을
 * PNG 로 캡처할 수 있게 한다.
 */
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";
import dynamic from "next/dynamic";
import { TripShareActions, CAPTURE_IGNORE_ATTR } from "@/components/TripShareActions";

// Leaflet/지도 컴포넌트 — SSR 비활성
const MiniRouteMap = dynamic(
  () => import("@/components/MiniRouteMap").then((m) => m.MiniRouteMap),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#0d1b2a]" /> }
);

type RoutePoint = { lat: number; lng: number };

type Props = {
  tripId: string;
  routePoints: RoutePoint[];
  catchPoints: RoutePoint[];
  shareTitle: string;
  shareDescription: string;
  thumbnailUrl?: string | null;
  fileName: string;
};

export function TripDetailClient({
  tripId,
  routePoints,
  catchPoints,
  shareTitle,
  shareDescription,
  thumbnailUrl,
  fileName,
}: Props) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div ref={captureRef} className="space-y-3">
      {/* ── 동선 지도 (크게보기 포함) ── */}
      {routePoints.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">
              동선 지도
            </p>
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              style={{ backgroundColor: "#eab308", color: "#0d1b2a" }}
              className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
              {...{ [CAPTURE_IGNORE_ATTR]: "" }}
            >
              <ZoomIn size={12} />
              크게보기
            </button>
          </div>
          <div className="h-52 w-full overflow-hidden rounded-2xl border border-navy-100">
            <MiniRouteMap points={routePoints} catchPoints={catchPoints} />
          </div>
        </div>
      )}

      {/* ── 공유 / 이미지 저장 버튼 ── */}
      <TripShareActions
        captureRef={captureRef}
        title={shareTitle}
        description={shareDescription}
        thumbnailUrl={thumbnailUrl}
        tripId={tripId}
        kakaoTitle={shareTitle}
        fileName={fileName}
      />

      {/* ── 크게보기 풀스크린 모달 ── */}
      {mapOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex flex-col bg-[#0d1b2a]"
            role="dialog"
            aria-modal="true"
            aria-label="동선 지도 전체보기"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-navy-100/20 px-4 py-3">
              <p className="text-[14px] font-bold text-navy-800">동선 지도</p>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                aria-label="닫기"
                className="rounded-full p-2 text-navy-400 transition-colors hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MiniRouteMap
                points={routePoints}
                catchPoints={catchPoints}
                interactive
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
