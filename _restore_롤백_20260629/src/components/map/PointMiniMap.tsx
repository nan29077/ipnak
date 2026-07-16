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

export function PointMiniMap({ lat, lng, label, zoom }: { lat: number; lng: number; label?: string; zoom?: number }) {
  return (
    <div className="h-32 w-full overflow-hidden rounded-xl border border-navy-100">
      <Canvas lat={lat} lng={lng} label={label} zoom={zoom} />
    </div>
  );
}
