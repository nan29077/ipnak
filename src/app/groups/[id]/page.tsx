"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { ArrowLeft, Users, MapPin, Fish, Settings, UserPlus, Loader2, CheckCircle, Clock, Crown, Heart, MessageCircle, Image as ImageIcon, Send, X, Lock, Navigation, Plus, Route } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { TripDetailSheet, type TripDetail } from "@/components/TripDetailSheet";

const GroupPointsMapDynamic = dynamic(
  () => import("@/components/GroupPointsMap").then((m) => m.GroupPointsMap),
  { ssr: false, loading: () => <div className="h-60 w-full animate-pulse rounded-xl bg-navy-50/10" /> }
);

type Group = {
  id: string; name: string; description: string | null; category: string;
  region: string | null; fishSpecies: string | null; leaderNickname: string;
  leaderAvatar: string | null; memberCount: number; imageUrl: string | null;
  leaderId: string; tags: string[]; createdAt: string; myRole: string | null;
};

type GroupPost = {
  id: string; groupId: string; authorId: string; authorNickname: string;
  authorAvatar: string | null; content: string; imageUrl: string | null;
  likeCount: number; commentCount: number; liked: boolean; createdAt: string;
};

type GroupComment = {
  id: string; postId: string; authorId: string; authorNickname: string;
  authorAvatar: string | null; content: string; createdAt: string;
};

type GroupMemberItem = {
  id: string; userId: string; joinedAt: string;
  nickname: string; avatarUrl: string | null;
  role?: string; email?: string;
};

type TabKey = "home" | "community" | "points" | "members";

type GroupPointItem = {
  id: string; lat: number; lng: number; title: string;
  description?: string | null; authorId: string;
  authorNickname: string; authorAvatar: string | null; createdAt: string;
  tripId?: string | null; distanceM?: number | null; durationSec?: number | null; catchCount?: number | null;
};

type MyFishingTrip = {
  id: string; title?: string | null; distanceM: number; durationSec: number;
  catchCount: number; region?: string | null; createdAt: string;
};

function isApproved(role: string | null) {
  return role === "leader" || role === "sub_leader" || role === "member";
}

