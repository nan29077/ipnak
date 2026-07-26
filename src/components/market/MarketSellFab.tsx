"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

/**
 * 중고피싱 판매하기 FAB
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
    <button
      onClick={handleClick}
      disabled={loading}
      className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-orange-500 px-5 py-3 text-[14px] font-semibold text-white shadow-fab transition-transform active:scale-95 disabled:opacity-80 md:bottom-8 md:left-auto md:right-8 md:translate-x-0"
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={2.4} />}
      판매하기
    </button>
  );
}
