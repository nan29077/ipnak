"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquare, Eye, ImageIcon, BookOpen, Loader2 } from "lucide-react";
import { CommunityTabs } from "@/components/CommunityTabs";
import { Chip, EmptyState, LinkButton } from "@/components/ui";
import { ViewToggle, useViewMode } from "@/components/FeedList";
import { HashtagSearchInput, SearchLoading, normalizeTagQuery, useDebouncedValue } from "@/components/FeedSearch";
import { LOG_CATEGORIES } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/utils";
import type { LogListItem } from "@/lib/queries";

export function LogBoard({
  posts: initialPosts,
  counts,
  currentUserId,
  nextCursor: initialNextCursor,
}: {
  posts: LogListItem[];
  counts: Record<string, number>;
  currentUserId?: string;
  nextCursor?: string | null;
}) {
  const [cat, setCat] = useState("ALL");
  const [viewMode, setViewMode] = useViewMode("ipnak_view_log");
  const [posts, setPosts] = useState<LogListItem[]>(initialPosts);
  // 게시판별 커서 — "전체"와 각 게시판의 다음 페이지 위치를 따로 기억한다.
  // undefined = 그 게시판을 아직 따로 불러온 적 없음(더 있을 수 있음), null = 마지막 페이지
  const [cursors, setCursors] = useState<Record<string, string | null | undefined>>({ ALL: initialNextCursor ?? null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const cursor = cursors[cat];

  // 해시태그 서버사이드 검색 — 입력이 300ms 멈춘 뒤에만 요청을 보낸다
  const activeTag = normalizeTagQuery(useDebouncedValue(tagQuery, 300));
  const searching = activeTag !== "";
  // 게시판 미지정(null) 글을 "워킹조행기"로 오분류하지 않는다 — 전체 탭에서만 보이게 한다
  const visible = useMemo(
    () => (cat === "ALL" ? posts : posts.filter((p) => p.boardCategory === cat)),
    [posts, cat]
  );
  const catLabel = LOG_CATEGORIES.find((c) => c.key === cat)?.label ?? "조행기";

  // 최초 렌더는 서버가 내려준 목록을 그대로 쓴다(불필요한 재요청 방지)
  const mounted = useRef(false);
  // 검색어를 지웠을 때 되돌릴 기준값
  const initialRef = useRef({ posts: initialPosts, cursor: initialNextCursor ?? null });
  // 검색 중일 때만 재조회 키에 게시판을 포함한다 — 검색어가 없으면 게시판 전환은 기존대로 클라이언트 필터
  const searchKey = searching ? `${activeTag}::${cat}` : "";

  useEffect(() => {
    const isFirst = !mounted.current;
    mounted.current = true;
    if (isFirst && !searchKey) return;

    // 검색어를 지우면 서버 렌더 초기 목록(첫 페이지)으로 되돌린다
    if (!searchKey) {
      setSearchLoading(false);
      setPosts(initialRef.current.posts);
      setCursors({ ALL: initialRef.current.cursor });
      return;
    }

    // searchKey 는 "언제 다시 부를지"만 정한다 — 실제 값은 같은 렌더의 activeTag/cat 을 그대로 읽는다
    const category = cat;
    let alive = true;
    setSearchLoading(true);
    const qs = new URLSearchParams({ limit: "20", tag: activeTag });
    if (category !== "ALL") qs.set("category", category);
    fetch(`/api/posts/log?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        // 커서 초기화 + 기존 결과 교체
        setPosts(data.posts ?? []);
        setCursors({ [category]: data.nextCursor ?? null });
      })
      .catch(() => {
        if (!alive) return;
        setPosts([]);
        setCursors({ [category]: null });
      })
      .finally(() => { if (alive) setSearchLoading(false); });
    return () => { alive = false; };
    // activeTag/cat 은 searchKey 로부터 만들어진 같은 렌더의 값이라 의도적으로 제외한다.
    // (deps 에 cat 을 넣으면 검색어 없이 게시판만 바꿔도 목록이 초기화된다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  async function loadMore() {
    if (cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      // 게시판을 고른 상태면 서버에도 category 를 넘겨 그 게시판 글만 이어서 받는다
      // (넘기지 않으면 전체 최신순 다음 페이지만 와서 선택한 게시판 글이 안 늘어난다)
      const qs = new URLSearchParams({ limit: "20" });
      if (cursor) qs.set("cursor", cursor);
      if (cat !== "ALL") qs.set("category", cat);
      // 검색 중이면 같은 tag 를 유지한 채 다음 페이지를 이어 받는다
      if (activeTag) qs.set("tag", activeTag);
      const res = await fetch(`/api/posts/log?${qs.toString()}`);
      const data = await res.json();
      if (data.posts?.length) {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const added = (data.posts as LogListItem[]).filter((p) => !seen.has(p.id));
          if (added.length === 0) return prev;
          return [...prev, ...added].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        });
      }
      setCursors((prev) => ({ ...prev, [cat]: data.nextCursor ?? null }));
    } catch {
      // 실패 시 무시
    } finally {
      setLoadingMore(false);
    }
  }

  // 무한 스크롤 — sentinel 이 뷰포트에 들어오면 다음 페이지를 자동으로 이어 받는다
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    // 커서가 null(마지막 페이지)이면 observer 를 걸지 않는다
    if (!el || cursor === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // loadMore 는 매 렌더 새로 만들어지므로 값 deps 로만 재구독한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loadingMore, searchLoading, cat, activeTag]);

  return (
    <div className="">
      {/* 상단: 커뮤니티 세그먼트 + 소개 */}
      <div className="sticky top-[52px] z-30 border-b border-navy-100 bg-[#0d1b2a]/85 backdrop-blur-md">
        <CommunityTabs />
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 no-scrollbar">
          <Chip className="shrink-0" active={cat === "ALL"} onClick={() => setCat("ALL")}>
            전체{posts.length > 0 && <span className="ml-1 text-[11px] opacity-70">{posts.length}</span>}
          </Chip>
          {LOG_CATEGORIES.map((c) => (
            <Chip key={c.key} className="shrink-0" active={cat === c.key} onClick={() => setCat(c.key)}>
              {c.label}{(counts[c.key] ?? 0) > 0 && <span className="ml-1 text-[11px] opacity-70">{counts[c.key]}</span>}
            </Chip>
          ))}
        </div>
      </div>

      {/* 해시태그 검색 — 토글 버튼 줄과 분리된 별도 줄에 항상 표시한다 */}
      <div className="px-4 pb-2 pt-4">
        <HashtagSearchInput value={tagQuery} onChange={setTagQuery} className="w-full" />
      </div>

      {/* 헤더 카피 */}
      <div className="flex items-end justify-between px-4 pb-1">
        <div>
          <h1 className="flex items-center gap-1.5 text-[19px] font-extrabold tracking-tight text-navy-900">
            <BookOpen size={18} className="text-orange-500" /> 조행기
          </h1>
          <p className="mt-0.5 text-[12px] text-navy-400">출조 후기와 조행 정보를 글로 나눠요</p>
        </div>
        <div className="shrink-0">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {searchLoading ? (
        <SearchLoading />
      ) : visible.length === 0 ? (
        searching ? (
          <EmptyState title="검색 결과가 없습니다" desc={`#${activeTag} 해시태그가 달린 조행기가 없어요`} />
        ) : cat === "ALL" ? (
          <EmptyState title="아직 조행기가 없어요" desc="첫 조행기를 남겨보세요" action={<LinkButton href={currentUserId ? "/log/new" : "/login"}>조행기 쓰기</LinkButton>} />
        ) : (
          <EmptyState title={`아직 ${catLabel}가 없어요`} desc="다른 게시판을 골라보거나 첫 글을 남겨보세요" action={<LinkButton href={currentUserId ? "/log/new" : "/login"}>조행기 쓰기</LinkButton>} />
        )
      ) : viewMode === "card" ? (
        <div className="mt-2 grid grid-cols-3 gap-0.5 px-0.5">
          {visible.map((p) => (
            <Link key={p.id} href={`/log/${p.id}`} className="relative aspect-square overflow-hidden rounded-sm bg-[#122030]">
              {p.thumbnail ? (
                <img src={p.thumbnail} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#1a2d3e]">
                  <BookOpen size={20} className="text-navy-400" strokeWidth={1.3} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-white">{p.title}</p>
              </div>
              <span className="absolute left-1.5 top-1.5 rounded bg-orange-500/90 px-1.5 py-0.5 text-[9px] font-bold text-gray-900">{p.boardLabel}</span>
            </Link>
          ))}
        </div>
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5 px-3 pb-4">
          {visible.map((p) => <LogRow key={p.id} post={p} />)}
        </ul>
      )}

      {/* 무한 스크롤 sentinel — 커서가 null(마지막 페이지)일 때만 숨긴다 */}
      {cursor !== null && !searchLoading && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loadingMore && <Loader2 size={18} className="animate-spin text-navy-400" />}
        </div>
      )}
    </div>
  );
}


function LogRow({ post }: { post: LogListItem }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#122030] shadow-card">
      <Link href={`/log/${post.id}`} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[11px] font-bold text-orange-400">{post.boardLabel}</span>
            {post.region && <span className="text-[11px] text-navy-400">{post.region}</span>}
          </div>
          <p className="flex items-center gap-1 text-[14.5px] font-bold leading-snug text-navy-900">
            <span className="line-clamp-1">{post.title}</span>
            {post.commentCount > 0 && <span className="shrink-0 text-[13px] font-bold text-orange-500">[{post.commentCount}]</span>}
          </p>
          {post.excerpt && <p className="mt-0.5 line-clamp-1 text-[12.5px] text-navy-400">{post.excerpt}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-navy-400">
            <span className="font-semibold text-navy-500">{post.author.nickname}</span>
            <span>{timeAgo(post.createdAt)}</span>
            <span className="inline-flex items-center gap-0.5"><Eye size={12} />{post.viewCount}</span>
            <span className="inline-flex items-center gap-0.5"><MessageSquare size={12} />{post.commentCount}</span>
          </div>
        </div>
        {post.thumbnail && (
          <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-navy-50">
            <img src={post.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
            {post.imageCount > 1 && (
              <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-md bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
                <ImageIcon size={9} />{post.imageCount}
              </span>
            )}
          </span>
        )}
      </Link>
    </li>
  );
}
