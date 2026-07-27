"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * 채팅 전용 헤더.
 * PageHeader는 'sticky top-[52px]'를 사용해 채팅 레이아웃 안에서 상품 카드 위로 겹치는 문제가 있음.
 * 이 컴포넌트는 sticky 없이 순수 shrink-0 flex 아이템으로 렌더링.
 */
export function ChatPageHeader({ nickname, sub }: { nickname: string; sub: string }) {
  const router = useRouter();
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-navy-100/20 bg-[#0d1b2a] px-3">
      <button
        onClick={() => { if (window.history.length > 1) router.back(); else router.replace("/market/chats"); }}
        aria-label="뒤로"
        className="-ml-1 rounded-full p-1.5 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100"
      >
        <ChevronLeft size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold tracking-[-0.01em] text-navy-900">{nickname}</p>
        <p className="truncate text-[11px] text-navy-300">{sub}</p>
      </div>
    </div>
  );
}
