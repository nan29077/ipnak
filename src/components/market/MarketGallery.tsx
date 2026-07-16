"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MarketGallery({ images, dim, statusLabel }: { images: string[]; dim?: boolean; statusLabel?: string | null }) {
  const [idx, setIdx] = useState(0);
  const multi = images.length > 1;
  return (
    <div className="relative aspect-square w-full select-none bg-navy-50">
      <img src={images[idx]} alt={`상품 사진 ${idx + 1}`} decoding="async" className={cn("h-full w-full object-cover", dim && "opacity-60")} />
      {statusLabel && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="rounded-full bg-black/80 px-4 py-1.5 text-[15px] font-bold text-white">{statusLabel}</span>
        </div>
      )}
      {multi && (
        <>
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white disabled:opacity-0" aria-label="이전 사진"><ChevronLeft size={20} /></button>
          <button onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))} disabled={idx === images.length - 1}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white disabled:opacity-0" aria-label="다음 사진"><ChevronRight size={20} /></button>
          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((_, i) => <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i === idx ? "bg-white" : "bg-white/55")} />)}
          </div>
        </>
      )}
    </div>
  );
}
