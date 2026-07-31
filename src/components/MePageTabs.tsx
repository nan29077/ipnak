"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Fish, ShoppingBag, Settings, Navigation, Clock, Route,
  Tag, Heart, MessageCircle, Plus, Users, CalendarDays,
  ChevronRight, Coins, MapPin, Radio, Bell, Shield,
  MessageSquare, ThumbsUp, Users2, Megaphone, Satellite,
  UserX, Loader2,
} from "lucide-react";
import { DiarySheet } from "@/components/DiarySheet";
import { MyBallManager } from "@/components/BallLinkSection";
import TripMemoInline from "@/components/TripMemoInline";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import { IpnakBallPurchase } from "@/components/IpnakBallPurchase";
import { ProfileView } from "@/components/ProfileView";
import { Badge, Button } from "@/components/ui";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { won, kstFormat } from "@/lib/utils";
import { reservationCategoryLabel } from "@/lib/taxonomy";

// ── 알림 설정 패널 ─────────────────────────────────────
type NotifSettings = {
  pushEnabled: boolean;
  newComment: boolean;
  newLike: boolean;
  groupActivity: boolean;
  announcement: boolean;
  ballRelated: boolean;
};

const NOTIF_ITEMS: { key: keyof Omit<NotifSettings, "pushEnabled">; label: string; desc: string; Icon: React.ElementType }[] = [
  { key: "newComment",    label: "새 댓글 알림",     desc: "내 게시글에 댓글이 달릴 때",       Icon: MessageSquare },
  { key: "newLike",       label: "좋아요 알림",       desc: "내 게시글에 좋아요가 달릴 때",     Icon: ThumbsUp },
  { key: "groupActivity", label: "소모임 알림",       desc: "낚시단 새 소식 및 활동 알림",      Icon: Users2 },
  { key: "announcement",  label: "이벤트/공지 알림",  desc: "이벤트·공지사항 새 소식",          Icon: Megaphone },
  { key: "ballRelated",   label: "입낚볼 알림",       desc: "입낚볼 주문·배송 상태 알림",       Icon: Satellite },
];

function NotifToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
        checked ? "bg-orange-500" : "bg-navy-100/30"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [pushStatus, setPushStatus] = useState<"default" | "granted" | "denied" | "unsupported">("default");

  useEffect(() => {
    fetch("/api/me/notification-settings")
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch(() => {});

    if (typeof window !== "undefined" && "Notification" in window) {
      setPushStatus(Notification.permission as "default" | "granted" | "denied");
    } else {
      setPushStatus("unsupported");
    }
  }, []);

  const save = useCallback(async (patch: Partial<NotifSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await fetch("/api/me/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } finally {
      setSaving(false);
    }
  }, [settings]);

  async function requestPush() {
    if (pushStatus === "denied") return;
    if (pushStatus === "unsupported") return;
    if (pushStatus === "granted") {
      // 이미 허용 → 토글처럼 앱 레벨 설정만 끔
      await save({ pushEnabled: !(settings?.pushEnabled ?? false) });
      return;
    }
    const result = await Notification.requestPermission();
    setPushStatus(result);
    if (result === "granted") {
      await save({ pushEnabled: true });
    }
  }

  const pushLabel =
    pushStatus === "granted"
      ? (settings?.pushEnabled ? "알림 켜짐" : "알림 꺼짐")
      : pushStatus === "denied"
      ? "브라우저에서 차단됨"
      : pushStatus === "unsupported"
      ? "이 기기에서 미지원"
      : "알림 허용";

  const pushDesc =
    pushStatus === "denied"
      ? "브라우저 설정에서 직접 허용해 주세요"
      : pushStatus === "unsupported"
      ? "웹 알림을 지원하지 않는 환경입니다"
      : pushStatus === "granted"
      ? "각 항목별로 수신 여부를 설정하세요"
      : "버튼을 눌러 브라우저 알림을 허용하세요";

  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-navy-400">알림</p>
      <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
        {/* 푸시 알림 허용 버튼 */}
        <button
          type="button"
          onClick={requestPush}
          disabled={pushStatus === "denied" || pushStatus === "unsupported" || saving}
          className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors active:bg-white/5 disabled:cursor-default"
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            settings?.pushEnabled && pushStatus === "granted"
              ? "bg-orange-500/20 text-orange-400"
              : "bg-white/10 text-white/50"
          }`}>
            <Bell size={16} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-navy-800">푸시 알림</p>
            <p className="text-[12px] text-navy-400">{pushDesc}</p>
          </div>
          {pushStatus === "granted" ? (
            <NotifToggle
              checked={settings?.pushEnabled ?? false}
              onChange={(v) => save({ pushEnabled: v })}
            />
          ) : (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              pushStatus === "denied" || pushStatus === "unsupported"
                ? "bg-navy-100/20 text-navy-400"
                : "bg-orange-500 text-white"
            }`}>
              {pushLabel}
            </span>
          )}
        </button>

        {/* 종류별 스위치 */}
        {settings && NOTIF_ITEMS.map(({ key, label, desc, Icon }, i) => (
          <div key={key}>
            <div className="h-px bg-navy-100/15" />
            <div className={`flex items-center gap-3.5 px-4 py-3 transition-opacity ${
              !(settings.pushEnabled && pushStatus === "granted") ? "opacity-40" : ""
            }`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-navy-400">
                <Icon size={14} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-navy-700">{label}</p>
                <p className="text-[11px] text-navy-400">{desc}</p>
              </div>
              <NotifToggle
                checked={settings[key]}
                onChange={(v) => {
                  if (!(settings.pushEnabled && pushStatus === "granted")) return;
                  save({ [key]: v } as Partial<NotifSettings>);
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────

type BadgeTone = "navy" | "aqua" | "amber" | "red" | "green" | "gray";

const BOOKING_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  REQUESTED: { label: "예약요청", tone: "amber" },
  CONFIRMED: { label: "확정", tone: "aqua" },
  CANCELLED: { label: "취소", tone: "red" },
  DONE: { label: "이용완료", tone: "gray" },
};

type GridPost = { id: string; image: string | null; postType: string; sizeCm: number | null; speciesName: string | null; body?: string | null };

interface Props {
  user: { id: string; nickname: string; email: string; role: string; avatarUrl: string | null };
  isAdmin: boolean;
  shopEnabled: boolean;
  shopTagEnabled: boolean;
  reservationEnabled: boolean;
  pEnabled: boolean;
  ballEnabled: boolean;
  ballPriceRaw: number;
  keyringEnabled: boolean;
  keyringPriceRaw: number;
  openBallOnMount: boolean;
  pointBalance: number;
  recentTrips: Array<{
    id: string;
    title: string | null;
    region: string | null;
    distanceM: number;
    durationSec: number;
    startedAt: string;
    catchCount: number;
    routePoints: { lat: number; lng: number }[];
    catchPoints: { lat: number; lng: number }[];
    walkingFeedPostId: string | null;
    walkingFeedPublished: boolean;
  }>;
  myWalkingPosts: Array<{ id: string; body: string | null }>;
  marketSellCount: number;
  marketBuyCount: number;
  marketFavCount: number;
  marketChatCount: number;
  needsReplyChats: Array<{
    id: string;
    buyer: { id: string; nickname: string; avatarUrl: string | null };
    listing: { id: string; title: string };
    messages: Array<{ body: string }>;
  }>;
  myGroupMembers: any[];
  bookings: Array<{
    id: string;
    listingId: string;
    status: string;
    date: string;
    people: number;
    totalPrice: number;
    listing: { imageUrl: string | null; name: string; category: string };
  }>;
  posts: GridPost[];
  points: GridPost[];
  entries: { id: string; tournamentId: string; title: string; speciesName: string; sizeCm: number; status: string }[];
  bio: string | null;
}

const tabs = [
  { key: "fishing" as const, label: "낚시활동", Icon: Fish },
  { key: "market" as const, label: "마켓/쇼핑", Icon: ShoppingBag },
  { key: "settings" as const, label: "입낚볼/설정", Icon: Settings },
];

export function MePageTabs({
  user, isAdmin, shopEnabled, shopTagEnabled, reservationEnabled, pEnabled, ballEnabled, ballPriceRaw, keyringEnabled, keyringPriceRaw, openBallOnMount, pointBalance, recentTrips, myWalkingPosts,
  marketSellCount, marketBuyCount, marketFavCount, marketChatCount,
  needsReplyChats, myGroupMembers, bookings, posts, points, entries, bio,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab = (rawTab === "market" || rawTab === "settings") ? rawTab : "fishing";
  const [settingsSubTab, setSettingsSubTab] = useState<"ball" | "config">("ball");
  const [showBallNotifPanel, setShowBallNotifPanel] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [publishedTrips, setPublishedTrips] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const t of recentTrips) {
      if (t.walkingFeedPublished) map[t.id] = true;
    }
    return map;
  });
  const [publishingTrip, setPublishingTrip] = useState<string | null>(null);
  const [withdrawStep, setWithdrawStep] = useState<0 | 1 | 2>(0);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  function setActiveTab(tab: "fishing" | "market" | "settings") {
    router.replace(`/me?tab=${tab}`, { scroll: false });
  }

  const WITHDRAW_REASONS = [
    "더 이상 사용하지 않음",
    "다른 계정 사용",
    "서비스 불만족",
    "기타",
  ];

  async function handleTripPublish(tripId: string) {
    if (publishingTrip) return;
    setPublishingTrip(tripId);
    try {
      const res = await fetch(`/api/trips/${tripId}/publish`, { method: "POST" });
      if (res.ok) {
        setPublishedTrips((prev) => ({ ...prev, [tripId]: true }));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "워킹피드 게시에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setPublishingTrip(null);
    }
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      const res = await fetch("/api/auth/withdraw", { method: "DELETE" });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const d = await res.json();
        alert(d.error || "탈퇴 처리에 실패했습니다.");
        setWithdrawStep(0);
      }
    } catch {
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
      setWithdrawStep(0);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div>
      {/* ── 탭 바 ── */}
      <div className="sticky top-0 z-30 flex border-b border-navy-100/20 bg-[#0d1b2a]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors
              ${activeTab === tab.key
                ? "border-b-2 border-orange-500 text-orange-500"
                : "text-navy-400"}`}
          >
            <tab.Icon size={16} strokeWidth={1.8} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-3.5 pb-8 pt-3">

        {/* ══════════════════════════════════════════
            탭 1: 낚시활동
        ══════════════════════════════════════════ */}
        {activeTab === "fishing" && (
          <>
            {bio && <p className="px-1 text-sm leading-relaxed text-navy-500">{bio}</p>}

            {/* 낚시 활동 */}
            <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
              <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
                <Fish size={14} className="text-aqua-400" strokeWidth={1.8} />
                <p className="text-[13px] font-bold text-navy-700">낚시 활동</p>
              </div>
              <div className="p-3">
                {/* 한 줄 탭 UI */}
                <div className="flex overflow-hidden rounded-xl border border-navy-100/20">
                  <Link href="/trip" className="flex flex-1 flex-col items-center gap-1 py-3 text-center transition-colors hover:bg-white/5 active:bg-white/10 border-r border-navy-100/20">
                    <Route size={16} className="text-aqua-400" strokeWidth={1.8} />
                    <span className="text-[11px] font-semibold text-navy-600">낚시기록</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDiaryOpen(true)}
                    className="flex flex-1 flex-col items-center gap-1 py-3 text-center transition-colors hover:bg-white/5 active:bg-white/10 border-r border-navy-100/20"
                  >
                    <Navigation size={16} className="text-orange-400" strokeWidth={1.8} />
                    <span className="text-[11px] font-semibold text-navy-600">계측일지</span>
                  </button>
                  <Link href={`/profile/${user.id}`} className="flex flex-1 flex-col items-center gap-1 py-3 text-center transition-colors hover:bg-white/5 active:bg-white/10">
                    <Fish size={16} className="text-navy-500" strokeWidth={1.8} />
                    <span className="text-[11px] font-semibold text-navy-600">낚시방</span>
                  </Link>
                </div>
                <DiarySheet open={diaryOpen} onClose={() => setDiaryOpen(false)} groupByDate />

                {/* 최근 스마트피싱 */}
                {recentTrips.length > 0 && (
                  <div className="mt-3 border-t border-navy-100/15 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-bold text-navy-500">최근 스마트피싱</p>
                      <Link href="/trip" className="text-[11px] text-orange-400">전체보기 →</Link>
                    </div>
                    <div className="space-y-2">
                      {recentTrips.map((t) => {
                        const isPublished = publishedTrips[t.id] ?? false;
                        const isPublishing = publishingTrip === t.id;
                        const noRoute = t.routePoints.length < 2;
                        const distKm = t.distanceM >= 1000
                          ? `${(t.distanceM / 1000).toFixed(1)}km`
                          : `${Math.round(t.distanceM)}m`;
                        const h = Math.floor(t.durationSec / 3600);
                        const m = Math.floor((t.durationSec % 3600) / 60);
                        const dur = h > 0 ? `${h}시간 ${m}분` : `${m}분`;
                        return (
                          <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-2">
                            <Link href={`/trip/${t.id}`} className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-lg bg-[#1b2b3a]">
                              <MiniRouteMap points={t.routePoints} catchPoints={t.catchPoints} />
                            </Link>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-bold text-navy-700">스마트피싱 기록</p>
                              <p className="mt-0.5 text-[11px] text-navy-400">
                                {distKm} · {dur} · 피쉬 {t.catchCount}
                              </p>
                              {noRoute ? null : isPublished ? (
                                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-aqua-400/40 px-2 py-0.5 text-[10px] font-semibold text-aqua-400">
                                  워킹피드 게시됨
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isPublishing}
                                  onClick={() => handleTripPublish(t.id)}
                                  className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-orange-400/60 px-2 py-0.5 text-[10px] font-semibold text-orange-400 transition-colors hover:bg-orange-400/10 disabled:opacity-50"
                                >
                                  {isPublishing && <Loader2 size={10} className="animate-spin" />}
                                  {isPublishing ? "게시 중..." : "워킹피드에 올리기"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* 내 낚시단 */}
            <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
              <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
                <Users size={14} className="text-navy-400" />
                <p className="text-[13px] font-bold text-navy-700">내 낚시단</p>
                <Link href="/groups" className="ml-auto text-[11px] text-orange-400">전체보기 →</Link>
              </div>
              <div className="p-3">
                {myGroupMembers.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-[13px] text-navy-400">소속된 낚시단이 없습니다</p>
                    <Link href="/groups" className="mt-1 inline-block text-[12px] font-semibold text-orange-500">낚시단 찾기</Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myGroupMembers.map((g: any) => (
                      <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-aqua-500/20">
                          <Fish size={15} className="text-orange-400" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-navy-800">{g.name}</p>
                          <p className="text-[11px] text-navy-400">{g.category}{g.region ? ` · ${g.region}` : ""} · {Number(g.memberCount)}명</p>
                        </div>
                        {g.role === "leader" && (
                          <span className="shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">단장</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 내 예약 */}
            {reservationEnabled && (
              <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
                <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
                  <CalendarDays size={14} className="text-navy-400" />
                  <p className="text-[13px] font-bold text-navy-700">내 예약</p>
                </div>
                <div className="p-3">
                  {bookings.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-navy-400">예약 내역이 없습니다</p>
                  ) : (
                    <div className="space-y-2">
                      {bookings.map((b) => {
                        const st = BOOKING_STATUS[b.status];
                        return (
                          <Link key={b.id} href={`/reservations/${b.listingId}`} className="flex items-center gap-3 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-2.5">
                            <img src={b.listing.imageUrl || ""} alt={b.listing.name} className="h-11 w-11 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-navy-800">{b.listing.name}</p>
                              <p className="mt-0.5 text-[11px] text-navy-400">
                                {reservationCategoryLabel(b.listing.category)} · {kstFormat(b.date, "M월 d일")} · {b.people}명 · {won(b.totalPrice)}
                              </p>
                            </div>
                            {st && <Badge tone={st.tone}>{st.label}</Badge>}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ProfileView */}
            <div className="border-t border-navy-100 pt-2">
              <ProfileView posts={posts} points={points} entries={entries} />
            </div>

          </>
        )}

        {/* ══════════════════════════════════════════
            탭 2: 마켓/쇼핑
        ══════════════════════════════════════════ */}
        {activeTab === "market" && (
          <>
            {/* 중고마켓 */}
            <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
              <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
                <ShoppingBag size={14} className="text-orange-400" />
                <p className="text-[13px] font-bold text-navy-700">중고마켓</p>
                <Link href="/market" className="ml-auto text-[11px] text-orange-400">마켓 바로가기 →</Link>
              </div>
              <div className="p-3">
                {needsReplyChats.length > 0 && (
                  <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-black">
                        {needsReplyChats.length}
                      </span>
                      <p className="text-[13px] font-bold text-amber-400">답장이 필요한 채팅</p>
                    </div>
                    <div className="space-y-2">
                      {needsReplyChats.slice(0, 3).map((c) => (
                        <Link key={c.id} href={`/market/chats/${c.id}`} className="flex items-center gap-2.5 rounded-lg bg-[#0d1b2a]/50 px-2.5 py-2">
                          <img src={getAvatarUrl(c.buyer.id, c.buyer.avatarUrl)} alt={c.buyer.nickname} className="h-8 w-8 rounded-full object-cover ring-1 ring-navy-100/20" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold text-navy-800">{c.buyer.nickname}</p>
                            <p className="truncate text-[11px] text-navy-400">{c.listing.title}</p>
                            <p className="truncate text-[11px] text-amber-300">{c.messages[0]?.body}</p>
                          </div>
                          <ChevronRight size={14} className="shrink-0 text-navy-400" />
                        </Link>
                      ))}
                      {needsReplyChats.length > 3 && (
                        <Link href="/market/chats" className="block pt-1 text-center text-[11px] text-amber-400">
                          +{needsReplyChats.length - 3}개 더 보기
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/market/mine" className="flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15">
                      <Tag size={15} className="text-orange-400" />
                    </div>
                    <div><p className="text-[12px] font-semibold text-navy-800">판매내역</p><p className="text-[10px] text-navy-400">{marketSellCount}개</p></div>
                  </Link>
                  <Link href="/market/purchases" className="flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua-400/15">
                      <ShoppingBag size={15} className="text-aqua-400" />
                    </div>
                    <div><p className="text-[12px] font-semibold text-navy-800">구매내역</p><p className="text-[10px] text-navy-400">{marketBuyCount}개</p></div>
                  </Link>
                  <Link href="/market/favorites" className="flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                      <Heart size={15} className="text-red-400" />
                    </div>
                    <div><p className="text-[12px] font-semibold text-navy-800">관심목록</p><p className="text-[10px] text-navy-400">{marketFavCount}개</p></div>
                  </Link>
                  <Link href="/market/chats" className="relative flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3">
                    {needsReplyChats.length > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {needsReplyChats.length}
                      </span>
                    )}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-300/15">
                      <MessageCircle size={15} className={needsReplyChats.length > 0 ? "text-red-400" : "text-navy-400"} />
                    </div>
                    <div><p className="text-[12px] font-semibold text-navy-800">채팅</p><p className="text-[10px] text-navy-400">{marketChatCount}개</p></div>
                  </Link>
                </div>
                <Link href="/market/new" className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5 text-[13px] font-semibold text-white">
                  <Plus size={15} /> 판매하기
                </Link>
              </div>
            </div>

            {/* 쇼핑 */}
            {shopEnabled && (
              <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
                <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
                  <ShoppingBag size={14} className="text-orange-400" />
                  <p className="text-[13px] font-bold text-navy-700">쇼핑</p>
                  <Link href="/shop" className="ml-auto text-[11px] text-orange-400">쇼핑몰 바로가기 →</Link>
                </div>
                <div className="divide-y divide-navy-100/15 px-4">
                  <Link href="/me/cart" className="flex items-center gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400"><ShoppingBag size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-navy-900">장바구니</span>
                      <span className="block text-[11px] text-navy-400">담아둔 상품 확인</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-navy-300" />
                  </Link>
                  <Link href="/me/orders" className="flex items-center gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-aqua-400/15 text-aqua-400"><Tag size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-navy-900">구매내역</span>
                      <span className="block text-[11px] text-navy-400">주문·배송 현황 확인</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-navy-300" />
                  </Link>
                  <Link href="/me/shipping" className="flex items-center gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-300/15 text-navy-400"><MapPin size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-navy-900">배송지 관리</span>
                      <span className="block text-[11px] text-navy-400">배송지 추가·수정</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-navy-300" />
                  </Link>
                </div>
              </div>
            )}

            {/* 포인트 & 혜택 */}
            {(pEnabled || shopTagEnabled) && (
              <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-[#162538]">
                <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
                  <Coins size={14} className="text-amber-400" />
                  <p className="text-[13px] font-bold text-navy-700">포인트 & 혜택</p>
                </div>
                <div className="divide-y divide-navy-100/15 px-4">
                  {pEnabled && (
                    <Link href="/me/points" className="flex items-center gap-3 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-[#0d1b2a]"><Coins size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-navy-900">포인트 관리</span>
                        <span className="block text-[11px] text-navy-400">적립·사용 내역, 충전, 친구에게 선물</span>
                      </span>
                      <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-amber-400">
                        {pointBalance.toLocaleString()}<span className="text-[11px] text-amber-400/70">P</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-navy-300" />
                    </Link>
                  )}
                  {shopTagEnabled && (
                    <Link href="/referral" className="flex items-center gap-3 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white"><Tag size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-navy-900">피싱태그 수익</span>
                        <span className="block text-[11px] text-navy-400">내 글의 피싱태그로 적립된 리퍼럴 수익</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-navy-300" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            탭 3: 입낚볼/설정
        ══════════════════════════════════════════ */}
        {activeTab === "settings" && (
          <>
            {/* 서브탭 바 */}
            <div className="flex gap-1 rounded-xl bg-[#162538] p-1">
              <button
                onClick={() => setSettingsSubTab("ball")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition-colors ${
                  settingsSubTab === "ball"
                    ? "bg-orange-500 text-white"
                    : "text-navy-400 hover:text-navy-600"
                }`}
              >
                <Radio size={13} strokeWidth={2} />
                입낚볼
              </button>
              <button
                onClick={() => setSettingsSubTab("config")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition-colors ${
                  settingsSubTab === "config"
                    ? "bg-orange-500 text-white"
                    : "text-navy-400 hover:text-navy-600"
                }`}
              >
                <Settings size={13} strokeWidth={2} />
                설정
              </button>
            </div>

            {/* 서브탭: 입낚볼 */}
            {settingsSubTab === "ball" && (
              <div className="space-y-2">
                {(user.role === "ANGLER" || user.role === "SUPER_ADMIN") && (ballEnabled || keyringEnabled) ? (
                  <>
                    <IpnakBallPurchase
                      price={ballPriceRaw}
                      buyer={{ name: user.nickname, email: user.email }}
                      openOnMount={openBallOnMount}
                      ballEnabled={ballEnabled}
                      keyringEnabled={keyringEnabled}
                      keyringPrice={keyringPriceRaw}
                    />
                    <MyBallManager />
                  </>
                ) : (
                  <div className="rounded-2xl border border-navy-100/20 bg-[#162538] px-4 py-8 text-center">
                    <p className="text-[13px] text-navy-400">입낚볼 서비스를 이용할 수 없습니다</p>
                  </div>
                )}

                {/* 알림 설정 토글 버튼 */}
                <button
                  type="button"
                  onClick={() => setShowBallNotifPanel((p) => !p)}
                  className="flex w-full items-center gap-3.5 rounded-2xl border border-navy-100/20 bg-[#162538] px-4 py-3.5 transition-colors active:bg-white/5"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${showBallNotifPanel ? "bg-orange-500/20 text-orange-400" : "bg-white/10 text-white/60"}`}>
                    <Bell size={16} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[14px] font-medium text-navy-800">알림 설정</p>
                    <p className="text-[12px] text-navy-400">알림 종류별 수신 여부 설정</p>
                  </div>
                  <ChevronRight
                    size={16}
                    strokeWidth={2}
                    className={`shrink-0 text-navy-300 transition-transform duration-200 ${showBallNotifPanel ? "rotate-90" : ""}`}
                  />
                </button>

                {/* 알림 설정 패널 (슬라이드 표시) */}
                {showBallNotifPanel && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <NotificationSettingsPanel />
                  </div>
                )}
              </div>
            )}

            {/* 서브탭: 설정 */}
            {settingsSubTab === "config" && (
              <div className="space-y-3">
                {/* 알림 */}
                <NotificationSettingsPanel />



                {/* 계정 */}
                <div>
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-navy-400">계정</p>
                  <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
                    <div className="flex items-center gap-3.5 px-4 py-3.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60">
                        <Shield size={16} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-navy-800">이메일</p>
                        <p className="truncate text-[12px] text-navy-400">{user.email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 회원탈퇴 */}
                <div>
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-navy-400">위험 구역</p>
                  <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-[#162538]">
                    <button
                      type="button"
                      onClick={() => setWithdrawStep(1)}
                      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors active:bg-white/5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                        <UserX size={16} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-red-400">회원탈퇴</p>
                        <p className="text-[12px] text-navy-400">탈퇴 시 모든 데이터가 삭제됩니다</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 관리자 */}
                {isAdmin && (
                  <div>
                    <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-navy-400">관리</p>
                    <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
                      <Link href="/admin" className="flex items-center gap-3.5 px-4 py-3.5 transition-colors active:bg-white/5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
                          <Shield size={16} strokeWidth={1.8} />
                        </span>
                        <p className="text-[14px] font-medium text-navy-800">관리자 페이지</p>
                        <ChevronRight size={15} className="ml-auto text-navy-300" strokeWidth={2} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* ══ 회원탈퇴 모달 Step 1: 이유 선택 ══ */}
      {withdrawStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-t-3xl bg-[#162538] p-6 pb-10">
            <h3 className="mb-1 text-[16px] font-bold text-navy-800">탈퇴 이유를 알려주세요</h3>
            <p className="mb-4 text-[13px] text-navy-400">더 나은 서비스를 만드는 데 도움이 됩니다.</p>
            <div className="space-y-2">
              {WITHDRAW_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setWithdrawReason(r)}
                  className={`flex w-full items-center rounded-xl border px-4 py-3 text-left text-[14px] font-medium transition-colors ${
                    withdrawReason === r
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-navy-100/20 text-navy-600 active:bg-white/5"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { setWithdrawStep(0); setWithdrawReason(""); }}
                className="flex-1 rounded-xl border border-navy-100/20 py-3 text-[14px] font-semibold text-navy-400"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => withdrawReason && setWithdrawStep(2)}
                disabled={!withdrawReason}
                className="flex-1 rounded-xl bg-red-500 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 회원탈퇴 모달 Step 2: 최종 확인 ══ */}
      {withdrawStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-t-3xl bg-[#162538] p-6 pb-10">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
              <UserX size={22} className="text-red-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-[16px] font-bold text-red-400">정말 탈퇴하시겠습니까?</h3>
            <p className="mb-1 text-[13px] text-navy-500">탈퇴 이유: <span className="font-semibold text-navy-700">{withdrawReason}</span></p>
            <p className="text-[13px] text-navy-400">탈퇴 시 모든 데이터가 영구 삭제되며 복구할 수 없습니다.</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setWithdrawStep(1)}
                className="flex-1 rounded-xl border border-navy-100/20 py-3 text-[14px] font-semibold text-navy-400"
              >
                뒤로
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                {withdrawing && <Loader2 size={15} className="animate-spin" />}
                {withdrawing ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
