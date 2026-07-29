"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Eye, ImageIcon, BookOpen, ChevronDown, Loader2 } from "lucide-react";
import { CommunityTabs } from "@/components/CommunityTabs";
import { Chip, EmptyState, LinkButton } from "@/components/ui";
import { ViewToggle, useViewMode } from "@/components/FeedList";
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
  const [cursor, setCursor] = useState<string | null>(initialNextCursor ?? null);
  const [loadingMore, setLoadingMore] = useState(false);

  const visible = useMemo(() => (cat === "ALL" ? posts : posts.filter((p) => (p.boardCategory ?? "WALKING") === cat)), [posts, cat]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/posts/log?cursor=${cursor}&limit=20`);
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
    <div className="min-h-screen">
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

      {/* 헤더 카피 */}
      <div className="flex items-end justify-between px-4 pb-1 pt-4">
        <div>
          <h1 className="flex items-center gap-1.5 text-[19px] font-extrabold tracking-tight text-navy-900">
            <BookOpen size={18} className="text-orange-500" /> 조행기
          </h1>
          <p className="mt-0.5 text-[12px] text-navy-400">출조 후기와 조행 정보를 글로 나눠요</p>
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {visible.length === 0 ? (
        <EmptyState title="아직 조행기가 없어요" desc="첫 조행기를 남겨보세요" action={<LinkButton href={currentUserId ? "/log/new" : "/login"}>조행기 쓰기</LinkButton>} />
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
              <span className="absolute left-1.5 top-1.5 rounded bg-orange-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">{p.boardLabel}</span>
            </Link>
          ))}
        </div>
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5 px-3 pb-4">
          {visible.map((p) => <LogRow key={p.id} post={p} />)}
        </ul>
      )}

      {/* 더 보기 버튼 */}
      {cursor && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-[#122030] px-5 py-2.5 text-[13px] font-semibold text-navy-400 transition-colors hover:bg-[#1a2d3e] disabled:opacity-50"
          >
            {loadingMore ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={15} />}
            {loadingMore ? "불러오는 중..." : "더 보기"}
          </button>
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
