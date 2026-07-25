// 채팅방 진입 시 서버 렌더링 대기 중 보여줄 스켈레톤
// MarketChatLayout과 동일한 fixed inset z-[60] 레이아웃으로 덮어씌움
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0d1b2a]">
      {/* 헤더 스켈레톤 */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-navy-100/20 px-4">
        <div className="h-8 w-8 animate-pulse rounded-full bg-navy-50/20" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 w-28 animate-pulse rounded-full bg-navy-50/20" />
          <div className="h-2.5 w-16 animate-pulse rounded-full bg-navy-50/10" />
        </div>
      </div>

      {/* 상품 카드 스켈레톤 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-navy-100/20 bg-[#0d2236] px-3.5 py-3">
        <div className="h-14 w-14 animate-pulse rounded-xl bg-navy-50/20" />
        <div className="flex flex-col gap-2">
          <div className="h-3.5 w-40 animate-pulse rounded-full bg-navy-50/20" />
          <div className="h-3 w-24 animate-pulse rounded-full bg-navy-50/10" />
        </div>
      </div>

      {/* 메시지 영역 스켈레톤 */}
      <div className="flex-1 space-y-3 overflow-hidden px-4 py-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <div
              className="animate-pulse rounded-2xl bg-navy-50/10"
              style={{ width: `${50 + (i * 13) % 30}%`, height: 38 }}
            />
          </div>
        ))}
      </div>

      {/* 입력창 스켈레톤 */}
      <div className="shrink-0 flex items-center gap-2 border-t border-navy-100/20 bg-[#0d1b2a] px-3 py-2.5">
        <div className="h-10 flex-1 animate-pulse rounded-full bg-navy-50/10" />
        <div className="h-10 w-10 animate-pulse rounded-full bg-orange-500/30" />
      </div>
    </div>
  );
}
