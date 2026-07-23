"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Square, Navigation, Radio } from "lucide-react";
import { useRecording } from "@/components/RecordingProvider";
import { km, stopwatch } from "@/lib/utils";

// 앱 어디서나 보이는 '기록 중' 표시 + 어디서든 중지. /map 에는 자체 컨트롤이 있어 숨김.
export function RecordingBanner() {
  const { status, elapsed, distance, finish } = useRecording();
  const pathname = usePathname() || "/";
  if (status === "idle") return null;
  if (pathname.startsWith("/map")) return null;

  const tracking = status === "tracking";
  return (
    <div className="sticky top-[52px] z-30 px-3.5 pt-2">
      <div className="mx-auto flex max-w-[640px] items-center gap-2.5 rounded-2xl border border-orange-500/30 bg-[#1a1a1a]/95 px-3.5 py-2.5 shadow-card backdrop-blur">
        <span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full " + (tracking ? "bg-orange-500/20 text-orange-500" : "bg-navy-100 text-navy-300")}>
          <Radio size={15} className={tracking ? "animate-pulse" : ""} />
        </span>
        <Link href="/map" className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-[13px] font-semibold text-navy-900">{tracking ? "기록 중" : "일시정지"}</span>
          <span className="font-mono text-[13px] font-bold text-orange-500">{stopwatch(elapsed)}</span>
          <span className="inline-flex items-center gap-1 text-[12px] text-navy-300">
            <Navigation size={12} />{km(distance)}
          </span>
        </Link>
        <button
          onClick={finish}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-red-500/90 px-3 py-1.5 text-[13px] font-semibold text-white btn-press transition-colors hover:bg-red-500 active:scale-[0.97]"
          aria-label="기록 중지"
        >
          <Square size={14} /> 중지
        </button>
      </div>
    </div>
  );
}
