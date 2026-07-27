"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2 } from "lucide-react";

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
          className="pointer-events-auto absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-orange-500 px-5 py-3 text-[14px] font-semibold text-white shadow-fab transition-all active:scale-95 disabled:opacity-80 md:bottom-6 md:left-auto md:right-4 md:h-14 md:w-14 md:translate-x-0 md:justify-center md:p-0 md:shadow-xl md:shadow-black/40 md:ring-1 md:ring-orange-300/50"
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <ShoppingBag size={22} strokeWidth={2.1} />
          )}
          <span className="md:sr-only">판매하기</span>
        </button>
      </div>
      <div className="hidden w-[104px] shrink-0 md:block" aria-hidden />
    </div>
  );
}
