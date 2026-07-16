"use client";
import { memo, useCallback, useState, useRef } from "react";
import Link from "next/link";
import {
  Heart, MessageCircle, Share2, Bookmark, ShoppingBag, MapPin, Ruler, MoreHorizontal, Fish, Send, Flag, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { Sheet, Badge } from "@/components/ui";
import { timeAgo, won, cn } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";
import type { FeedPost } from "@/lib/queries";

type BadgeTone = "navy" | "aqua" | "amber" | "red" | "green" | "gray";

const TYPE_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  FISHING_POINT: { label: "피싱 포인트", tone: "aqua" },
  TOURNAMENT: { label: "대회 참가", tone: "amber" },
  GENERAL: { label: "", tone: "navy" },
};

function FeedCardImpl({ post, currentUserId }: { post: FeedPost; currentUserId?: string }) {
  const toast = useToast();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.saved);
  const [idx, setIdx] = useState(0);
  const [showTags, setShowTags] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [likePop, setLikePop] = useState(false);
  const [savePop, setSavePop] = useState(false);
  const lastTapRef = useRef(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const badge = TYPE_BADGE[post.postType];

  async function toggleLike() {
    setLikePop(true);
    setTimeout(() => setLikePop(false), 350);
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) { setLiked(post.liked); setLikeCount(post.likeCount); toast("로그인이 필요합니다", "error"); }
  }

  async function likeFromDoubleTap() {
    // 더블탭은 좋아요 취소를 하지 않음(이미 좋아요면 API 호출 생략)
    setShowBurst(true);
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => setShowBurst(false), 700);
    if (liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) { setLiked(post.liked); setLikeCount(post.likeCount); toast("로그인이 필요합니다", "error"); }
  }

  function onImageTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      likeFromDoubleTap();
    } else {
      lastTapRef.current = now;
    }
  }
  async function toggleSave() {
    setSaved((v) => !v);
    const res = await fetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
    if (!res.ok) { setSaved(post.saved); toast("로그인이 필요합니다", "error"); }
    else toast(saved ? "저장을 취소했습니다" : "저장했습니다", "success");
  }
  const share = useCallback(async () => {
    const url = `${location.origin}/post/${post.id}`;
    fetch(`/api/posts/${post.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "link" }) });
    if (navigator.share) {
      try { await navigator.share({ title: "입낚", text: post.caption ?? "낚시 게시글", url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); toast("링크를 복사했습니다", "success"); }
    catch { toast("공유 링크: " + url, "info"); }
  }, [post, toast]);
  const report = useCallback(async () => {
    await fetch(`/api/posts/${post.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "사용자 신고" }) });
    toast("신고가 접수되었습니다", "success");
  }, [post.id, toast]);

  const multi = post.images.length > 1;

  return (
    <article className="border-b border-navy-100 bg-[#1e1e1e] md:mb-3 md:rounded-2xl md:border md:border-navy-100 md:shadow-card">
      {/* 헤더 */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <Link href={`/profile/${post.author.id}`}>
          <img src={post.author.avatarUrl || "https://i.pravatar.cc/80"} alt={post.author.nickname} loading="lazy" decoding="async" className="h-9 w-9 rounded-full object-cover ring-1 ring-navy-100" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${post.author.id}`} className="block truncate text-[14px] font-semibold text-navy-900">
            {post.author.nickname}
          </Link>
          <div className="flex items-center gap-1 text-[11px] text-navy-300">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">
              {[post.region, post.fishingType].filter(Boolean).join(" · ") || "지역 · 낚시유형"}
            </span>
          </div>
        </div>
        {badge?.label && <Badge tone={badge.tone}>{badge.label}</Badge>}
        <button onClick={report} aria-label="더보기 / 신고" className="rounded-full p-1 text-navy-300 transition-colors hover:bg-navy-50"><MoreHorizontal size={20} /></button>
      </div>

      {/* 이미지 캐러셀 + 쇼핑 태그 */}
      <div className="relative aspect-square w-full select-none bg-navy-50">
        <img
          src={post.images[idx]?.url}
          alt={post.images[idx]?.alt || "낚시 사진"}
          decoding="async"
          className="h-full w-full cursor-pointer object-cover"
          onClick={onImageTap}
          onTouchEnd={onImageTap}
        />

        {/* 더블탭 좋아요 버스트 */}
        {showBurst && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <Heart size={110} className="animate-likeburst fill-white text-white drop-shadow-lg" />
          </div>
        )}

        {/* 쇼핑 태그 핀 */}
        {showTags && post.productTags.map((t) => (
          <Link key={t.id} href={t.product.buyUrl && t.product.buyUrl !== "#" ? t.product.buyUrl : `/shop/${t.product.id}`}
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-[#161616]/95 px-2 py-1 text-[11px] font-semibold text-navy-800 shadow"
            style={{ left: `${t.posX * 100}%`, top: `${t.posY * 100}%` }}>
            <ShoppingBag size={12} /> {t.product.name}
          </Link>
        ))}

        {/* 사이즈 뱃지 */}
        {post.sizeCm != null && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <Ruler size={12} /> {post.sizeCm}cm
          </span>
        )}
        {post.speciesName && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-aqua-500/90 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <Fish size={12} /> {post.speciesName}
          </span>
        )}
        {post.blurRadius > 0 && (
          <span className="badge absolute bottom-2.5 left-2.5 bg-black/55 text-white backdrop-blur-sm">위치 흐림 공개</span>
        )}

        {/* 쇼핑 태그 토글 */}
        {post.productTags.length > 0 && (
          <button onClick={() => setShowTags((v) => !v)} aria-label="쇼핑 태그 보기"
            className="badge absolute bottom-2.5 right-2.5 bg-[#161616]/90 text-navy-700 shadow-soft backdrop-blur-sm btn-press">
            <ShoppingBag size={13} /> 태그 {post.productTags.length}
          </button>
        )}

        {/* 캐러셀 화살표 + 도트 */}
        {multi && (
          <>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1 text-white disabled:opacity-0" aria-label="이전 사진"><ChevronLeft size={18} /></button>
            <button onClick={() => setIdx((i) => Math.min(post.images.length - 1, i + 1))} disabled={idx === post.images.length - 1}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1 text-white disabled:opacity-0" aria-label="다음 사진"><ChevronRight size={18} /></button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {post.images.map((_, i) => <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i === idx ? "bg-white" : "bg-white/55")} />)}
            </div>
          </>
        )}
      </div>

      {/* 액션 바 */}
      <div className="flex items-center gap-[18px] px-3.5 pb-1.5 pt-3">
        <button onClick={toggleLike} className="flex items-center gap-1 btn-press" aria-label="좋아요">
          <Heart size={22} strokeWidth={1.9} className={cn(likePop && "animate-heartpop", liked ? "fill-red-500 text-red-500" : "text-navy-700")} />
          <span className="text-[13px] font-semibold text-navy-700">{likeCount}</span>
        </button>
        <button onClick={() => setCommentsOpen(true)} className="flex items-center gap-1 btn-press" aria-label="댓글">
          <MessageCircle size={22} strokeWidth={1.9} className="text-navy-700" />
          <span className="text-[13px] text-navy-700">{post.commentCount}</span>
        </button>
        <button onClick={share} className="btn-press" aria-label="공유"><Share2 size={22} strokeWidth={1.9} className="text-navy-700" /></button>
        <button onClick={() => { setSavePop(true); setTimeout(() => setSavePop(false), 350); toggleSave(); }} className="ml-auto btn-press" aria-label="저장">
          <Bookmark size={22} strokeWidth={1.9} className={cn(savePop && "animate-heartpop", saved ? "fill-navy-700 text-navy-700" : "text-navy-700")} />
        </button>
      </div>

      {/* 본문 */}
      <div className="px-3.5 pb-3.5">
        <p className="text-[13px] font-semibold text-navy-900">좋아요 {likeCount}개</p>
        {post.caption && (
          <p className="mt-1 text-[13px] leading-relaxed text-navy-900">
            <Link href={`/profile/${post.author.id}`}><strong>{post.author.nickname}</strong></Link>{" "}
            {post.caption}
          </p>
        )}
        {post.hashtags.length > 0 && (
          <p className="mt-1 text-[12px] font-medium text-aqua-700">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
        {/* 쇼핑 태그 리스트 */}
        {post.productTags.length > 0 && (
          <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar">
            {post.productTags.map((t) => (
              <Link key={t.id} href={`/shop/${t.product.id}`} className="flex shrink-0 items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/40 p-1.5 pr-3 transition-colors hover:bg-navy-50">
                <img src={t.product.imageUrl || ""} alt={t.product.name} loading="lazy" decoding="async" className="h-9 w-9 rounded-lg object-cover" />
                <div className="text-left">
                  <p className="text-[12px] font-semibold leading-tight text-navy-900">{t.product.name}</p>
                  <p className="text-[11px] text-navy-300">{productCategoryLabel(t.product.category)} · {won(t.product.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {post.commentCount > 0 && (
          <button onClick={() => setCommentsOpen(true)} className="mt-2 block text-[13px] text-navy-300 transition-colors hover:text-navy-500">
            댓글 {post.commentCount}개 모두 보기
          </button>
        )}
        <p className="mt-1 text-[11px] text-navy-300">{timeAgo(post.createdAt)}</p>
      </div>

      <CommentSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} currentUserId={currentUserId} />
    </article>
  );
}

export const FeedCard = memo(FeedCardImpl);

function CommentSheet({ postId, open, onClose, currentUserId }: { postId: string; open: boolean; onClose: () => void; currentUserId?: string }) {
  const toast = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/posts/${postId}/comments`);
    const data = await res.json();
    setComments(data.comments || []);
    setLoaded(true);
  }
  if (open && !loaded) load();

  async function send() {
    if (!text.trim()) return;
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "오류", "error"); return; }
    setComments((c) => [...c, data.comment]);
    setText("");
  }

  const top = comments.filter((c) => !c.parentId);
  const replies = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <Sheet open={open} onClose={() => { onClose(); setLoaded(false); }} title="댓글">
      <div className="max-h-[55vh] space-y-3 overflow-y-auto pb-2">
        {!loaded && <p className="py-6 text-center text-sm text-navy-300">불러오는 중...</p>}
        {loaded && top.length === 0 && <p className="py-6 text-center text-sm text-navy-300">첫 댓글을 남겨보세요</p>}
        {top.map((c) => (
          <div key={c.id}>
            <CommentRow c={c} />
            {replies(c.id).map((r) => (
              <div key={r.id} className="ml-9 mt-2"><CommentRow c={r} /></div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-navy-100 pt-3">
        <input
          ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={currentUserId ? "댓글 달기..." : "로그인 후 댓글을 달 수 있어요"}
          className="flex-1 rounded-full border border-navy-100 bg-navy-50 px-4 py-2.5 text-sm text-navy-800 placeholder-navy-300 outline-none transition focus:border-aqua-400 focus:bg-[#1e1e1e] focus:ring-2 focus:ring-aqua-100"
        />
        <button onClick={send} aria-label="댓글 전송" className="rounded-full bg-orange-500 p-2.5 text-white shadow-soft btn-press transition-colors hover:bg-orange-600"><Send size={16} /></button>
      </div>
    </Sheet>
  );
}

const CommentRow = memo(function CommentRow({ c }: { c: any }) {
  return (
    <div className="flex items-start gap-2">
      <img src={c.author.avatarUrl || "https://i.pravatar.cc/60"} alt="" loading="lazy" decoding="async" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-navy-100" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-[#1e1e1e] px-3 py-2">
          <p className="text-[13px] font-semibold text-navy-800">{c.author.nickname}</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-navy-600">{c.body}</p>
        </div>
        <p className="mt-1 pl-3 text-[11px] text-navy-300">{timeAgo(c.createdAt)}</p>
      </div>
    </div>
  );
});