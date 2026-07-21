"use client";
import { FeedCard } from "@/components/FeedCard";
import { CommunityTabs } from "@/components/CommunityTabs";
import { EmptyState } from "@/components/ui";
import { Route } from "lucide-react";
import type { FeedPost } from "@/lib/queries";

export function WalkingFeedPage({ posts, currentUserId }: { posts: FeedPost[]; currentUserId?: string }) {
  return (
    <div className="bg-[#161616]">
      <CommunityTabs />
      <div className="px-4 pb-3 pt-2">
        <h1 className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-tight text-navy-900">
          <Route size={17} className="text-aqua-300" /> 워킹 피드
        </h1>
        <p className="mt-0.5 text-[12px] text-navy-400">데이터피싱 동선 기록을 모아봤어요</p>
      </div>
      {posts.length === 0 ? (
        <EmptyState title="워킹 피드가 없습니다" desc="데이터피싱 기록 후 피드에 올려보세요" />
      ) : (
        <div className="md:py-3">
          {posts.map((p) => <FeedCard key={p.id} post={p} currentUserId={currentUserId} />)}
        </div>
      )}
    </div>
  );
}
