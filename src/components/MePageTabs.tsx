"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Fish, ShoppingBag, Settings, Navigation, Clock, Route,
  Tag, Heart, MessageCircle, Plus, Users, CalendarDays,
  ChevronRight, Coins, MapPin, Radio,
} from "lucide-react";
import { MeDiaryButton } from "@/components/MeDiaryButton";
import { MyBallManager } from "@/components/BallLinkSection";
import TripMemoInline from "@/components/TripMemoInline";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import { IpnakBallPurchase } from "@/components/IpnakBallPurchase";
import { ProfileView } from "@/components/ProfileView";
import { MeActions } from "@/components/MeActions";
import { Badge, Button } from "@/components/ui";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { won, kstFormat } from "@/lib/utils";
import { reservationCategoryLabel } from "@/lib/taxonomy";

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
  user, isAdmin, shopEnabled, shopTagEnabled, reservationEnabled, pEnabled, ballEnabled,
  ballPriceRaw, openBallOnMount, pointBalance, recentTrips, myWalkingPosts,
  marketSellCount, marketBuyCount, marketFavCount, marketChatCount,
  needsReplyChats, myGroupMembers, bookings, posts, points, entries, bio,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab = (rawTab === "market" || rawTab === "settings") ? rawTab : "fishing";

  function setActiveTab(tab: "fishing" | "market" | "settings") {
    router.replace(`/me?tab=${tab}`, { scroll: false });
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
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/trip"><Button variant="outline" full>낚시 기록 전체보기</Button></Link>
                  <MeDiaryButton />
                </div>
                <div className="mt-2">
                  <Link href={`/profile/${user.id}`}><Button variant="outline" full>내낚시방</Button></Link>
                </div>

                {/* 최근 스마트피싱 */}
                {recentTrips.length > 0 && (
                  <div className="mt-3 border-t border-navy-100/15 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-bold text-navy-500">최근 스마트피싱</p>
                      <Link href="/trip" className="text-[11px] text-orange-400">전체보기 →</Link>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {recentTrips.map((t) => (
                        <Link key={t.id} href={`/trip/${t.id}`} className="relative aspect-square overflow-hidden rounded-xl bg-[#1b2b3a]">
                          {t.routePoints.length >= 2
                            ? <MiniRouteMap points={t.routePoints} />
                            : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                                <Route size={20} className="text-aqua-300/50" />
                                <p className="text-[9px] text-navy-400">
                                  {(t.title || (t.region ? `${t.region}` : "출조")).replace(/데이터피싱/g, "스마트피싱")}
                                </p>
                              </div>
                            )}
                          {t.catchCount > 0 && (
                            <div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5">
                              <Fish size={9} className="text-aqua-300" />
                              <span className="text-[9px] font-bold text-white">{t.catchCount}</span>
                            </div>
                          )}
                        </Link>
                      ))}
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
            {/* 입낚볼 */}
            {user.role === "ANGLER" && ballEnabled && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-1">
                  <Radio size={13} className="text-orange-400" />
                  <p className="text-[12px] font-bold text-navy-500">입낚볼</p>
                </div>
                <div className="space-y-2">
                  <IpnakBallPurchase
                    price={ballPriceRaw}
                    buyer={{ name: user.nickname, email: user.email }}
                    openOnMount={openBallOnMount}
                  />
                  <MyBallManager />
                </div>
              </div>
            )}

            {/* 입낚볼관리/알림설정 · 관리자 · 로그아웃 */}
            <div className="mt-2 border-t border-navy-100/20 pt-3">
              <MeActions isAdmin={isAdmin} />
            </div>
          </>
        )}

      </div>
    </div>
  );
}
