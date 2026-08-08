"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const Canvas = dynamic(() => import("@/components/map/MiniRouteMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-navy-50">
      <Loader2 size={16} className="animate-spin text-aqua-500" />
    </div>
  ),
});

type Point = { lat: number; lng: number };

export function MiniRouteMap({ points, catchPoints, interactive }: { points: Point[]; catchPoints?: Point[]; interactive?: boolean }) {
  return <Canvas points={points} catchPoints={catchPoints} interactive={interactive} />;
}
