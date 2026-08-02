"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { LayoutList, LayoutGrid, Ruler, Fish, MapPin, ChevronDown, Loader2 } from "lucide-react";
import { FeedCard } from "@/components/FeedCard";
import { CommunityTabs } from "@/components/CommunityTabs";
import { AiPointRecommend } from "@/components/AiPointRecommend";
import { HashtagSearchInput, SearchLoading, normalizeTagQuery, useDebouncedValue } from "@/components/FeedSearch";
import { EmptyState, LinkButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { noImageSrc } from "@/lib/noImage";
import type { FeedPost } from "@/lib/queries";

export function useViewMode(key: string): ["list" | "card", (m: "list" | "card") => void] {
  const [mode, setMode] = useState<"list" | "card">("list");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "card") setMode("card");
    } catch {}
  }, [key]);
  const update = (m: "list" | "card") => {
    setMode(m);
    try { localStorage.setItem(key, m); } catch {}
  };
  return [mode, update];
}

export function FeedList({
  posts: initialPosts,
  currentUserId,
  banners,
  nextCursor: initialNextCursor,
  feedKind = "FEED",
}: {
  posts: FeedPost[];
  currentUserId?: string;
  banners?: { title: string; imageUrl: string | null; linkUrl?: string | null }[];
  nextCursor?: string | null;
  feedKind?: string;
}) {
  const [viewMode, setViewMode] = useViewMode("ipnak_view_feed");
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
  // 초기 목록은 서버 렌더 결과 그대로 — 검색어를 지웠을 때 되돌릴 기준값
  const initialRef = useRef({ posts: initialPosts, cursor: initialNextCursor ?? null });

  useEffect(() => {
    const isFirst = !mounted.current;
    mounted.current = true;
    if (isFirst && !activeTag) return;

    // 검색어를 지우면 서버 렌더 초기 목록(첫 페이지)으로 되돌린다
    if (!activeTag) {
      setSearchLoading(false);
      setPosts(initialRef.current.posts);
      setCursor(initialRef.current.cursor);
      return;
    }

    let alive = true;
    setSearchLoading(true);
    const qs = new URLSearchParams({ limit: "20", kind: feedKind, tag: activeTag });
    fetch(`/api/posts/feed?${qs.toString()}`)
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
  }, [activeTag, feedKind]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      // 검색 중이면 같은 tag 를 유지한 채 다음 페이지를 이어 받는다
      const qs = new URLSearchParams({ cursor, limit: "20", kind: feedKind });
      if (activeTag) qs.set("tag", activeTag);
      const res = await fetch(`/api/posts/feed?${qs.toString()}`);
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
    <div className="bg-[#0d1b2a]">
      <CommunityTabs />
      <AiPointRecommend />
      {banners && banners.length > 0 && (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-3 no-scrollbar">
          {banners.map((b, i) => {
            const inner = (
              <>
                {b.imageUrl && <img src={b.imageUrl} alt={b.title} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-85 transition-transform duration-500 group-hover:scale-105" />}
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3.5">
                  <p className="text-[15px] font-bold leading-snug text-white drop-shadow-sm">{b.title}</p>
                </div>
              </>
            );
            const cls = "group relative h-32 w-[18rem] shrink-0 snap-start overflow-hidden rounded-2xl bg-orange-500 shadow-card";
            return b.linkUrl ? (
              <Link key={i} href={b.linkUrl} className={cls}>{inner}</Link>
            ) : (
              <div key={i} className={cls}>{inner}</div>
            );
          })}
        </div>
      )}

      {/* 해시태그 검색 + 보기 모드 토글 */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-1">
        <HashtagSearchInput value={tagQuery} onChange={setTagQuery} className="max-w-[220px] flex-1" />
        <div className="ml-auto shrink-0">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {searchLoading ? (
        <SearchLoading />
      ) : posts.length === 0 ? (
        searching ? (
          <EmptyState title="검색 결과가 없습니다" desc={`#${activeTag} 해시태그가 달린 게시물이 없어요`} />
        ) : feedKind === "GENERAL" ? (
          <EmptyState title="일상 피드가 없습니다" desc="첫 일상 사진을 올려보세요" action={<LinkButton href="/post/new?type=general">일상 피드 올리기</LinkButton>} />
        ) : (
          <EmptyState title="피싱 피드가 없습니다" desc="첫 조황 사진을 올려보세요" action={<LinkButton href="/post/new">피싱 피드 올리기</LinkButton>} />
        )
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((p) => {
            const thumb = p.images[0]?.url ?? null;
            return (
              <Link key={p.id} href={`/post/${p.id}`} className="relative aspect-square overflow-hidden bg-[#1b2b3a]">
                {thumb ? (
                  <img src={thumb} alt={p.speciesName || "피드"} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <img src={noImageSrc(p.id)} alt="이미지 없음" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                )}
                {p.sizeCm != null && (
                  <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <Ruler size={9} />{p.sizeCm}cm
                  </span>
                )}
                {p.speciesName && (
                  <span className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-aqua-500/85 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <Fish size={9} />{p.speciesName}
                  </span>
                )}
                {p.region && p.blurRadius === 0 && p.postType !== "WALKING_FEED" && (
                  <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <MapPin size={9} />{p.region}
                  </span>
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
            className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-[#162538] px-5 py-2.5 text-[13px] font-semibold text-navy-400 transition-colors hover:bg-[#1e3248] disabled:opacity-50"
          >
            {loadingMore ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={15} />}
            {loadingMore ? "불러오는 중..." : "더 보기"}
          </button>
        </div>
      )}
    </div>
  );
}

function ViewToggle({ mode, onChange }: { mode: "list" | "card"; onChange: (m: "list" | "card") => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-navy-50/20 p-0.5">
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-label="리스트로 보기"
        className={cn(
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all",
          mode === "list" ? "bg-[#162538] text-navy-800 shadow-sm" : "text-navy-400"
        )}
      >
        <LayoutList size={15} /> 리스트
      </button>
      <button
        type="button"
        onClick={() => onChange("card")}
        aria-label="카드로 보기"
        className={cn(
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all",
          mode === "card" ? "bg-[#162538] text-navy-800 shadow-sm" : "text-navy-400"
        )}
      >
        <LayoutGrid size={15} /> 카드
      </button>
    </div>
  );
}

export { ViewToggle };
