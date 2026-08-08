"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const Canvas = dynamic(() => import("./PointMiniMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-navy-50">
      <Loader2 size={16} className="animate-spin text-aqua-500" />
    </div>
  ),
});

/**
 * 포인트 위치 미니 지도.
 * dragging=false 로 두면 순수 미리보기가 된다 — 시트 안에서 스크롤과 지도 드래그가
 * 서로 먹히는 문제를 피하고, 확대는 전체화면 지도에서 하도록 유도한다.
 */
export function PointMiniMap({
  lat, lng, label, zoom, dragging,
}: { lat: number; lng: number; label?: string; zoom?: number; dragging?: boolean }) {
  return (
    <div className="h-32 w-full overflow-hidden rounded-xl border border-navy-100">
      <Canvas lat={lat} lng={lng} label={label} zoom={zoom} dragging={dragging} />
    </div>
  );
}
