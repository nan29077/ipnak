"use client";
import { useMemo, useState } from "react";
import { FeedHeader } from "@/components/FeedHeader";
import { FeedCard } from "@/components/FeedCard";
import { EmptyState, LinkButton } from "@/components/ui";
import type { FeedPost } from "@/lib/queries";

export function FeedList({ posts, currentUserId, banners }: { posts: FeedPost[]; currentUserId?: string; banners?: { title: string; imageUrl: string | null }[] }) {
  const [filter, setFilter] = useState("ALL");
  const visible = useMemo(
    () => (filter === "ALL" ? posts : posts.filter((p) => p.postType === filter)),
    [posts, filter]
  );

  return (
    <div className="bg-[#f4f6f9]">
      <FeedHeader onFilter={setFilter} />
      {banners && banners.length > 0 && (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-3 no-scrollbar">
          {banners.map((b, i) => (
            <div key={i} className="relative h-32 w-[18rem] shrink-0 snap-start overflow-hidden rounded-2xl bg-navy-700 shadow-card">
              {b.imageUrl && <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover opacity-85 transition-transform duration-500 hover:scale-105" />}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-navy-950/80 via-navy-900/20 to-transparent p-3.5">
                <p className="text-[15px] font-bold leading-snug text-white drop-shadow-sm">{b.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <EmptyState title="게시글이 없습니다" desc="첫 낚시 기록을 올려보세요" action={<LinkButton href="/catch/new">기록하기</LinkButton>} />
      ) : (
        <div className="md:py-3">
          {visible.map((p) => <FeedCard key={p.id} post={p} currentUserId={currentUserId} />)}
        </div>
      )}
    </div>
  );
}
