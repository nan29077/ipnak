"use client";
import Link from "next/link";
import { ChevronRight, Flame, BadgeCheck } from "lucide-react";
import {
  IconEye, IconHeart, IconComment, IconFish, IconRuler, IconBook, IconStar, IconTrend, IconTrophy, IconMapPin, IconUsers,
} from "@/components/FishingIcon";
import { CommunityTabs } from "@/components/CommunityTabs";
import { AiPointRecommend } from "@/components/AiPointRecommend";
import { FeedWriteFab } from "@/components/FeedWriteFab";
import type { FeedPost } from "@/lib/queries";
import type { CurationCardPost, ResolvedSection } from "@/lib/curation";

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

export function CurationHome({
  feedPosts, sections, banners, currentUserId,
}: {
  feedPosts: FeedPost[];
  sections: ResolvedSection[];
  banners?: { title: string; imageUrl: string | null }[];
  currentUserId?: string;
}) {
  const visibleSections = sections.filter((s) => s.posts.length > 0);

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
        {feedPosts.length === 0 ? (
          <EmptyRail text="아직 올라온 피싱 피드가 없어요" />
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
            {feedPosts.slice(0, 12).map((p) => <FeedRailCard key={p.id} post={p} />)}
          </div>
        )}
      </section>

      {/* 관리자가 정의한 동적 섹션 (순서대로) */}
      {visibleSections.map((s) => <CurationRail key={s.key} section={s} />)}

      {/* 배너 */}
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

      <FeedWriteFab currentUserId={currentUserId} />
    </div>
  );
}

function CurationRail({ section }: { section: ResolvedSection }) {
  if (section.style === "pro") return <ProRail section={section} />;
  return (
    <section className="mt-6">
      <SectionHead title={section.title} desc={descFor(section)} moreHref={section.more} icon={iconFor(section)} />
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
        {section.posts.map((p, i) => section.style === "editorial"
          ? <EditorialCard key={p.id} post={p} />
          : <CurationCard key={p.id} post={p} rank={section.style === "rank" ? i + 1 : undefined} />)}
      </div>
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
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
        {section.posts.map((p) => <CurationCard key={p.id} post={p} />)}
      </div>
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
          모아보기 <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function FeedRailCard({ post }: { post: FeedPost }) {
  return (
    <Link href={`/post/${post.id}`} className="block w-[150px] shrink-0">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-navy-50">
        <img src={post.images[0]?.url} alt={post.images[0]?.alt || "조황"} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
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
        <img src={post.author.avatarUrl || "https://i.pravatar.cc/40"} alt="" className="h-4 w-4 rounded-full object-cover" />
        <span className="truncate text-[12px] font-semibold text-navy-700">{post.author.nickname}</span>
      </div>
      {post.caption && <p className="mt-0.5 line-clamp-1 text-[11.5px] text-navy-400">{post.caption}</p>}
    </Link>
  );
}

function CurationCard({ post, rank }: { post: CurationCardPost; rank?: number }) {
  return (
    <Link href={post.href} className="block w-[250px] shrink-0 overflow-hidden rounded-2xl border border-navy-100 bg-[#1e1e1e] shadow-card transition-colors hover:border-orange-500/40">
      <div className="relative h-32 w-full bg-navy-50">
        {post.thumbnail
          ? <img src={post.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#242424] to-[#161616] text-navy-300"><IconFish size={26} /></div>}
        {rank != null && <span className="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[12px] font-extrabold text-white shadow">{rank}</span>}
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