function Avatar({ name, url, size = 9 }: { name: string; url: string | null; size?: number }) {
  const cls = size === 7 ? "h-7 w-7 text-[12px]" : "h-9 w-9 text-[14px]";
  return url ? (
    <img src={url} alt={name} className={`${cls} shrink-0 rounded-full object-cover`} />
  ) : (
    <div className={`flex ${cls} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-aqua-500 font-bold text-white`}>
      {name ? name.charAt(0) : "?"}
    </div>
  );
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("home");

  useEffect(() => {
    (async () => {
      const [gRes] = await Promise.all([fetch(`/api/groups/${id}`)]);
      const gData = await gRes.json();
      setGroup(gData.group || null);
      setLoading(false);
    })();
  }, [id]);

  async function join() {
    setJoining(true); setJoinError("");
    const res = await fetch(`/api/groups/${id}/join`, { method: "POST" });
    const data = await res.json();
    setJoining(false);
    if (!res.ok) { setJoinError(data.error || "오류가 발생했습니다."); return; }
    setJoined(true);
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#161616]">
      <Loader2 size={24} className="animate-spin text-orange-500" />
    </div>
  );

  if (!group) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#161616]">
      <p className="text-navy-400">낚시단을 찾을 수 없습니다.</p>
      <Link href="/groups" className="text-orange-500 underline text-sm">목록으로</Link>
    </div>
  );

  const member = isApproved(group.myRole);

  return (
    <div className="min-h-screen bg-[#161616] pb-20">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-navy-100/20 px-3.5 py-3">
        <Link href="/groups"><ArrowLeft size={20} className="text-navy-400" /></Link>
        <h1 className="flex-1 truncate text-[16px] font-extrabold text-navy-900">{group.name}</h1>
        {group.myRole === "leader" && (
          <Link href={`/groups/${id}/manage`} className="rounded-full p-2 text-navy-400 hover:bg-navy-50/10">
            <Settings size={18} />
          </Link>
        )}
      </div>

      {/* 배너 이미지 */}
      {group.imageUrl && (
        <div className="h-36 w-full overflow-hidden">
          <img src={group.imageUrl} alt={group.name} className="h-full w-full object-cover" />
        </div>
      )}

      {/* 탭 */}
      <div className="flex border-b border-navy-100/20">
        {([["home", "홈"], ["community", "커뮤니티"], ["points", "포인트 공유"], ["members", "회원"]] as [TabKey, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-3 text-[13px] font-bold transition-colors ${
              tab === key ? "border-b-2 border-orange-500 text-orange-400" : "text-navy-400 hover:text-navy-600"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <div className="p-4 space-y-4">
          {/* 기본 정보 */}
          <div className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-extrabold text-navy-900">{group.name}</p>
                <span className="mt-1 inline-block rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-400">{group.category}</span>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-aqua-500/20">
                <Fish size={22} className="text-orange-400" strokeWidth={1.5} />
              </div>
            </div>

            {group.description && (
              <p className="mt-3 text-[13px] leading-relaxed text-navy-400">{group.description}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-navy-300">
              <span className="inline-flex items-center gap-1"><Users size={12} /> 회원 {group.memberCount}명</span>
              {group.region && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {group.region}</span>}
              {group.fishSpecies && <span className="inline-flex items-center gap-1"><Fish size={12} /> {group.fishSpecies}</span>}
            </div>

            {group.tags && group.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.tags.map((t: string) => (
                  <span key={t} className="rounded-full bg-navy-50/15 px-2 py-0.5 text-[11px] text-navy-400">#{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* 단장 정보 */}
          <div className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-4">
            <p className="mb-2 text-[12px] font-bold text-navy-400">낚시단 단장</p>
            <div className="flex items-center gap-2.5">
              {group.leaderAvatar ? (
                <img src={group.leaderAvatar} alt={group.leaderNickname} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-aqua-500 text-[14px] font-bold text-white">
                  {group.leaderNickname.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-navy-800">{group.leaderNickname}</p>
                <p className="text-[11px] text-orange-400">{group.name} 단장</p>
              </div>
            </div>
          </div>

          {/* 가입 신청 */}
          {joinError && (
            <div className="rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-400">{joinError}</div>
          )}

          {group.myRole === "leader" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-2xl bg-orange-500/10 px-4 py-3.5 text-[14px] font-semibold text-orange-400">
                <Crown size={18} strokeWidth={1.5} /> 내가 운영하는 낚시단입니다
              </div>
              <Link href={`/groups/${id}/manage`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-extrabold text-white shadow-soft">
                <Settings size={18} /> 낚시단 관리
              </Link>
            </div>
          ) : group.myRole === "member" || group.myRole === "sub_leader" ? (
            <div className="flex items-center gap-2 rounded-2xl bg-green-500/10 px-4 py-3.5 text-[14px] font-semibold text-green-400">
              <CheckCircle size={18} /> 가입된 낚시단입니다
            </div>
          ) : group.myRole === "pending" || joined ? (
            <div className="flex items-center gap-2 rounded-2xl bg-navy-50/10 px-4 py-3.5 text-[14px] font-semibold text-navy-400">
              <Clock size={18} strokeWidth={1.5} /> 가입 승인 대기 중입니다. 단장의 승인을 기다려주세요.
            </div>
          ) : (
            <button onClick={join} disabled={joining}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-extrabold text-white shadow-soft disabled:opacity-60">
              {joining ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {joining ? "신청 중..." : "가입 신청하기"}
            </button>
          )}
        </div>
      )}

      {tab === "community" && (
        member ? (
          <CommunityTab groupId={id} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-50/10">
              <Lock size={24} className="text-navy-400" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold text-navy-600">낚시단 회원만 이용할 수 있습니다</p>
            <p className="text-[12px] text-navy-400">가입 후 커뮤니티에서 회원들과 소통해보세요.</p>
          </div>
        )
      )}

      {tab === "points" && (
        member ? (
          <PointsTab groupId={id} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-50/10">
              <Lock size={24} className="text-navy-400" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold text-navy-600">낚시단 회원만 이용할 수 있습니다</p>
            <p className="text-[12px] text-navy-400">가입 후 포인트를 공유하고 확인할 수 있습니다.</p>
          </div>
        )
      )}

      {tab === "members" && (
        member ? (
          <MembersTab groupId={id} isLeader={group.myRole === "leader"} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-50/10">
              <Lock size={24} className="text-navy-400" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold text-navy-600">낚시단 회원만 이용할 수 있습니다</p>
            <p className="text-[12px] text-navy-400">가입 후 회원 목록을 확인할 수 있습니다.</p>
          </div>
        )
      )}
    </div>
  );
}

/* ===== 커뮤니티 탭 ===== */

function CommunityTab({ groupId }: { groupId: string }) {
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/groups/${groupId}/posts`);
      const data = await res.json();
      if (res.ok) setPosts(data.posts || []);
      else setError(data.error || "피드를 불러오지 못했습니다.");
      setLoading(false);
    })();
  }, [groupId]);

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError("이미지는 4MB 이하만 업로드할 수 있습니다."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function submit() {
    if ((!content.trim() && !imageData) || submitting) return;
    setSubmitting(true); setError("");
    const res = await fetch(`/api/groups/${groupId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), imageUrl: imageData || undefined }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error || "글 작성에 실패했습니다."); return; }
    setPosts((prev) => [data.post, ...prev]);
    setContent(""); setImageData(null);
  }

  return (
    <div className="p-4 space-y-3">
      {/* 글쓰기 박스 */}
      <div className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="낚시단 회원들과 이야기를 나눠보세요..."
          className="w-full resize-none bg-transparent text-[13px] text-navy-800 outline-none placeholder:text-navy-400"
          rows={3}
        />
        {imageData && (
          <div className="relative mt-2 inline-block">
            <img src={imageData} alt="첨부 이미지" className="max-h-40 rounded-xl object-cover" />
            <button onClick={() => setImageData(null)}
              className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
              <X size={13} />
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => fileRef.current?.click()} className="p-1 text-navy-300 hover:text-orange-400">
            <ImageIcon size={18} strokeWidth={1.5} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
          <button onClick={submit} disabled={submitting || (!content.trim() && !imageData)}
            className="rounded-full bg-orange-500 px-4 py-1.5 text-[13px] font-bold text-white disabled:opacity-50">
            {submitting ? "올리는 중..." : "올리기"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-400">{error}</div>
      )}

      {/* 피드 목록 */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin text-orange-500" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <MessageCircle size={26} className="text-navy-300" strokeWidth={1.5} />
          <p className="text-[13px] text-navy-400">아직 올라온 글이 없습니다. 첫 글을 남겨보세요!</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} groupId={groupId} post={post}
            onUpdate={(updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))} />
        ))
      )}
    </div>
  );
}

function PostCard({ groupId, post, onUpdate }: { groupId: string; post: GroupPost; onUpdate: (p: GroupPost) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<GroupComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);

  async function toggleLike() {
    if (liking) return;
    setLiking(true);
    const res = await fetch(`/api/groups/${groupId}/posts/${post.id}/like`, { method: "POST" });
    const data = await res.json();
    setLiking(false);
    if (res.ok) onUpdate({ ...post, liked: data.liked, likeCount: data.likeCount });
  }

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) {
      setCommentsLoading(true);
      const res = await fetch(`/api/groups/${groupId}/posts/${post.id}/comments`);
      const data = await res.json();
      setCommentsLoading(false);
      if (res.ok) setComments(data.comments || []);
    }
  }

  async function submitComment() {
    if (!commentInput.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    const res = await fetch(`/api/groups/${groupId}/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentInput.trim() }),
    });
    const data = await res.json();
    setCommentSubmitting(false);
    if (res.ok) {
      setComments((prev) => [...prev, data.comment]);
      setCommentInput("");
      onUpdate({ ...post, commentCount: post.commentCount + 1 });
    }
  }

  return (
    <div className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-3.5">
      {/* 작성자 */}
      <div className="flex items-center gap-2.5">
        <Avatar name={post.authorNickname} url={getAvatarUrl(post.authorId, post.authorAvatar)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-navy-800">{post.authorNickname}</p>
          <p className="text-[11px] text-navy-400">{timeAgo(post.createdAt)}</p>
        </div>
      </div>

      {/* 내용 */}
      {post.content && (
        <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-relaxed text-navy-700">{post.content}</p>
      )}

      {/* 이미지 */}
      {post.imageUrl && (
        <div className="mt-2.5 overflow-hidden rounded-xl">
          <img src={post.imageUrl} alt="게시글 이미지" className="w-full object-cover" />
        </div>
      )}

      {/* 좋아요 / 댓글 */}
      <div className="mt-3 flex items-center gap-4 border-t border-navy-100/10 pt-2.5">
        <button onClick={toggleLike} disabled={liking}
          className={`inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors ${
            post.liked ? "text-orange-400" : "text-navy-400 hover:text-orange-400"
          }`}>
          <Heart size={16} strokeWidth={1.5} className={post.liked ? "fill-orange-400" : ""} />
          {post.likeCount > 0 ? post.likeCount : "좋아요"}
        </button>
        <button onClick={openComments}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy-400 hover:text-orange-400">
          <MessageCircle size={16} strokeWidth={1.5} />
          {post.commentCount > 0 ? post.commentCount : "댓글"}
        </button>
      </div>

      {/* 댓글 영역 */}
      {showComments && (
        <div className="mt-2.5 space-y-2.5 border-t border-navy-100/10 pt-2.5">
          {commentsLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 size={16} className="animate-spin text-orange-500" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-1 text-center text-[12px] text-navy-400">첫 댓글을 남겨보세요.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar name={c.authorNickname} url={getAvatarUrl(c.authorId, c.authorAvatar)} size={7} />
                <div className="min-w-0 flex-1 rounded-xl bg-navy-50/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12px] font-bold text-navy-700">{c.authorNickname}</p>
                    <p className="shrink-0 text-[10px] text-navy-400">{timeAgo(c.createdAt)}</p>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-navy-600">{c.content}</p>
                </div>
              </div>
            ))
          )}

          {/* 댓글 입력 */}
          <div className="flex items-center gap-2">
            <input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitComment(); }}
              placeholder="댓글을 입력하세요..."
              className="min-w-0 flex-1 rounded-full bg-navy-50/10 px-3.5 py-2 text-[12px] text-navy-800 outline-none placeholder:text-navy-400"
            />
            <button onClick={submitComment} disabled={commentSubmitting || !commentInput.trim()}
              className="rounded-full bg-orange-500 p-2 text-white disabled:opacity-50">
              <Send size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== 포인트 공유 탭 ===== */

function PointsTab({ groupId }: { groupId: string }) {
  const [points, setPoints] = useState<GroupPointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [tripDetail, setTripDetail] = useState<TripDetail | null>(null);
  const [tripLoadingId, setTripLoadingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/points`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setPoints(data.points || []);
        else setError(data.error || "포인트를 불러오지 못했습니다.");
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  function onAdded(p: GroupPointItem) {
    setPoints((prev) => [p, ...prev]);
    setShowAdd(false);
  }

  async function openSharedTrip(point: GroupPointItem) {
    if (!point.tripId || tripLoadingId) return;
    setTripLoadingId(point.id);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/points/${point.id}/trip`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "데이터피싱 기록을 불러오지 못했습니다."); return; }
      setTripDetail(data.trip);
    } finally {
      setTripLoadingId(null);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-extrabold text-navy-900">공유 포인트</p>
          <p className="text-[12px] text-navy-400">회원들이 공유한 낚시 포인트</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-[13px] font-bold text-white shadow-soft">
          <Plus size={15} /> 포인트 추가
        </button>
      </div>

      {/* 지도 */}
      {!loading && (
        <div className="overflow-hidden rounded-2xl ring-1 ring-navy-100/20">
          <GroupPointsMapDynamic points={points} height={240} />
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-400">{error}</div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin text-orange-500" />
        </div>
      ) : points.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <MapPin size={26} className="text-navy-300" strokeWidth={1.5} />
          <p className="text-[13px] text-navy-400">아직 공유된 포인트가 없습니다.</p>
          <p className="text-[12px] text-navy-500">첫 번째 낚시 포인트를 공유해보세요!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {points.map((p) => (
            <div key={p.id} className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                  <MapPin size={18} className="text-orange-400" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-navy-900">{p.title}</p>
                  {p.description && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-navy-400">{p.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-navy-500">
                    <span>{p.authorNickname}</span>
                    <span>·</span>
                    <span>{timeAgo(p.createdAt)}</span>
                    <span>·</span>
                    <span className="font-mono text-aqua-400">
                      {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </span>
                  </div>
                  {p.tripId && (
                    <button
                      type="button"
                      onClick={() => openSharedTrip(p)}
                      disabled={tripLoadingId === p.id}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-orange-500/15 px-3 py-2 text-[12px] font-bold text-orange-400 ring-1 ring-orange-500/25 transition-colors hover:bg-orange-500/25 disabled:opacity-60"
                    >
                      {tripLoadingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
                      데이터피싱 무료로 보기
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 포인트 추가 모달 */}
      {showAdd && (
        <AddPointModal
          groupId={groupId}
          onClose={() => setShowAdd(false)}
          onAdded={onAdded}
        />
      )}
      <TripDetailSheet open={!!tripDetail} onClose={() => setTripDetail(null)} initial={tripDetail} />
    </div>
  );
}

/* ===== 포인트 추가 모달 ===== */

function AddPointModal({ groupId, onClose, onAdded }: {
  groupId: string;
  onClose: () => void;
  onAdded: (p: GroupPointItem) => void;
}) {
  const [step, setStep] = useState<"method" | "map" | "trips" | "form">("method");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [trips, setTrips] = useState<MyFishingTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);

  const handlePickOnMap = useCallback((la: number, lo: number) => {
    setLat(la); setLng(lo);
  }, []);

  async function useCurrentLocation() {
    if (!navigator.geolocation) { setError("이 브라우저는 GPS를 지원하지 않습니다."); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsLoading(false);
        setStep("form");
      },
      () => { setError("위치를 가져오지 못했습니다. 브라우저 위치 권한을 확인하세요."); setGpsLoading(false); },
      { timeout: 10000 }
    );
  }

  async function showMyFishingTrips() {
    setStep("trips");
    if (trips.length > 0) return;
    setTripsLoading(true); setError("");
    try {
      const res = await fetch("/api/trips", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "내 데이터피싱 기록을 불러오지 못했습니다."); return; }
      setTrips(data.trips || []);
    } finally { setTripsLoading(false); }
  }

  function selectTrip(trip: MyFishingTrip) {
    setTripId(trip.id);
    setTitle(trip.title || `${new Date(trip.createdAt).toLocaleDateString("ko-KR")} 데이터피싱`);
    setDescription(`${trip.region ? `${trip.region} · ` : ""}이동 ${(trip.distanceM / 1000).toFixed(1)}km · 조과 ${trip.catchCount}마리`);
    setStep("form");
  }

  async function submit() {
    if ((!tripId && (!lat || !lng)) || !title.trim()) { setError("위치와 제목은 필수입니다."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, tripId, title: title.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "포인트 등록에 실패했습니다."); return; }
      onAdded(data.point);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-[640px] rounded-t-[20px] border border-navy-100/20 bg-[#1e1e1e] px-4 pt-3"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
        {/* 헤더 */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy-200" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-navy-900">포인트 추가</h2>
          <button onClick={onClose} className="rounded-full p-1 text-navy-300 hover:bg-navy-50/10"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">{error}</div>
        )}

        {/* Step 1: 위치 선택 방법 */}
        {step === "method" && (
          <div className="space-y-3 pb-2">
            <p className="text-[13px] text-navy-400">위치를 어떻게 설정할까요?</p>
            <button onClick={useCurrentLocation} disabled={gpsLoading}
              className="flex w-full items-center gap-3 rounded-2xl border border-navy-100/20 bg-[#242424] p-4 text-left transition-colors hover:border-orange-500/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-aqua-500/15">
                {gpsLoading ? <Loader2 size={18} className="animate-spin text-aqua-400" /> : <Navigation size={18} className="text-aqua-400" strokeWidth={1.5} />}
              </span>
              <div>
                <p className="text-[14px] font-bold text-navy-900">현재 위치 사용</p>
                <p className="text-[12px] text-navy-400">GPS로 지금 있는 위치를 자동으로 설정</p>
              </div>
            </button>
            <button onClick={() => setStep("map")}
              className="flex w-full items-center gap-3 rounded-2xl border border-navy-100/20 bg-[#242424] p-4 text-left transition-colors hover:border-orange-500/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
                <MapPin size={18} className="text-orange-400" strokeWidth={1.5} />
              </span>
              <div>
                <p className="text-[14px] font-bold text-navy-900">지도에서 찾기</p>
                <p className="text-[12px] text-navy-400">지도를 탭해서 포인트 위치를 직접 선택</p>
              </div>
            </button>
            <button onClick={showMyFishingTrips}
              className="flex w-full items-center gap-3 rounded-2xl border border-navy-100/20 bg-[#242424] p-4 text-left transition-colors hover:border-orange-500/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
                <Route size={18} className="text-orange-400" strokeWidth={1.5} />
              </span>
              <div>
                <p className="text-[14px] font-bold text-navy-900">내 데이터피싱</p>
                <p className="text-[12px] text-navy-400">내가 기록한 이동 동선과 조과를 내시단에 공유</p>
              </div>
            </button>
          </div>
        )}

        {step === "trips" && (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pb-2">
            <button type="button" onClick={() => setStep("method")} className="mb-1 text-[12px] font-semibold text-orange-400">← 다른 방법 선택</button>
            {tripsLoading ? (
              <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-orange-500" /></div>
            ) : trips.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.04] px-4 py-8 text-center">
                <Route size={26} className="mx-auto text-navy-400" />
                <p className="mt-2 text-[13px] font-semibold text-navy-600">공유할 데이터피싱 기록이 없어요</p>
                <p className="mt-1 text-[11px] text-navy-400">데이터피싱을 종료한 뒤 다시 확인해 주세요.</p>
              </div>
            ) : trips.map((trip) => (
              <button key={trip.id} type="button" onClick={() => selectTrip(trip)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#242424] p-3.5 text-left transition-colors hover:border-orange-500/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15"><Route size={18} className="text-orange-400" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-navy-900">{trip.title || "데이터피싱 기록"}</span>
                  <span className="mt-0.5 block text-[11px] text-navy-400">{new Date(trip.createdAt).toLocaleDateString("ko-KR")} · {(trip.distanceM / 1000).toFixed(1)}km · 조과 {trip.catchCount}마리</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: 지도에서 위치 선택 */}
        {step === "map" && (
          <div className="space-y-3 pb-2">
            <p className="text-[12px] text-navy-400">지도를 탭해서 포인트 위치를 선택하세요 (빨간 핀)</p>
            <div className="overflow-hidden rounded-xl ring-1 ring-navy-100/20">
              <GroupPointsMapDynamic
                points={[]}
                pickMode
                onPick={handlePickOnMap}
                height={280}
              />
            </div>
            {lat && lng && (
              <p className="text-[12px] text-aqua-400">
                선택 위치: {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            )}
            <button onClick={() => setStep("form")} disabled={!lat || !lng}
              className="w-full rounded-2xl bg-orange-500 py-3 text-[14px] font-bold text-white disabled:opacity-40">
              이 위치로 선택
            </button>
          </div>
        )}

        {/* Step 3: 제목·설명 입력 */}
        {step === "form" && (
          <div className="space-y-3 pb-2">
            {lat && lng && (
              <div className="flex items-center gap-2 rounded-xl bg-aqua-500/10 px-3 py-2">
                <MapPin size={14} className="shrink-0 text-aqua-400" strokeWidth={1.5} />
                <span className="text-[12px] text-aqua-400 font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                <button onClick={() => { setLat(null); setLng(null); setStep("method"); }}
                  className="ml-auto text-navy-400 hover:text-navy-200"><X size={14} /></button>
              </div>
            )}
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-navy-400">포인트 이름 *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예) 한강 광나루 배스 포인트"
                className="w-full rounded-xl bg-[#2a2a2a] px-3.5 py-3 text-[13px] text-navy-800 outline-none placeholder:text-navy-500 ring-1 ring-navy-100/20 focus:ring-orange-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-navy-400">내용 (선택)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="포인트에 대한 간단한 설명을 적어주세요..."
                rows={3}
                className="w-full resize-none rounded-xl bg-[#2a2a2a] px-3.5 py-3 text-[13px] text-navy-800 outline-none placeholder:text-navy-500 ring-1 ring-navy-100/20 focus:ring-orange-500/50"
              />
            </div>
            <button onClick={submit} disabled={submitting || !title.trim() || (!tripId && (!lat || !lng))}
              className="w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-white shadow-soft disabled:opacity-50">
              {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : "포인트 공유하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== 회원 탭 ===== */

const ROLE_LABEL: Record<string, string> = {
  leader: "단장", sub_leader: "부단장", member: "단원", pending: "승인 대기",
};

function MembersTab({ groupId, isLeader }: { groupId: string; isLeader: boolean }) {
  const [members, setMembers] = useState<GroupMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const data = await res.json();
      if (res.ok) setMembers(data.members || []);
      else setError(data.error || "회원 목록을 불러오지 못했습니다.");
      setLoading(false);
    })();
  }, [groupId]);

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 size={22} className="animate-spin text-orange-500" />
    </div>
  );

  if (error) return (
    <div className="p-4">
      <div className="rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-400">{error}</div>
    </div>
  );

  return (
    <div className="p-4 space-y-2">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-navy-100/20 bg-[#1e1e1e] px-3.5 py-3">
          <Avatar name={m.nickname} url={getAvatarUrl(m.userId, m.avatarUrl)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-bold text-navy-800">{m.nickname}</p>
              {isLeader && m.role && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  m.role === "leader" ? "bg-orange-500/15 text-orange-400"
                  : m.role === "sub_leader" ? "bg-aqua-500/15 text-aqua-400"
                  : m.role === "pending" ? "bg-navy-50/15 text-navy-400"
                  : "bg-navy-50/15 text-navy-300"
                }`}>
                  {ROLE_LABEL[m.role] || m.role}
                </span>
              )}
            </div>
            <p className="text-[11px] text-navy-400">가입일 {new Date(m.joinedAt).toLocaleDateString("ko-KR")}</p>
          </div>
        </div>
      ))}
      {members.length === 0 && (
        <p className="py-10 text-center text-[13px] text-navy-400">회원이 없습니다.</p>
      )}
    </div>
  );
}
