"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { LatLng, MapMarker } from "@/lib/map";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-navy-50">
      <span className="inline-flex items-center gap-2 rounded-xl bg-white/90 px-3.5 py-2 text-sm font-medium text-navy-500 shadow-card">
        <Loader2 size={16} className="animate-spin text-aqua-500" /> 지도를 불러오는 중...
      </span>
    </div>
  ),
});

export function MapView(props: {
  center: LatLng; route?: LatLng[]; markers?: MapMarker[]; zoom?: number;
  onMarkerClick?: (m: MapMarker) => void;
}) {
  return <MapCanvas {...props} />;
}
