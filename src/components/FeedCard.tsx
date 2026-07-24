"use client";
import { memo, useCallback, useState, useRef, useMemo, useEffect, useContext } from "react";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import Link from "next/link";
import {
  Heart, MessageCircle, Share2, Bookmark, Tag, MapPin, Ruler, Fish, Send, Flag, ChevronLeft, ChevronRight,
  Navigation, Clock, Route, Lock, Loader2, Maximize2, X,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InsufficientPointsDialog } from "@/components/InsufficientPointsDialog";
import { notifyPointsChanged } from "@/components/PointsBadge";
import { Sheet, Badge } from "@/components/ui";

// 워킹 피드 열람 비용 (lib/points.ts 의 WALKING_UNLOCK_COST 와 일치)
const WALKING_UNLOCK_COST = 200;
import { FishingTagCards } from "@/components/FishingTagCards";
import { timeAgo, cn, km, duration } from "@/lib/utils";
import type { FeedPost } from "@/lib/queries";
import { getAvatarUrl } from "@/lib/avatarUtils";

type BadgeTone = "navy" | "aqua" | "amber" | "red" | "green" | "gray";

const STICKERS = [
  "/입낚_NoImage_물고기.svg",
  "/입낚_NoImage_바늘.svg",
  "/입낚_NoImage_찌.svg",
] as const;

const TYPE_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  FISHING_POINT: { label: "피싱 포인트", tone: "aqua" },
  TOURNAMENT: { label: "대회 참가", tone: "amber" },
  GENERAL: { label: "", tone: "navy" },
  WALKING_FEED: { label: "워킹 피드", tone: "green" },
};

