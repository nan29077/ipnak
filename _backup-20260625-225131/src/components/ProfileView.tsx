"use client";
import { useState } from "react";
import Link from "next/link";
import { Grid3x3, MapPin, Trophy, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, SectionTitle, EmptyState } from "@/components/ui";

type GridPost = { id: string; image: string | null; postType: string; sizeCm: number | null; speciesName: string | null };

export function ProfileView({
  posts, points, entries,
}: {
  posts: GridPost[];
  points: GridPost[];
  entries: { id: string; tournamentId: string; title: string; speciesName: string; sizeCm: number; status: string }[];
}) {
  const [tab, setTab] = useState<"posts" | "points" | "entries">("posts");

  return (
    <div>
      <div className="px-3.5 pb-2 pt-3">
        <SectionTitle>최근 기록</SectionTitle>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-navy-100 px-4 py-3">
        <TabChip active={tab === "posts"} onClick={() => setTab("posts")} icon={<Grid3x3 size={15} />} label="게시글" />
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
      ) : (
        <PostGrid items={tab === "posts" ? posts : points} />
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

function TabChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold btn-press transition-all",
        active ? "bg-navy-700 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100")}>
      {icon} {label}
    </button>
  );
}
