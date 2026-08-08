"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  listingId, initialFavorited, initialCount, variant = "icon",
}: { listingId: string; initialFavorited: boolean; initialCount: number; variant?: "icon" | "bar" }) {
  const router = useRouter();
  const toast = useToast();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);

    // 1) Optimistic update — 클릭 즉시 UI 반영
    const nextFavorited = !favorited;
    const delta = nextFavorited ? 1 : -1;
    setFavorited(nextFavorited);
    setCount((n) => Math.max(0, n + delta));
    window.dispatchEvent(new CustomEvent(`market-fav-${listingId}`, { detail: { delta } }));

    try {
      const res = await fetch(`/api/market/${listingId}/favorite`, { method: "POST" });
      if (res.ok) {
        // 2) 성공 → router.refresh()로 라우터 캐시 무효화
        //    (다른 페이지 다녀와도 서버에서 최신 찜 상태 조회)
        router.refresh();
      } else {
        // 3) 실패 → 롤백
        setFavorited(!nextFavorited);
        setCount((n) => Math.max(0, n - delta));
        window.dispatchEvent(new CustomEvent(`market-fav-${listingId}`, { detail: { delta: -delta } }));
        toast("로그인이 필요합니다", "error");
      }
    } catch {
      setFavorited(!nextFavorited);
      setCount((n) => Math.max(0, n - delta));
      window.dispatchEvent(new CustomEvent(`market-fav-${listingId}`, { detail: { delta: -delta } }));
      toast("오류가 발생했습니다", "error");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "bar") {
    return (
      <button
        onClick={toggle}
        aria-label="찜하기"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95",
          favorited ? "border-red-400/40 bg-red-500/10 text-red-400" : "border-navy-100 bg-[#162538] text-navy-400 hover:bg-navy-50"
        )}
      >
        <Heart size={22} className={cn(favorited && "fill-red-400")} />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
      aria-label="찜하기"
      className="inline-flex items-center gap-1 rounded-full bg-[#0d1b2a]/90 px-2 py-1 text-[12px] font-semibold text-navy-700 shadow-soft backdrop-blur-sm transition active:scale-95"
    >
      <Heart size={13} className={cn(favorited ? "fill-red-500 text-red-500" : "text-navy-500")} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
