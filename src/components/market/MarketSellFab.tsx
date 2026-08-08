"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, Loader2 } from "lucide-react";

/**
 * 중고마켓 판매하기 FAB
 * - 마운트 시 /market/new를 router.prefetch로 미리 로드
 * - 클릭 시 즉각 로딩 피드백 후 이동
 */
export function MarketSellFab() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 컴포넌트 마운트 시 /market/new 번들을 미리 prefetch
  useEffect(() => {
    router.prefetch("/market/new");
  }, [router]);

  function handleClick() {
    if (loading) return;
    setLoading(true);
    router.push("/market/new");
    // 2초 후 자동 리셋 (뒤로가기 등 예외 처리)
    setTimeout(() => setLoading(false), 2000);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 top-0 z-40 mx-auto flex w-full max-w-[760px] justify-center">
      <div className="relative w-full max-w-[640px]">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          aria-label="중고마켓 판매하기"
          title="판매하기"
          className="pointer-events-auto absolute right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] flex h-14 w-14 items-center justify-center rounded-full bg-[#122030] text-orange-500 shadow-xl shadow-black/40 ring-1 ring-orange-500/40 transition-all hover:bg-[#232323] hover:ring-orange-500/70 active:scale-95 disabled:opacity-80 md:bottom-6"
        >
          {loading ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <Tag size={22} strokeWidth={2} />
          )}
        </button>
      </div>
      <div className="hidden w-[104px] shrink-0 md:block" aria-hidden />
    </div>
  );
}
