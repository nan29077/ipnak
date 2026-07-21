"use client";
import Link from "next/link";
import { ChevronRight, Flame, BadgeCheck, Route, Trophy, Clock, Lock, Sparkles } from "lucide-react";
import { useAppSettings } from "@/lib/appSettingsContext";
import { ScrollRail } from "@/components/ScrollRail";
import {
  IconEye, IconHeart, IconComment, IconFish, IconRuler, IconBook, IconStar, IconTrend, IconTrophy, IconMapPin, IconUsers,
} from "@/components/FishingIcon";
import { CommunityTabs } from "@/components/CommunityTabs";
import { AiPointRecommend } from "@/components/AiPointRecommend";
import { MiniRouteMap } from "@/components/MiniRouteMap";
import { FishingInterestPopup } from "@/components/FishingInterestPopup";
import type { FeedPost } from "@/lib/queries";
import type { CurationCardPost, ResolvedSection } from "@/lib/curation";
import { getAvatarUrl } from "@/lib/avatarUtils";

const SECTION_ICON: Record<string, React.ReactNode> = {
  member_pick: <IconStar size={16} className="text-orange-400" />,
  best_weekly: <Flame size={16} className="text-orange-400" />,
  best_monthly: <IconTrophy size={16} className="text-orange-400" />,
};
function iconFor(s: ResolvedSection) {
  if (SECTION_ICON[s.key]) return SECTION_ICON[s.key];
  if (s.type === "THEME") return <IconUsers size={16} className="text-orange-400" />;
  if (s.type === "REGION") return <IconMapPin size={16} className="text-orange-400" />;
  if (s.type === "BEST") return <Flame size={16} className="text-orange-400" />;
  return <IconFish size={16} className="text-orange-400" />;
}
function descFor(s: ResolvedSection) {
  if (s.style === "editorial") return "회원들이 만든 추천 글";
  if (s.style === "rank") return s.key === "best_weekly" ? "최근 7일 인기 글" : "인기 점수 순 베스트";
  if (s.type === "SPECIES") return "조황이 좋은 포인트";
  if (s.type === "REGION") return "이 지역 핫 포인트";
  if (s.type === "THEME") return "테마 추천 포인트";
  return "추천 글";
}

type OngoingTournament = {
  id: string; title: string; type: string; speciesName: string | null;
  startDate: string | null; endDate: string | null; entryCount: number;
};

