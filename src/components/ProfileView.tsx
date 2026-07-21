"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Grid3x3, MapPin, Trophy, Ruler, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, SectionTitle, EmptyState } from "@/components/ui";

const MiniRouteMap = dynamic(
  () => import("@/components/MiniRouteMap").then((m) => m.MiniRouteMap),
  { ssr: false }
);

type GridPost = { id: string; image: string | null; postType: string; sizeCm: number | null; speciesName: string | null; body?: string | null };

export function ProfileView({
  posts, points, entries,
}: {
  posts: GridPost[];
  points: GridPost[];
  entries: { id: string; tournamentId: string; title: string; speciesName: string; sizeCm: number; status: string }[];
}) {
  const [tab, setTab] = useState<"posts" | "points" | "entries" | "walking">("posts");

  // 워킹 피드 게시글과 일반 게시글 분리
  const feedPosts = posts.filter((p) => p.postType !== "WALKING_FEED");
  const walkingPosts = posts.filter((p) => p.postType === "WALKING_FEED");

  return (
    <div>
      <div className="px-3.5 pb-2 pt-3">
        <SectionTitle>최근 기록</SectionTitle>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-navy-100 px-4 py-3">
        <TabChip active={tab === "posts"} onClick={() => setTab("posts")} icon={<Grid3x3 size={15} />} label="게시글" />
        {walkingPosts.length > 0 && (
          <TabChip active={tab === "walking"} onClick={() => setTab("walking")} icon={<Route size={15} />} label="워킹피드" />
        )}
        <TabChip active={tab === "points"} onClick={() => setTab("points")} icon={<MapPin size={15} />} label="피싱포인트" />
        <TabChip active={tab === "entries"} onClick={() => setTab("entries")} icon={<Trophy size={15} />} label="대회기록" />
      </div>

      {tab === "entries" ? (
        <div className="divide-y divide-navy-50">
          {entries.length === 0 && <EmptyState title="대회 참가 기록이 없습니다" />}
          {entries.map((e) => (
            <Link key={e.id} href={`/tournaments/${e.tournamentId}`} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Trophy size={18} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-800">{e.title}</p>
                <p className="text-xs text-navy-400">{e.speciesName} · {e.sizeCm}cm</p>
              </div>
              <Badge tone={e.status === "APPROVED" ? "aqua" : e.status === "REJECTED" ? "red" : "gray"}>
                {e.status === "APPROVED" ? "승인" : e.status === "REJECTED" ? "반려" : "심사중"}
              </Badge>
            </Link>
          ))}
        </div>
      ) : tab === "walking" ? (
        <WalkingGrid items={walkingPosts} />
      ) : (
        <PostGrid items={tab === "posts" ? feedPosts : points} />
      )}
    </div>
  );
}

function PostGrid({ items }: { items: GridPost[] }) {
  if (items.length === 0) return <EmptyState title="게시글이 없습니다" />;
  return (
    <div className="mx-3.5 grid grid-cols-3 gap-0.5">
      {items.map((p) => (
        <Link key={p.id} href={`/post/${p.id}`} className="relative aspect-square overflow-hidden rounded-md bg-navy-50">
          {p.image && <img src={p.image} alt={p.speciesName || "게시글"} className="h-full w-full object-cover" />}
          {p.sizeCm != null && (
            <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
              <Ruler size={10} /> {p.sizeCm}cm
            </span>
          )}
          {p.postType === "FISHING_POINT" && <span className="absolute right-1 top-1 rounded-full bg-aqua-500/90 p-1 text-white"><MapPin size={11} /></span>}
        </Link>
      ))}
    </div>
  );
}

/** 워킹 피드 그리드 — 실제 지도 동선 + 물고기 마커 표시 */
function WalkingGrid({ items }: { items: GridPost[] }) {
  // routePoints가 2개 이상인 게시물만 표시 (빈 카드 제거)
  const validItems = items.filter((p) => {
    try {
      const d = JSON.parse(p.body ?? "null");
      return Array.isArray(d?.routePoints) && d.routePoints.length >= 2;
    } catch { return false; }
  });

  if (validItems.length === 0) return <EmptyState title="워킹 피드가 없습니다" />;
  return (
    <div className="mx-3.5 grid grid-cols-3 gap-0.5">
      {validItems.map((p) => {
        let routePoints: { lat: number; lng: number }[] = [];
        let catchMarkers: { lat: number; lng: number }[] = [];
        try {
          const d = JSON.parse(p.body ?? "null");
          if (Array.isArray(d?.routePoints)) routePoints = d.routePoints;
          if (Array.isArray(d?.catchMarkers)) catchMarkers = d.catchMarkers;
        } catch {}
        return (
          <Link key={p.id} href={`/post/${p.id}`} className="relative aspect-square overflow-hidden rounded-md bg-[#1b2b3a]">
            <MiniRouteMap
              points={routePoints}
              catchPoints={catchMarkers.length > 0 ? catchMarkers : undefined}
            />
          </Link>
        );
      })}
    </div>
  );
}

function TabChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold btn-press transition-all",
        active ? "bg-orange-500 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100")}>
      {icon} {label}
    </button>
  );
}
