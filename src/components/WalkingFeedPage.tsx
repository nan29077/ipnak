"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Route, Fish, Lock, ChevronDown, Loader2 } from "lucide-react";
import { FeedCard } from "@/components/FeedCard";
import { CommunityTabs } from "@/components/CommunityTabs";
import { EmptyState } from "@/components/ui";
import { ViewToggle, useViewMode } from "@/components/FeedList";
import { HashtagSearchInput, SearchLoading, normalizeTagQuery, useDebouncedValue } from "@/components/FeedSearch";
import { km } from "@/lib/utils";
import { WaterBodyBadge, useWaterBodyLabel } from "@/components/WaterBodyBadge";
import type { FeedPost } from "@/lib/queries";

/** 썸네일 타일용 수계명 — 훅을 타일마다 쓰기 위해 별도 컴포넌트로 분리 */
function WalkingTileWaterBody({ post }: { post: FeedPost }) {
  const label = useWaterBodyLabel(post.id, post.locationLabel, post.walkingLocked);
  return <WaterBodyBadge label={label} size="sm" />;
}

export function WalkingFeedPage({
  posts: initialPosts,
  currentUserId,
  nextCursor: initialNextCursor,
}: {
  posts: FeedPost[];
  currentUserId?: string;
  nextCursor?: string | null;
}) {
  const [viewMode, setViewMode] = useViewMode("ipnak_view_walking");
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // 해시태그 서버사이드 검색 — 입력이 300ms 멈춘 뒤에만 요청을 보낸다
  const activeTag = normalizeTagQuery(useDebouncedValue(tagQuery, 300));
  const searching = activeTag !== "";

  // 최초 렌더는 서버가 내려준 목록을 그대로 쓴다(불필요한 재요청 방지)
  const mounted = useRef(false);
  // 검색어를 지웠을 때 되돌릴 기준값
  const initialRef = useRef({ posts: initialPosts, cursor: initialNextCursor ?? null });

  useEffect(() => {
    const isFirst = !mounted.current;
    mounted.current = true;
    if (isFirst && !activeTag) return;

    if (!activeTag) {
      setSearchLoading(false);
      setPosts(initialRef.current.posts);
      setCursor(initialRef.current.cursor);
      return;
    }

    let alive = true;
    setSearchLoading(true);
    const qs = new URLSearchParams({ limit: "12", tag: activeTag });
    fetch(`/api/posts/walking?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        // 커서 초기화 + 기존 결과 교체
        setPosts(data.posts ?? []);
        setCursor(data.nextCursor ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setPosts([]);
        setCursor(null);
      })
      .finally(() => { if (alive) setSearchLoading(false); });
    return () => { alive = false; };
  }, [activeTag]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      // 검색 중이면 같은 tag 를 유지한 채 다음 페이지를 이어 받는다
      const qs = new URLSearchParams({ cursor, limit: "12" });
      if (activeTag) qs.set("tag", activeTag);
      const res = await fetch(`/api/posts/walking?${qs.toString()}`);
      const data = await res.json();
      if (data.posts?.length) {
        setPosts((prev) => [...prev, ...data.posts]);
      }
      setCursor(data.nextCursor ?? null);
    } catch {
      // 실패 시 무시
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="bg-[#121212]">
      <CommunityTabs />
      {/* 해시태그 검색 — 토글 버튼 줄과 분리된 별도 줄에 항상 표시한다 */}
      <div className="px-4 pb-2 pt-2">
        <HashtagSearchInput value={tagQuery} onChange={setTagQuery} className="w-full" />
      </div>
      <div className="flex items-center justify-between px-4 pb-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-tight text-navy-900">
            <Route size={17} className="text-aqua-300" /> 워킹 피드
          </h1>
          <p className="mt-0.5 text-[12px] text-navy-400">스마트피싱 동선 기록을 모아봤어요</p>
        </div>
        <div className="shrink-0">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>
      {searchLoading ? (
        <SearchLoading />
      ) : posts.length === 0 ? (
        searching ? (
          <EmptyState title="검색 결과가 없습니다" desc={`#${activeTag} 해시태그가 달린 워킹 피드가 없어요`} />
        ) : (
          <EmptyState title="워킹 피드가 없습니다" desc="스마트피싱 기록 후 피드에 올려보세요" />
        )
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((p) => {
            let walkingData: { distanceM?: number; durationSec?: number; catchCount?: number } | null = null;
            try { walkingData = JSON.parse(p.body ?? "null"); } catch {}
            const thumb = p.images[0]?.url ?? null;
            const isLocked = p.walkingLocked;
            return (
              <Link key={p.id} href={`/post/${p.id}`} className="relative aspect-square overflow-hidden bg-[#0d1b1a]">
                {isLocked ? (
                  <div className="h-full w-full bg-black" />
                ) : thumb ? (
                  <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#0d2a1a] to-[#0a1a12]" />
                )}
                {isLocked ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 px-1.5">
                    <Lock size={18} className="text-yellow-400" strokeWidth={1.5} />
                    <span className="text-[9px] font-semibold text-white">200P로 열기</span>
                    {/* GPS 좌표 기반 수계명 — 없으면 렌더링하지 않는다 */}
                    <WalkingTileWaterBody post={p} />
                    {walkingData?.distanceM != null && (
                      <span className="mt-0.5 text-[9px] text-white/60">{km(walkingData.distanceM)}</span>
                    )}
                    {(walkingData?.catchCount ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-white/60">
                        <Fish size={9} />{walkingData!.catchCount}마리
                      </span>
                    )}
                  </div>
                ) : (
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
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="md:py-3">
          {posts.map((p) => <FeedCard key={p.id} post={p} currentUserId={currentUserId} linkToDetail />)}
        </div>
      )}

      {/* 더 보기 버튼 */}
      {cursor && !searchLoading && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-[#1a2a1a] px-5 py-2.5 text-[13px] font-semibold text-navy-400 transition-colors hover:bg-[#223322] disabled:opacity-50"
          >
            {loadingMore ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={15} />}
            {loadingMore ? "불러오는 중..." : "더 보기"}
          </button>
        </div>
      )}
    </div>
  );
}
