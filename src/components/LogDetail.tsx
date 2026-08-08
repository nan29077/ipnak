"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Share2, Bookmark, Eye, Send, MapPin, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
import { FishingTagCards } from "@/components/FishingTagCards";
import { CommentRewardNotice } from "@/components/PointRewardNotice";
import { CommentPhotoButton, CommentPhotoPreview, CommentImage } from "@/components/shared/CommentPhoto";
import { logCategoryLabel } from "@/lib/taxonomy";
import { timeAgo, cn } from "@/lib/utils";
import type { FeedPost } from "@/lib/queries";
import { getAvatarUrl } from "@/lib/avatarUtils";

export function LogDetail({ post, currentUserId }: { post: FeedPost; currentUserId?: string }) {
  const toast = useToast();
  const loggedIn = !!currentUserId;
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.saved);
  const [loginModal, setLoginModal] = useState(false);
  const [loginFeature, setLoginFeature] = useState("이 기능");

  function requireLogin(feature: string) { setLoginFeature(feature); setLoginModal(true); }

  async function toggleLike() {
    if (!loggedIn) { requireLogin("좋아요"); return; }
    setLiked((v) => !v); setLikeCount((c) => c + (liked ? -1 : 1));
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) { setLiked(post.liked); setLikeCount(post.likeCount); toast("좋아요에 실패했습니다", "error"); }
  }
  async function toggleSave() {
    if (!loggedIn) { requireLogin("저장"); return; }
    setSaved((v) => !v);
    const res = await fetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
    if (!res.ok) { setSaved(post.saved); toast("저장에 실패했습니다", "error"); }
    else toast(saved ? "저장을 취소했습니다" : "저장했습니다", "success");
  }
  async function share() {
    const url = `${location.origin}/log/${post.id}`;
    fetch(`/api/posts/${post.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "link" }) });
    try { await navigator.clipboard.writeText(url); toast("링크를 복사했습니다", "success"); }
    catch { toast("공유 링크: " + url, "info"); }
  }

  return (
    <article>
      {/* 제목 영역 */}
      <div className="border-b border-navy-100 px-4 pb-3.5 pt-4">
        <span className="inline-flex items-center rounded-md bg-orange-500/15 px-2 py-0.5 text-[12px] font-bold text-orange-400">
          {logCategoryLabel(post.boardCategory)}
        </span>
        <h1 className="mt-2 text-[20px] font-extrabold leading-snug tracking-tight text-navy-900">{post.title || "(제목 없음)"}</h1>
        <div className="mt-2.5 flex items-center gap-2.5">
          <Link href={`/profile/${post.author.id}`}>
            <img src={getAvatarUrl(post.author.id, post.author.avatarUrl)} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-navy-100" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${post.author.id}`} className="block text-[13.5px] font-semibold text-navy-900">{post.author.nickname}</Link>
            <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-navy-300">
              <span>{timeAgo(post.createdAt)}</span>
              <span className="inline-flex items-center gap-0.5"><Eye size={12} />{post.viewCount}</span>
              <span className="inline-flex items-center gap-0.5"><MessageSquare size={12} />{post.commentCount}</span>
              {post.region && <span className="inline-flex items-center gap-0.5"><MapPin size={11} />{post.region}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="px-4 py-4">
        {post.body && <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.75] text-navy-800">{post.body}</p>}

        {/* 사진 */}
        {post.images.length > 0 && (
          <div className="mt-4 space-y-2">
            {post.images.map((im) => (
              /* 원본 비율 그대로 보여주고, 남는 여백은 같은 사진의 블러 배경으로 채운다 */
              <div key={im.id} className="relative max-h-[500px] overflow-hidden rounded-xl bg-black/40">
                <img src={im.url} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" />
                <img src={im.url} alt={im.alt || "조행기 사진"} loading="lazy" className="relative mx-auto max-h-[500px] w-full object-contain" />
              </div>
            ))}
          </div>
        )}

        {post.hashtags.length > 0 && (
          <p className="mt-3 text-[12.5px] font-medium text-aqua-300">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}

        {/* 피싱태그 */}
        {post.productTags.length > 0 && (
          <div className="mt-5 rounded-2xl border border-navy-100 bg-[#122030] p-3">
            <FishingTagCards postId={post.id} tags={post.productTags} />
          </div>
        )}
      </div>

      {/* 액션 바 */}
      <div className="flex items-center gap-2 border-y border-navy-100 px-4 py-3">
        <button onClick={toggleLike} className={cn("inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors btn-press", liked ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-navy-100 text-navy-600 hover:bg-navy-50")}>
          <Heart size={16} className={cn(liked && "fill-red-500 text-red-500")} /> 좋아요 {likeCount}
        </button>
        <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 px-4 py-2 text-[13px] font-semibold text-navy-600 transition-colors hover:bg-navy-50 btn-press">
          <Share2 size={16} /> 공유
        </button>
        <button onClick={toggleSave} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-navy-100 px-3.5 py-2 text-[13px] font-semibold text-navy-600 transition-colors hover:bg-navy-50 btn-press">
          <Bookmark size={16} className={cn(saved && "fill-navy-700 text-navy-700")} /> 저장
        </button>
      </div>

      <LogComments postId={post.id} count={post.commentCount} currentUserId={currentUserId} onRequireLogin={() => requireLogin("댓글 작성")} />

      <LoginRequiredModal open={loginModal} onClose={() => setLoginModal(false)} feature={loginFeature} />
    </article>
  );
}

function LogComments({ postId, count, currentUserId, onRequireLogin }: { postId: string; count: number; currentUserId?: string; onRequireLogin?: () => void }) {
  const toast = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  // 첨부 사진 (업로드 완료 URL 1장)
  const [photo, setPhoto] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ parentId: string; nickname: string } | null>(null);

  // 렌더 단계 fetch 호출(무한 재요청 위험) 대신 useEffect 로 1회만 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        if (!res.ok) throw new Error("load failed");
        const data = await res.json();
        if (!cancelled) setComments(data.comments || []);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  async function post(body: string, parentId?: string, imageUrl?: string | null) {
    if (!currentUserId) { onRequireLogin?.(); return false; }
    // 사진만 있는 댓글도 등록 가능
    if (!body.trim() && !imageUrl) return false;
    if (sending) return false; // 중복 제출 방지
    setSending(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), ...(parentId ? { parentId } : {}), ...(imageUrl ? { imageUrl } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || "오류", "error"); return false; }
      setComments((c) => [...c, data.comment]);
      return true;
    } catch {
      toast("댓글 등록에 실패했습니다", "error");
      return false;
    } finally {
      setSending(false);
    }
  }
  async function send() { if (await post(text, undefined, photo)) { setText(""); setPhoto(null); } }
  function startReply(comment: any) { setReplyTo({ parentId: comment.parentId || comment.id, nickname: comment.author.nickname }); }
  async function sendReply(parentId: string, body: string) { if (await post(body, parentId)) setReplyTo(null); }

  const top = comments.filter((c) => !c.parentId);
  const replies = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <section className="px-4 pt-4">
      <h2 className="mb-3 text-[14px] font-bold text-navy-900">댓글 {comments.length || count}</h2>
      <div className="space-y-3">
        {!loaded && <p className="py-4 text-center text-sm text-navy-300">불러오는 중...</p>}
        {loaded && loadError && <p className="py-4 text-center text-sm text-navy-300">댓글을 불러오지 못했습니다</p>}
        {loaded && !loadError && top.length === 0 && <p className="py-4 text-center text-sm text-navy-300">첫 댓글을 남겨보세요</p>}
        {top.map((c) => (
          <div key={c.id}>
            <LogCommentRow c={c} onReply={() => startReply(c)} />
            {replies(c.id).map((r) => (
              <div key={r.id} className="ml-10 mt-2"><LogCommentRow c={r} onReply={() => startReply(r)} /></div>
            ))}
            {replyTo && replyTo.parentId === c.id && (
              <div className="ml-10 mt-2">
                <LogReplyInput
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
      <div className="sticky bottom-0 mt-4 bg-[#0d1b2a] py-3">
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={currentUserId ? "댓글 달기..." : "로그인 후 댓글을 달 수 있어요"}
            className="flex-1 rounded-full border border-navy-100 bg-[#162538] px-4 py-2.5 text-sm text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-500" />
          <CommentPhotoButton disabled={!currentUserId} onUploaded={setPhoto} onError={(m) => toast(m, "error")} />
          {/* 내용·사진이 모두 없으면 보낼 게 없으므로 비활성 */}
          <button onClick={send} disabled={sending || (!text.trim() && !photo)} aria-label="댓글 전송" className="rounded-full bg-orange-500 p-2.5 text-gray-900 shadow-soft btn-press hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-orange-500"><Send size={16} /></button>
        </div>
        {photo && <CommentPhotoPreview url={photo} onRemove={() => setPhoto(null)} />}
        <CommentRewardNotice className="mt-1.5" />
      </div>
    </section>
  );
}

function LogCommentRow({ c, onReply }: { c: any; onReply?: () => void }) {
  return (
    <div className="flex items-start gap-2.5">
      <img src={getAvatarUrl(c.author.id, c.author.avatarUrl)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-navy-100" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-[#162538] px-3.5 py-2.5">
          <p className="text-[13px] font-semibold text-navy-800">{c.author.nickname}</p>
          {c.body && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-navy-600">{c.body}</p>}
          {c.imageUrl && <CommentImage url={c.imageUrl} />}
        </div>
        <div className="mt-1 flex items-center gap-3 pl-3">
          <span className="text-[11px] text-navy-300">{timeAgo(c.createdAt)}</span>
          {onReply && (
            <button onClick={onReply} className="text-[11px] font-semibold text-navy-400 transition-colors hover:text-orange-400">답글 달기</button>
          )}
        </div>
      </div>
    </div>
  );
}

function LogReplyInput({ nickname, disabled, onCancel, onSubmit }: { nickname: string; disabled?: boolean; onCancel: () => void; onSubmit: (body: string) => void }) {
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
        className="flex-1 rounded-full border border-navy-100 bg-[#162538] px-3.5 py-2 text-[13px] text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-500"
      />
      <button onClick={() => onSubmit(text)} disabled={!text.trim()} aria-label="답글 전송" className="rounded-full bg-orange-500 p-2 text-gray-900 btn-press hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-orange-500"><Send size={14} /></button>
      <button onClick={onCancel} aria-label="답글 취소" className="rounded-full p-1.5 text-navy-300 transition-colors hover:bg-navy-50 hover:text-navy-500"><X size={16} /></button>
    </div>
  );
}
