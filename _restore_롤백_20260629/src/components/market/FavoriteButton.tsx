"use client";
import { useState } from "react";
import { Heart } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  listingId, initialFavorited, initialCount, variant = "icon",
}: { listingId: string; initialFavorited: boolean; initialCount: number; variant?: "icon" | "bar" }) {
  const toast = useToast();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/market/${listingId}/favorite`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setFavorited(data.favorited);
      setCount(data.count);
    } else {
      toast("로그인이 필요합니다", "error");
    }
    setBusy(false);
  }

  if (variant === "bar") {
    return (
      <button
        onClick={toggle}
        aria-label="찜하기"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors",
          favorited ? "border-red-200 bg-red-50 text-red-500" : "border-navy-100 bg-[#1e1e1e] text-navy-400 hover:bg-navy-50"
        )}
      >
        <Heart size={22} className={cn(favorited && "fill-red-500")} />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
      aria-label="찜하기"
      className="inline-flex items-center gap-1 rounded-full bg-[#161616]/90 px-2 py-1 text-[12px] font-semibold text-navy-700 shadow-soft backdrop-blur-sm transition active:scale-95"
    >
      <Heart size={13} className={cn(favorited ? "fill-red-500 text-red-500" : "text-navy-500")} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