function FeedCardImpl({ post, currentUserId, linkToDetail = false }: { post: FeedPost; currentUserId?: string; linkToDetail?: boolean }) {
  const toast = useToast();
  const loggedIn = !!currentUserId;
  const [loginModal, setLoginModal] = useState(false);
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [saved, setSaved] = useState(post.saved);
  const [idx, setIdx] = useState(0);
  const [showTags, setShowTags] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [likePop, setLikePop] = useState(false);
  const [savePop, setSavePop] = useState(false);
  const lastTapRef = useRef(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  // touch → click 이중 호출 방지 (e.preventDefault() 없이 처리)
  const touchFiredRef = useRef(false);
  const badge = TYPE_BADGE[post.postType];
  const router = useRouter();

  // 워킹 피드 잠금: 열람 전이면 잠금 썸네일 표시, 200P 지불 후 열람
  const [unlocked, setUnlocked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const locked = post.walkingLocked && !unlocked;
  // 워킹 피드 동선 지도 풀스크린("크게 보기")
  const [mapFullOpen, setMapFullOpen] = useState(false);

  // 잠금 썸네일 탭 → 잔액 확인 후 부족하면 안내 팝업, 충분하면 열람 확인
  async function onTapUnlock() {
    if (!loggedIn) { setLoginModal(true); return; }
    if (unlocking) return;
    try {
      const res = await fetch("/api/points/balance", { cache: "no-store" });
      if (res.status === 401) { setLoginModal(true); return; }
      const data = await res.json();
      const bal = typeof data.balance === "number" ? data.balance : 0;
      setCurrentBalance(bal);
      if (bal < WALKING_UNLOCK_COST) setInsufficientOpen(true);
      else setConfirmOpen(true);
    } catch {
      // 잔액 조회 실패 시 확인 팝업으로 진행(서버에서 최종 검증)
      setConfirmOpen(true);
    }
  }

  async function doUnlock() {
    setConfirmOpen(false);
    setUnlocking(true);
    try {
      const res = await fetch("/api/points/unlock-walking-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 잔액 부족(경쟁 상황 등) → 안내 팝업
        if (res.status === 400 && /부족/.test(data.error || "")) {
          const b = await fetch("/api/points/balance", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ balance: 0 }));
          setCurrentBalance(typeof b.balance === "number" ? b.balance : 0);
          setInsufficientOpen(true);
          return;
        }
        toast(data.error || "열람에 실패했습니다", "error");
        return;
      }
      setUnlocked(true);
      toast("200P를 사용해 워킹 피드를 열었어요", "success");
      notifyPointsChanged();
      router.refresh();
    } catch {
      toast("열람에 실패했습니다", "error");
    } finally {
      setUnlocking(false);
    }
  }

  // WALKING_FEED: body에 JSON으로 저장된 동선 데이터 파싱
  const walkingData = useMemo(() => {
    if (post.postType !== "WALKING_FEED") return null;
    try {
      return JSON.parse(post.body ?? "null") as {
        routePoints: { lat: number; lng: number }[];
        distanceM?: number;
        durationSec?: number;
        catchCount?: number;
        catchMarkers?: { lat: number; lng: number }[];
      } | null;
    } catch { return null; }
  }, [post.postType, post.body]);

  // 가상 슬라이드: WALKING_FEED는 [지도, ...피쉬사진], 나머지는 images 그대로
  type Slide = { type: "map"; key: string } | { type: "img"; key: string; url: string; alt: string | null };
  const slides = useMemo<Slide[]>(() => {
    if (walkingData) {
      return [
        { type: "map", key: `map_${post.id}` },
        ...post.images.map((im) => ({ type: "img" as const, key: im.id, url: im.url, alt: im.alt })),
      ];
    }
    return post.images.map((im) => ({ type: "img" as const, key: im.id, url: im.url, alt: im.alt }));
  }, [walkingData, post.images, post.id]);

  async function toggleLike() {
    if (!loggedIn) { setLoginModal(true); return; }
    setLikePop(true);
    setTimeout(() => setLikePop(false), 350);
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) { setLiked(post.liked); setLikeCount(post.likeCount); toast("좋아요에 실패했습니다", "error"); }
  }

  async function likeFromDoubleTap() {
    if (!loggedIn) { setLoginModal(true); return; }
    // 더블탭: 좋아요 토글 (이미 좋아요면 취소, 아니면 추가)
    setShowBurst(true);
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => setShowBurst(false), 700);
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) { setLiked(post.liked); setLikeCount(post.likeCount); toast("좋아요에 실패했습니다", "error"); }
  }

  function onImageTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // 더블탭 — 좋아요 (예약된 상세보기 이동은 취소)
      lastTapRef.current = 0;
      if (singleTapTimerRef.current) { clearTimeout(singleTapTimerRef.current); singleTapTimerRef.current = null; }
      likeFromDoubleTap();
    } else {
      lastTapRef.current = now;
      // 단일탭 — 더블탭이 뒤따르지 않으면 상세보기로 이동
      if (linkToDetail) {
        if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = setTimeout(() => {
          singleTapTimerRef.current = null;
          router.push(`/post/${post.id}`);
        }, 300);
      }
    }
  }

  useEffect(() => () => {
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
  }, []);
  async function toggleSave() {
    if (!loggedIn) { setLoginModal(true); return; }
    setSaved((v) => !v);
    const res = await fetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
    if (!res.ok) { setSaved(post.saved); toast("저장에 실패했습니다", "error"); }
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
  const multi = slides.length > 1;

  return (
    <article className="border-b border-[#2a2a2a] bg-[#1a1a1a] md:mb-3 md:rounded-2xl md:border md:border-[#2a2a2a] md:shadow-card">
      {/* 헤더 */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <Link href={`/profile/${post.author.id}`}>
          <img src={getAvatarUrl(post.author.id, post.author.avatarUrl)} alt={post.author.nickname} loading="lazy" decoding="async" className="h-10 w-10 rounded-full object-cover ring-2 ring-[#2a2a2a]" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${post.author.id}`} className="block truncate text-[14px] font-bold text-navy-900">
            {post.author.nickname}
          </Link>
          <div className="flex items-center gap-1 text-[11px] text-navy-300">
            {post.postType === "WALKING_FEED" ? (
              <><Route size={10} className="shrink-0 text-green-400" /><span className="text-green-400">워킹 피드</span></>
            ) : (
              <><MapPin size={10} className="shrink-0" /><span className="truncate">{[post.region, post.fishingType].filter(Boolean).join(" · ") || "지역 · 낚시유형"}</span></>
            )}
          </div>
        </div>
        {badge?.label && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </div>

      {/* 이미지 캐러셀 + 피싱태그 */}
      <div
        className="relative aspect-square w-full select-none bg-navy-50"
        onTouchStart={(e) => {
          // 화면 왼쪽 끝 20px — iOS 뒤로가기 제스처 보호, 이 영역은 캡처 안 함
          if (e.touches[0].clientX < 20) {
            touchStartXRef.current = null;
            touchStartYRef.current = null;
            return;
          }
          touchStartXRef.current = e.touches[0].clientX;
          touchStartYRef.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          // e.preventDefault() 제거 — touchFiredRef로 이중 호출 방지 (iOS 뒤로가기 제스처 허용)
          const startX = touchStartXRef.current;
          const startY = touchStartYRef.current;
          touchStartXRef.current = null;
          touchStartYRef.current = null;
          if (startX === null) return; // 왼쪽 끝 제스처 or touchStart 미발생 → 무시
          const deltaX = e.changedTouches[0].clientX - startX;
          const deltaY = startY !== null ? e.changedTouches[0].clientY - startY : 0;
          // 세로 이동 12px 이상이면 스크롤로 간주 — 탭/네비게이션 무시
          if (Math.abs(deltaY) > 12) return;
          // 가로 스와이프 40px 이상이면 슬라이드 이동
          if (Math.abs(deltaX) >= 40) {
            if (deltaX < 0) setIdx((i) => Math.min(slides.length - 1, i + 1));
            else setIdx((i) => Math.max(0, i - 1));
            return;
          }
          // touch → click 이중 호출 방지 플래그 설정 후 탭 처리
          touchFiredRef.current = true;
          setTimeout(() => { touchFiredRef.current = false; }, 400);
          onImageTap();
        }}
      >
        {(() => {
          if (slides.length === 0) {
            const sticker = STICKERS[post.id.charCodeAt(0) % 3];
            return (
              <img
                src={sticker}
                alt="이미지 없음"
                decoding="async"
                className="h-full w-full object-contain p-10 opacity-50"
              />
            );
          }
          const slide = slides[idx];
          if (slide?.type === "map") {
            return (
              <div className="h-full w-full cursor-pointer" onClick={() => { if (touchFiredRef.current) return; onImageTap(); }}>
                <MiniRouteMap
                  points={walkingData?.routePoints ?? []}
                  catchPoints={walkingData?.catchMarkers}
                />
              </div>
            );
          }
          return (
            <img
              src={(slide as Extract<(typeof slides)[number], { type: "img" }>)?.url}
              alt={(slide as Extract<(typeof slides)[number], { type: "img" }>)?.alt || "낚시 사진"}
              decoding="async"
              className="h-full w-full cursor-pointer object-cover"
              onClick={() => { if (touchFiredRef.current) return; onImageTap(); }}
            />
          );
        })()}

        {/* 크게 보기 — 워킹 피드 동선 지도 풀스크린 */}
        {!locked && slides[idx]?.type === "map" && (
          <button
            onClick={(e) => { e.stopPropagation(); setMapFullOpen(true); }}
            aria-label="지도 크게 보기"
            className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow backdrop-blur btn-press transition-colors hover:bg-black/85"
          >
            <Maximize2 size={13} /> 크게 보기
          </button>
        )}

        {/* 더블탭 좋아요 버스트 */}
        {showBurst && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <Heart size={110} className="animate-likeburst fill-white text-white drop-shadow-lg" />
          </div>
        )}

        {/* 피싱태그 핀 */}
        {showTags && post.productTags.map((t) => (
          <Link key={t.id} href={`/shop/${t.product.id}`}
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-[#161616]/95 px-2 py-1 text-[11px] font-semibold text-navy-800 shadow"
            style={{ left: `${t.posX * 100}%`, top: `${t.posY * 100}%` }}>
            <Tag size={12} /> {t.product.name}
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
          <>
            {/* 위치 흐림 — 이미지 하단 블러 그라디언트 오버레이 */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0"
              style={{
                height: "38%",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                maskImage: "linear-gradient(to top, black 40%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to top, black 40%, transparent 100%)",
                background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)",
              }}
            />
            {/* 위치 흐림 뱃지 */}
            <span className="badge absolute bottom-2.5 left-2.5 z-10 bg-black/70 text-white backdrop-blur-sm">
              위치 흐림 공개
            </span>
          </>
        )}

        {/* 피싱태그 토글 */}
        {post.productTags.length > 0 && (
          <button onClick={() => setShowTags((v) => !v)} aria-label="피싱태그 보기"
            className="badge absolute bottom-2.5 right-2.5 bg-[#161616]/90 text-navy-700 shadow-soft backdrop-blur-sm btn-press">
            <Tag size={13} /> 피싱태그 {post.productTags.length}
          </button>
        )}

        {/* 캐러셀 화살표 + 도트 */}
        {multi && (
          <>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1 text-white disabled:opacity-0" aria-label="이전 사진"><ChevronLeft size={18} /></button>
            <button onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))} disabled={idx === slides.length - 1}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1 text-white disabled:opacity-0" aria-label="다음 사진"><ChevronRight size={18} /></button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {slides.map((_, i) => <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i === idx ? "bg-white" : "bg-white/55")} />)}
            </div>
          </>
        )}

        {/* 워킹 피드 잠금 썸네일 — 어두운 배경 + 낚싯줄/바늘 + 자물쇠 (입낚 분위기) */}
        {locked && (
          <div
            onClick={(e) => { e.stopPropagation(); onTapUnlock(); }}
            className="absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0c1c2b] via-[#0e1720] to-[#05090f]"
          >
            {/* 낚싯줄 + 바늘 모티프 */}
            <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]" preserveAspectRatio="xMidYMid slice" aria-hidden>
              <path d="M40 -10 C 60 60, 140 90, 120 160" fill="none" stroke="#7fd4e8" strokeWidth="1.2" />
              <path d="M120 160 c -14 6, -22 -6, -10 -14 c 8 -5, 18 2, 12 12" fill="none" stroke="#7fd4e8" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="40" cy="-10" r="2" fill="#7fd4e8" />
            </svg>
            <div className="pointer-events-none absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
            <div className="relative flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-sm">
                {unlocking ? <Loader2 size={26} className="animate-spin text-amber-300" /> : <Lock size={26} className="text-amber-300" strokeWidth={1.8} />}
              </div>
              <div>
                <p className="text-[14px] font-bold text-white">워킹 피드 잠금</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/55">포인트를 사용하면 동선·조황을<br />확인할 수 있어요</p>
              </div>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-[13px] font-extrabold text-[#161616] shadow-lg shadow-amber-400/20">
                <Lock size={13} strokeWidth={2.4} /> 200P로 열기
              </span>
            </div>
          </div>
        )}
      </div>

      {/* WALKING_FEED 전용 정보 스트립 */}
      {!locked && post.postType === "WALKING_FEED" && walkingData && (
        <div
          className={cn("flex items-center justify-around border-b border-t border-[#2a2a2a] bg-[#141414] px-3.5 py-3", linkToDetail && "cursor-pointer")}
          onClick={linkToDetail ? () => router.push(`/post/${post.id}`) : undefined}
        >
          <div className="flex flex-col items-center gap-0.5">
            <Navigation size={15} className="text-aqua-400" />
            <p className="text-[13px] font-bold text-navy-800">{km(walkingData.distanceM ?? 0)}</p>
            <p className="text-[10px] text-navy-400">워킹거리</p>
          </div>
          <div className="h-9 w-px bg-navy-100" />
          <div className="flex flex-col items-center gap-0.5">
            <Clock size={15} className="text-aqua-400" />
            <p className="text-[13px] font-bold text-navy-800">{duration(walkingData.durationSec ?? 0)}</p>
            <p className="text-[10px] text-navy-400">워킹시간</p>
          </div>
          <div className="h-9 w-px bg-navy-100" />
          <div className="flex flex-col items-center gap-0.5">
            <Fish size={15} className="text-aqua-400" />
            <p className="text-[13px] font-bold text-navy-800">{walkingData.catchCount ?? post.images.length}마리</p>
            <p className="text-[10px] text-navy-400">피쉬수</p>
          </div>
        </div>
      )}

      {/* 피싱포인트·일반 피드 메타 정보 줄 */}
      {post.postType !== "WALKING_FEED" && (post.region || post.fishingType || post.speciesName) && (
        <div
          className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#2a2a2a] px-3.5 py-2 text-[12px] text-navy-500", linkToDetail && "cursor-pointer")}
          onClick={linkToDetail ? () => router.push(`/post/${post.id}`) : undefined}
        >
          {post.region && (
            <span className="flex items-center gap-1"><MapPin size={12} className="shrink-0 text-navy-400" />{post.region}</span>
          )}
          {post.fishingType && (
            <span className="flex items-center gap-1"><Fish size={12} className="shrink-0 text-navy-400" />{post.fishingType}</span>
          )}
          {post.speciesName && post.postType === "FISHING_POINT" && (
            <span className="flex items-center gap-1 font-semibold text-aqua-600"><Fish size={12} className="shrink-0" />{post.speciesName}</span>
          )}
        </div>
      )}

      {/* 액션 바 (잠금 상태에서는 숨김) */}
      {!locked && (
      <div className="flex items-center gap-5 px-3.5 pb-1 pt-3">
        <button
          onClick={toggleLike}
          className="btn-press" aria-label="좋아요"
        >
          <Heart size={26} strokeWidth={1.7} className={cn(likePop && "animate-heartpop", liked ? "fill-red-500 text-red-500" : "text-navy-700")} />
        </button>
        <button onClick={() => { if (!loggedIn) { setLoginModal(true); return; } setCommentsOpen(true); }} className="btn-press" aria-label="댓글">
          <MessageCircle size={26} strokeWidth={1.7} className="text-navy-700" />
        </button>
        <button onClick={share} className="btn-press" aria-label="공유"><Share2 size={24} strokeWidth={1.7} className="text-navy-700" /></button>
        <button onClick={() => { setSavePop(true); setTimeout(() => setSavePop(false), 350); toggleSave(); }} className="ml-auto btn-press" aria-label="저장">
          <Bookmark size={26} strokeWidth={1.7} className={cn(savePop && "animate-heartpop", saved ? "fill-navy-700 text-navy-700" : "text-navy-700")} />
        </button>
      </div>
      )}

      {/* 잠금 상태 안내 문구 */}
      {locked && (
        <div className="px-3.5 pb-3.5 pt-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-navy-800">
            <Lock size={13} className="text-amber-400" /> {post.author.nickname}님의 워킹 피드
          </p>
          <p className="mt-1 text-[12px] text-navy-400">200P를 사용하면 동선 지도와 조황을 볼 수 있어요. 사용한 200P 중 100P는 작성자에게 적립됩니다.</p>
        </div>
      )}

      {/* 본문 (잠금 상태에서는 숨김) */}
      {!locked && (
      <div className="px-3.5 pb-4">
        <p className="text-[14px] font-bold text-navy-900">좋아요 {likeCount}개</p>
        {/* WALKING_FEED는 자동생성 캡션 대신 정보 스트립으로 표시 */}
        {post.caption && post.postType !== "WALKING_FEED" && (
          <p className="mt-1 text-[13px] leading-relaxed text-navy-900">
            <Link href={`/profile/${post.author.id}`} className="font-bold">{post.author.nickname}</Link>{" "}
            {post.caption}
          </p>
        )}
        {post.hashtags.length > 0 && (
          <p className="mt-1 text-[12px] font-medium text-aqua-400">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
        {/* 피싱태그 리스트 (클릭 추적 → 작성자 리퍼럴 적립) */}
        {post.productTags.length > 0 && (
          <div className="mt-2.5">
            <FishingTagCards postId={post.id} tags={post.productTags} compact />
          </div>
        )}
        {commentCount > 0 && (
          <button onClick={() => setCommentsOpen(true)} className="mt-1.5 block text-[13px] text-navy-400 transition-colors hover:text-navy-500">
            댓글 {commentCount}개 모두 보기
          </button>
        )}
        <p className="mt-1.5 text-[11px] uppercase tracking-wide text-navy-400">{timeAgo(post.createdAt)}</p>
      </div>
      )}

      <LoginRequiredModal open={loginModal} onClose={() => setLoginModal(false)} feature="이 기능" />
      <CommentSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} currentUserId={currentUserId} onCommentAdded={() => setCommentCount((c) => c + 1)} />

      <ConfirmDialog
        open={confirmOpen}
        title="200P로 워킹 피드 열기"
        message="200P를 사용해 이 워킹 피드를 열람합니다. 사용한 포인트 중 100P는 작성자에게 적립됩니다."
        confirmLabel="200P 사용하고 열기"
        cancelLabel="취소"
        onConfirm={doUnlock}
        onCancel={() => setConfirmOpen(false)}
      />

      <InsufficientPointsDialog
        open={insufficientOpen}
        current={currentBalance}
        required={WALKING_UNLOCK_COST}
        onClose={() => setInsufficientOpen(false)}
      />

      {/* 동선 지도 풀스크린 ("크게 보기") — 핀치줌·드래그 가능 */}
      {mapFullOpen && walkingData && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9990]" style={{ width: "100vw", height: "100vh", background: "#06080a" }}>
          <MiniRouteMap points={walkingData.routePoints ?? []} catchPoints={walkingData.catchMarkers} interactive />
          <button
            onClick={() => setMapFullOpen(false)}
            aria-label="지도 크게 보기 닫기"
            className="absolute right-4 z-[9991] inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#161616]/95 text-navy-800 shadow-card ring-1 ring-white/15 backdrop-blur btn-press transition-colors hover:bg-[#1e1e1e]"
            style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}
          >
            <X size={20} />
          </button>
        </div>,
        document.body,
      )}
    </article>
  );
}

export const FeedCard = memo(FeedCardImpl);

function CommentSheet({ postId, open, onClose, currentUserId, onCommentAdded }: { postId: string; open: boolean; onClose: () => void; currentUserId?: string; onCommentAdded?: () => void }) {
  const toast = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  // 답글 대상(항상 최상위 댓글에 붙임 — 대댓글 깊이 1단계)
  const [replyTo, setReplyTo] = useState<{ parentId: string; nickname: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/posts/${postId}/comments`);
    const data = await res.json();
    setComments(data.comments || []);
    setLoaded(true);
  }
  if (open && !loaded) load();

  async function postComment(body: string, parentId?: string) {
    if (!body.trim()) return false;
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim(), ...(parentId ? { parentId } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "오류", "error"); return false; }
    setComments((c) => [...c, data.comment]);
    onCommentAdded?.();
    return true;
  }

  async function send() {
    if (await postComment(text)) setText("");
  }

  // 답글 시작 — 대상이 대댓글이면 그 부모(최상위)에 붙이고 @멘션은 대상 작성자로
  function startReply(comment: any) {
    setReplyTo({ parentId: comment.parentId || comment.id, nickname: comment.author.nickname });
  }
  async function sendReply(parentId: string, body: string) {
    if (await postComment(body, parentId)) setReplyTo(null);
  }

  const top = comments.filter((c) => !c.parentId);
  const replies = (id: string) => comments.filter((c) => c.parentId === id);

  const commentInput = (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder={currentUserId ? "댓글 달기..." : "로그인 후 댓글을 달 수 있어요"}
        className="flex-1 rounded-full border border-navy-100 bg-navy-50 px-4 py-2.5 text-sm text-navy-800 placeholder-navy-300 outline-none transition focus:border-aqua-400 focus:bg-[#252525] focus:ring-2 focus:ring-aqua-100"
      />
      <button onClick={send} aria-label="댓글 전송" className="rounded-full bg-orange-500 p-2.5 text-white shadow-soft btn-press transition-colors hover:bg-orange-600"><Send size={16} /></button>
    </div>
  );

  return (
    <Sheet open={open} onClose={() => { onClose(); setLoaded(false); setReplyTo(null); }} title="댓글" footer={commentInput}>
      <div className="space-y-3 pb-2">
        {!loaded && <p className="py-6 text-center text-sm text-navy-300">불러오는 중...</p>}
        {loaded && top.length === 0 && <p className="py-6 text-center text-sm text-navy-300">첫 댓글을 남겨보세요</p>}
        {top.map((c) => (
          <div key={c.id}>
            <CommentRow c={c} onReply={() => startReply(c)} />
            {replies(c.id).map((r) => (
              <div key={r.id} className="ml-9 mt-2"><CommentRow c={r} onReply={() => startReply(r)} /></div>
            ))}
            {replyTo && replyTo.parentId === c.id && (
              <div className="ml-9 mt-2">
                <ReplyInput
                  key={replyTo.nickname}
                  nickname={replyTo.nickname}
                  disabled={!currentUserId}
                  onCancel={() => setReplyTo(null)}
                  onSubmit={(body) => sendReply(c.id, body)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// 인라인 답글 입력창 — @대상닉네임 자동 포함
function ReplyInput({ nickname, disabled, onCancel, onSubmit }: { nickname: string; disabled?: boolean; onCancel: () => void; onSubmit: (body: string) => void }) {
  const [text, setText] = useState(`@${nickname} `);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.focus(); const len = el.value.length; el.setSelectionRange(len, len); }
  }, []);
  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={ref} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(text); if (e.key === "Escape") onCancel(); }}
        placeholder={disabled ? "로그인 후 답글을 달 수 있어요" : "답글 달기..."}
        className="flex-1 rounded-full border border-navy-100 bg-navy-50 px-3.5 py-2 text-[13px] text-navy-800 placeholder-navy-300 outline-none transition focus:border-aqua-400 focus:bg-[#1e1e1e]"
      />
      <button onClick={() => onSubmit(text)} aria-label="답글 전송" className="rounded-full bg-orange-500 p-2 text-white btn-press transition-colors hover:bg-orange-600"><Send size={14} /></button>
      <button onClick={onCancel} aria-label="답글 취소" className="rounded-full p-1.5 text-navy-300 transition-colors hover:bg-navy-50 hover:text-navy-500"><X size={16} /></button>
    </div>
  );
}

const CommentRow = memo(function CommentRow({ c, onReply }: { c: any; onReply?: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <img src={getAvatarUrl(c.author.id, c.author.avatarUrl)} alt="" loading="lazy" decoding="async" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-navy-100" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-[#1e1e1e] px-3 py-2">
          <p className="text-[13px] font-semibold text-navy-800">{c.author.nickname}</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-navy-600">{c.body}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 pl-3">
          <span className="text-[11px] text-navy-300">{timeAgo(c.createdAt)}</span>
          {onReply && (
            <button onClick={onReply} className="text-[11px] font-semibold text-navy-400 transition-colors hover:text-aqua-400">답글 달기</button>
          )}
        </div>
      </div>
    </div>
  );
});