export function CurationHome({
  feedPosts, walkingPosts, sections, banners, ongoingTournaments, currentUserId,
  personalizedPosts, userNickname, userInterests, hasInterests,
}: {
  feedPosts: FeedPost[];
  walkingPosts?: FeedPost[];
  sections: ResolvedSection[];
  banners?: { title: string; imageUrl: string | null }[];
  ongoingTournaments?: OngoingTournament[];
  currentUserId?: string;
  personalizedPosts?: FeedPost[];
  userNickname?: string;
  userInterests?: { methods: string[]; species: string[] };
  hasInterests?: boolean;
}) {
  const { bassOnlyMode, walkingFeedEnabled } = useAppSettings();

  // 배스 전용 모드: 배스 관련 피드/섹션만 표시
  const filteredFeedPosts = bassOnlyMode
    ? feedPosts.filter((p) => p.speciesName?.includes("배스"))
    : feedPosts;

  const visibleSections = sections.filter((s) => {
    if (s.posts.length === 0) return false;
    // 배스 전용 모드: SPECIES 섹션은 배스만 유지, 나머지 어종 섹션 제거
    if (bassOnlyMode && s.type === "SPECIES" && !s.speciesName?.includes("배스")) return false;
    return true;
  });

  return (
    <div className="min-h-screen pb-6">
      {/* 히어로 큐레이션 — 실제 바다 낚시 사진 배너 + 그라디언트 오버레이로 텍스트 가독성 확보 */}
      <section className="relative overflow-hidden pb-5 pt-6">
        <img
          src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* 반투명 오버레이: 위는 살짝, 아래로 갈수록 페이지 배경(#161616)과 자연스럽게 이어진다 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#161616]/60 via-[#161616]/75 to-[#161616]" aria-hidden />
        <div className="relative px-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-orange-400">IPNAK CURATION</p>
          <h1 className="mt-1.5 text-[24px] font-extrabold leading-[1.25] tracking-tight text-navy-900 drop-shadow-sm">
            이번 달, 어디로<br />출조할까요?
          </h1>
          <p className="mt-1.5 text-[13px] text-navy-600">회원들의 조황·조행기를 모아 오늘의 명당을 큐레이션했어요.</p>
          <div className="mt-3"><AiPointRecommend variant="bar" /></div>
        </div>
      </section>

      <div className="pt-1"><CommunityTabs /></div>

      {/* 피싱 피드 섹션 (고정) */}
      <section className="mt-4">
        <SectionHead title="피싱 피드" desc="회원들이 올린 따끈한 조황 사진" moreHref="/feed" icon={<IconFish size={16} className="text-orange-400" />} />
        {filteredFeedPosts.length === 0 ? (
          <EmptyRail text="아직 올라온 피싱 피드가 없어요" />
        ) : (
          <ScrollRail className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar" scrollAmount={320}>
            {filteredFeedPosts.slice(0, 12).map((p) => <FeedRailCard key={p.id} post={p} />)}
          </ScrollRail>
        )}
      </section>

      {/* 워킹 피드 섹션 — 데이터피싱 기록 (관리자 설정으로 on/off) */}
      {walkingFeedEnabled && (walkingPosts ?? []).length > 0 && (
        <section className="mt-6">
          <SectionHead title="워킹 피드" desc="데이터피싱 동선 기록" icon={<Route size={16} className="text-aqua-300" />} />
          <ScrollRail className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar" scrollAmount={320}>
            {(walkingPosts ?? []).slice(0, 12).map((p) => <WalkingRailCard key={p.id} post={p} />)}
          </ScrollRail>
        </section>
      )}

      {/* 맞춤 추천 피드 — 관심 어종/방식 기반 AI 큐레이션 */}
      {personalizedPosts && personalizedPosts.length > 0 && (
        <section className="mt-6">
          <div className="mb-2.5 px-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-aqua-400" />
              <span className="text-[14px] font-bold text-navy-800">
                {userNickname ? `${userNickname}님을 위한 맞춤 추천 피드` : "나를 위한 맞춤 추천 피드"}
              </span>
            </div>
            <p className="mt-0.5 pl-6 text-[11px] text-navy-500">
              {userInterests && [...userInterests.species, ...userInterests.methods].slice(0, 4).join(" · ")} 관련 피드
            </p>
          </div>
          <ScrollRail className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar" scrollAmount={320}>
            {personalizedPosts.slice(0, 12).map((p) => <FeedRailCard key={p.id} post={p} />)}
          </ScrollRail>
        </section>
      )}

      {/* 관리자가 정의한 동적 섹션 (순서대로) */}
      {visibleSections.map((s) => <CurationRail key={s.key} section={s} />)}

      {/* 진행 중 대회 슬라이더 */}
      {ongoingTournaments && ongoingTournaments.length > 0 && (
        <section className="mt-6">
          <div className="mb-2.5 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-orange-400" />
              <span className="text-[14px] font-bold text-navy-800">진행 중 대회</span>
              <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">{ongoingTournaments.length}</span>
            </div>
            <Link href="/tournaments" className="text-[11px] font-semibold text-orange-400">전체보기 →</Link>
          </div>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
            {ongoingTournaments.map((t) => {
              const TYPE_LABEL: Record<string, string> = { WEEKLY: "주간전", MONTHLY: "월간전", GRAND: "왕중왕전" };
              const endLabel = t.endDate ? new Date(t.endDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) : "";
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`} className="block w-[260px] shrink-0 snap-start">
                  <div className="rounded-2xl border border-navy-100 bg-gradient-to-br from-[#1a2a1a] to-[#1e1e1e] p-4">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">{TYPE_LABEL[t.type] ?? t.type}</span>
                      <span className="rounded-full bg-aqua-500/15 px-2 py-0.5 text-[10px] font-semibold text-aqua-400">진행중</span>
                    </div>
                    <p className="text-[15px] font-extrabold text-navy-900 leading-snug">{t.title}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-navy-400">
                      <span className="flex items-center gap-1"><Clock size={11} />{endLabel}까지</span>
                      <span>{t.entryCount}명 참가</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 배너 (대회 외 배너만 — 입점 배너 제외됨) */}
      {banners && banners.length > 0 && (
        <div className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 no-scrollbar">
          {banners.map((b, i) => (
            <div key={i} className="relative h-32 w-[18rem] shrink-0 snap-start overflow-hidden rounded-2xl bg-orange-500 shadow-card">
              {b.imageUrl && <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover opacity-85" />}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3.5">
                <p className="text-[15px] font-bold leading-snug text-white drop-shadow-sm">{b.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 조행기 더 보기 */}
      <div className="mt-6 px-4">
        <Link href="/log" className="flex items-center justify-between rounded-2xl border border-navy-100 bg-[#1a1a1a] px-4 py-3.5 transition-colors hover:bg-[#1e1e1e]">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-aqua-500/15 text-aqua-300"><IconBook size={18} /></span>
            <span>
              <span className="block text-[14px] font-bold text-navy-900">조행기 전체 보기</span>
              <span className="block text-[12px] text-navy-400">카페형 게시판에서 조행 후기를 읽어보세요</span>
            </span>
          </span>
          <ChevronRight size={18} className="text-navy-300" />
        </Link>
      </div>

      {/* 관심사 설정 팝업 — 로그인됐지만 관심사 미설정 시 표시 */}
      {currentUserId && (
        <FishingInterestPopup
          nickname={userNickname}
          hasInterests={!!hasInterests}
        />
      )}

    </div>
  );
}

function CurationRail({ section }: { section: ResolvedSection }) {
  if (section.style === "pro") return <ProRail section={section} />;
  return (
    <section className="mt-6">
      <SectionHead title={section.title} desc={descFor(section)} moreHref={section.more} icon={iconFor(section)} />
      <ScrollRail className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar" scrollAmount={300}>
        {section.posts.map((p, i) => section.style === "editorial"
          ? <EditorialCard key={p.id} post={p} />
          : <CurationCard key={p.id} post={p} rank={section.style === "rank" ? i + 1 : undefined} />)}
      </ScrollRail>
    </section>
  );
}

function ProRail({ section }: { section: ResolvedSection }) {
  const pro = section.pro;
  const name = pro?.name ?? section.title;
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-navy-50 ring-2 ring-orange-500/40">
            {pro?.imageUrl ? <img src={pro.imageUrl} alt={name} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-orange-400"><IconStar size={20} /></span>}
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-1 text-[17px] font-extrabold tracking-tight text-navy-900">
              <BadgeCheck size={16} className="shrink-0 text-orange-400" /> {name}
            </h2>
            <p className="truncate text-[12px] text-navy-400">{name}가 추천하는 이번 주 포인트로 가볼까요?</p>
          </div>
        </div>
        {section.more && (
          <Link href={section.more} className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold text-orange-400 hover:text-orange-300">
            프로글 <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <ScrollRail className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar" scrollAmount={300}>
        {section.posts.map((p) => <CurationCard key={p.id} post={p} />)}
      </ScrollRail>
    </section>
  );
}

function SectionHead({ title, desc, moreHref, icon }: { title: string; desc?: string; moreHref?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between px-4">
      <div>
        <h2 className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-tight text-navy-900">{icon}{title}</h2>
        {desc && <p className="mt-0.5 text-[12px] text-navy-400">{desc}</p>}
      </div>
      {moreHref && (
        <Link href={moreHref} className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold text-orange-400 hover:text-orange-300">
          전체보기 <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function FeedRailCard({ post }: { post: FeedPost }) {
  const thumb = post.images[0];
  return (
    <Link href={`/post/${post.id}`} className="block w-[150px] shrink-0">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-navy-50">
        {thumb?.url ? (
          <img
            src={thumb.url}
            alt={thumb.alt || "조황"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#242424] to-[#161616]">
            <IconFish size={30} className="text-navy-300" />
          </div>
        )}
        {post.speciesName && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-aqua-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            <IconFish size={9} />{post.speciesName}
          </span>
        )}
        {post.sizeCm != null && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-0.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            <IconRuler size={9} />{post.sizeCm}cm
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <img src={getAvatarUrl(post.author.id, post.author.avatarUrl)} alt="" className="h-4 w-4 rounded-full object-cover" />
        <span className="truncate text-[12px] font-semibold text-navy-700">{post.author.nickname}</span>
      </div>
      {post.caption && <p className="mt-0.5 line-clamp-1 text-[11.5px] text-navy-400">{post.caption}</p>}
    </Link>
  );
}

function rankStyle(rank: number): { bg: string; text: string } {
  if (rank === 1) return { bg: "#FFD700", text: "#1a1200" };
  if (rank === 2) return { bg: "#C0C0C0", text: "#2a2a2a" };
  if (rank === 3) return { bg: "#CD7F32", text: "#fff" };
  return { bg: "rgba(0,0,0,0.55)", text: "rgba(255,255,255,0.85)" };
}

function CurationCard({ post, rank }: { post: CurationCardPost; rank?: number }) {
  const rs = rank != null ? rankStyle(rank) : null;
  return (
    <Link href={post.href} className="block w-[250px] shrink-0 overflow-hidden rounded-2xl border border-navy-100 bg-[#1e1e1e] shadow-card transition-colors hover:border-orange-500/40">
      <div className="relative h-32 w-full bg-navy-50">
        {post.thumbnail
          ? <img src={post.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#242424] to-[#161616] text-navy-300"><IconFish size={26} /></div>}
        {rank != null && rs && (
          <span
            className="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-extrabold shadow"
            style={{ background: rs.bg, color: rs.text }}
          >
            {rank}
          </span>
        )}
        {post.boardLabel
          ? <span className="absolute right-2.5 top-2.5 inline-flex items-center rounded-md bg-aqua-500/90 px-2 py-0.5 text-[11px] font-bold text-white shadow">{post.boardLabel}</span>
          : post.speciesName && <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-0.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white shadow"><IconFish size={10} />{post.speciesName}</span>}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-[14px] font-bold leading-snug text-navy-900">{post.title}</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-navy-400">
          <span className="font-semibold text-navy-500">{post.author.nickname}</span>
          <span className="inline-flex items-center gap-0.5"><IconEye size={11} />{post.viewCount}</span>
          <span className="inline-flex items-center gap-0.5"><IconHeart size={11} />{post.likeCount}</span>
          <span className="inline-flex items-center gap-0.5"><IconComment size={11} />{post.commentCount}</span>
        </div>
      </div>
    </Link>
  );
}

function EditorialCard({ post }: { post: CurationCardPost }) {
  return (
    <Link href={post.href} className="relative block h-44 w-[290px] shrink-0 overflow-hidden rounded-2xl shadow-card">
      {post.thumbnail
        ? <img src={post.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        : <div className="absolute inset-0 bg-gradient-to-br from-orange-600 to-orange-900" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
          <IconStar size={9} /> 회원 추천
        </span>
        <p className="line-clamp-2 text-[16px] font-extrabold leading-tight text-white drop-shadow">{post.title}</p>
        <p className="mt-1 flex items-center gap-2 text-[11px] font-medium text-white/80">
          <span>{post.author.nickname}</span>
          <span className="inline-flex items-center gap-0.5"><IconHeart size={10} />{post.likeCount}</span>
          <span className="inline-flex items-center gap-0.5"><IconTrend size={10} />{post.score}</span>
        </p>
      </div>
    </Link>
  );
}

function EmptyRail({ text }: { text: string }) {
  return (
    <div className="mx-4 flex items-center justify-center rounded-2xl border border-dashed border-navy-100 bg-white/[0.02] px-4 py-6">
      <p className="text-[13px] text-navy-400">{text}</p>
    </div>
  );
}

/** 워킹 피드 레일 카드 — 실제 지도 썸네일 */
function WalkingRailCard({ post }: { post: FeedPost }) {
  let routePoints: { lat: number; lng: number }[] = [];
  let catchMarkers: { lat: number; lng: number }[] = [];
  let distanceM: number | null = null;
  try {
    const parsed = JSON.parse(post.body ?? "null");
    if (Array.isArray(parsed?.routePoints)) routePoints = parsed.routePoints;
    if (Array.isArray(parsed?.catchMarkers)) catchMarkers = parsed.catchMarkers;
    if (parsed?.distanceM != null) distanceM = parsed.distanceM;
  } catch {}

  const distLabel = distanceM != null
    ? (distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${Math.round(distanceM)}m`)
    : null;

  return (
    <Link href={`/post/${post.id}`} className="block w-[150px] shrink-0">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#1b2b3a]">
        {post.walkingLocked ? (
          // 잠금 썸네일 — 어두운 배경 + 자물쇠 (탭 시 상세에서 200P로 열람)
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#0c1c2b] via-[#0e1720] to-[#05090f]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
              <Lock size={20} className="text-amber-300" strokeWidth={1.8} />
            </div>
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-[#161616]">200P로 열기</span>
          </div>
        ) : routePoints.length >= 1 ? (
          <MiniRouteMap points={routePoints} catchPoints={catchMarkers.length > 0 ? catchMarkers : undefined} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Route size={32} className="text-aqua-300/50" />
          </div>
        )}
        {distLabel && !post.walkingLocked && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-0.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            <Route size={9} />{distLabel}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <img src={getAvatarUrl(post.author.id, post.author.avatarUrl)} alt="" className="h-4 w-4 rounded-full object-cover" />
        <span className="truncate text-[12px] font-semibold text-navy-700">{post.author.nickname}</span>
      </div>
      {post.caption && <p className="mt-0.5 line-clamp-1 text-[11.5px] text-navy-400">{post.caption}</p>}
    </Link>
  );
}
