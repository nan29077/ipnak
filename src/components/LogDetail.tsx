"use client";
import { useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Share2, Bookmark, Eye, Send, MapPin } from "lucide-react";
import { useToast } from "@/components/Toast";
import { FishingTagCards } from "@/components/FishingTagCards";
import { logCategoryLabel } from "@/lib/taxonomy";
import { timeAgo, cn } from "@/lib/utils";
import type { FeedPost } from "@/lib/queries";

export function LogDetail({ post, currentUserId }: { post: FeedPost; currentUserId?: string }) {
  const toast = useToast();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.saved);

  async function toggleLike() {
    setLiked((v) => !v); setLikeCount((c) => c + (liked ? -1 : 1));
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) { setLiked(post.liked); setLikeCount(post.likeCount); toast("로그인이 필요합니다", "error"); }
  }
  async function toggleSave() {
    setSaved((v) => !v);
    const res = await fetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
    if (!res.ok) { setSaved(post.saved); toast("로그인이 필요합니다", "error"); }
    else toast(saved ? "저장을 취소했습니다" : "저장했습니다", "success");
  }
  async function share() {
    const url = `${location.origin}/log/${post.id}`;
    fetch(`/api/posts/${post.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "link" }) });
    try { await navigator.clipboard.writeText(url); toast("링크를 복사했습니다", "success"); }
    catch { toast("공유 링크: " + url, "info"); }
  }

  return (
    <article className="pb-10">
      {/* 제목 영역 */}
      <div className="border-b border-navy-100 px-4 pb-3.5 pt-4">
        <span className="inline-flex items-center rounded-md bg-orange-500/15 px-2 py-0.5 text-[12px] font-bold text-orange-400">
          {logCategoryLabel(post.boardCategory)}
        </span>
        <h1 className="mt-2 text-[20px] font-extrabold leading-snug tracking-tight text-navy-900">{post.title || "(제목 없음)"}</h1>
        <div className="mt-2.5 flex items-center gap-2.5">
          <Link href={`/profile/${post.author.id}`}>
            <img src={post.author.avatarUrl || "https://i.pravatar.cc/80"} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-navy-100" />
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
              <img key={im.id} src={im.url} alt={im.alt || "조행기 사진"} loading="lazy" className="w-full rounded-xl object-cover" />
            ))}
          </div>
        )}

        {post.hashtags.length > 0 && (
          <p className="mt-3 text-[12.5px] font-medium text-aqua-300">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}

        {/* 피싱태그 */}
        {post.productTags.length > 0 && (
          <div className="mt-5 rounded-2xl border border-navy-100 bg-[#1a1a1a] p-3">
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

      <LogComments postId={post.id} count={post.commentCount} currentUserId={currentUserId} />
    </article>
  );
}

function LogComments({ postId, count, currentUserId }: { postId: string; count: number; currentUserId?: string }) {
  const toast = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");

  async function load() {
    const res = await fetch(`/api/posts/${postId}/comments`);
    const data = await res.json();
    setComments(data.comments || []);
    setLoaded(true);
  }
  if (!loaded) load();

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

  return (
    <section className="px-4 pt-4">
      <h2 className="mb-3 text-[14px] font-bold text-navy-900">댓글 {comments.length || count}</h2>
      <div className="space-y-3">
        {!loaded && <p className="py-4 text-center text-sm text-navy-300">불러오는 중...</p>}
        {loaded && top.length === 0 && <p className="py-4 text-center text-sm text-navy-300">첫 댓글을 남겨보세요</p>}
        {top.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <img src={c.author.avatarUrl || "https://i.pravatar.cc/60"} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-navy-100" />
            <div className="min-w-0 flex-1 rounded-2xl bg-[#1e1e1e] px-3.5 py-2.5">
              <p className="text-[13px] font-semibold text-navy-800">{c.author.nickname}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-navy-600">{c.body}</p>
              <p className="mt-1 text-[11px] text-navy-300">{timeAgo(c.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 mt-4 flex items-center gap-2 bg-[#161616] py-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={currentUserId ? "댓글 달기..." : "로그인 후 댓글을 달 수 있어요"}
          className="flex-1 rounded-full border border-navy-100 bg-[#1e1e1e] px-4 py-2.5 text-sm text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-500" />
        <button onClick={send} aria-label="댓글 전송" className="rounded-full bg-orange-500 p-2.5 text-white shadow-soft btn-press hover:bg-orange-600"><Send size={16} /></button>
      </div>
    </section>
  );
}
