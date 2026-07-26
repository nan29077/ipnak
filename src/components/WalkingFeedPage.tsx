"use client";
import Link from "next/link";
import { Route, Navigation, Clock, Fish } from "lucide-react";
import { FeedCard } from "@/components/FeedCard";
import { CommunityTabs } from "@/components/CommunityTabs";
import { EmptyState } from "@/components/ui";
import { ViewToggle, useViewMode } from "@/components/FeedList";
import { km, duration } from "@/lib/utils";
import type { FeedPost } from "@/lib/queries";

export function WalkingFeedPage({ posts, currentUserId }: { posts: FeedPost[]; currentUserId?: string }) {
  const [viewMode, setViewMode] = useViewMode("ipnak_view_walking");

  return (
    <div className="bg-[#121212]">
      <CommunityTabs />
      <div className="flex items-center justify-between px-4 pb-3 pt-2">
        <div>
          <h1 className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-tight text-navy-900">
            <Route size={17} className="text-aqua-300" /> 워킹 피드
          </h1>
          <p className="mt-0.5 text-[12px] text-navy-400">스마트피싱 동선 기록을 모아봤어요</p>
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      {posts.length === 0 ? (
        <EmptyState title="워킹 피드가 없습니다" desc="스마트피싱 기록 후 피드에 올려보세요" />
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((p) => {
            let walkingData: { distanceM?: number; durationSec?: number; catchCount?: number } | null = null;
            try { walkingData = JSON.parse(p.body ?? "null"); } catch {}
            const thumb = p.images[0]?.url ?? null;
            return (
              <Link key={p.id} href={`/post/${p.id}`} className="relative aspect-square overflow-hidden bg-[#0d1b1a]">
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#0d2a1a] to-[#0a1a12]" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30">
                  <Route size={18} className="text-aqua-300" strokeWidth={1.5} />
                  {walkingData?.distanceM != null && (
                    <span className="text-[10px] font-bold text-white">{km(walkingData.distanceM)}</span>
                  )}
                  {(walkingData?.catchCount ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-aqua-300">
                      <Fish size={9} />{walkingData!.catchCount}마리
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="md:py-3">
          {posts.map((p) => <FeedCard key={p.id} post={p} currentUserId={currentUserId} linkToDetail />)}
        </div>
      )}
    </div>
  );
}
