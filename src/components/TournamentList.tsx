"use client";
import { memo, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { kstFormat } from "@/lib/utils";
import { Card, Chip, Button } from "@/components/ui";
import { TOURNAMENT_TYPES } from "@/lib/taxonomy";
import { useAppSettings } from "@/lib/appSettingsContext";

type T = {
  id: string; title: string; type: string; speciesName: string | null; status: string;
  startAt: string; endAt: string; bannerUrl: string | null; entryCount: number;
};

type BadgeTone = "navy" | "aqua" | "amber" | "red" | "green" | "gray";
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  UPCOMING: { label: "예정", tone: "amber" },
  ONGOING: { label: "진행중", tone: "aqua" },
  ENDED: { label: "종료", tone: "gray" },
};
const FILTERS = [
  { key: "ALL", label: "전체" }, { key: "ONGOING", label: "진행중" },
  { key: "UPCOMING", label: "예정" }, { key: "WEEKLY", label: "주간전" },
  { key: "MONTHLY", label: "월간전" }, { key: "GRAND", label: "왕중왕전" },
];

const TournamentCard = memo(function TournamentCard({ t }: { t: T }) {
  const st = STATUS[t.status];
  const typeLabel = TOURNAMENT_TYPES.find((x) => x.key === t.type)?.label;
  return (
    <Card key={t.id} as="article" className="overflow-hidden p-0 transition-shadow hover:shadow-cardhover">
      {/* 그라데이션 헤더 */}
      <div className="flex items-start justify-between bg-gradient-to-br from-orange-500 to-aqua-500 p-4">
        <div className="min-w-0">
          <span className="mb-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
            {typeLabel ?? st.label}
          </span>
          <p className="truncate text-[16px] font-bold text-white">{t.title}</p>
          <p className="mt-1 text-[12px] text-white/60">
            {kstFormat(new Date(t.startAt), "M월 d일")} ~ {kstFormat(new Date(t.endAt), "M월 d일")}
          </p>
        </div>
        <Trophy size={20} className="shrink-0 text-white" />
      </div>

      {/* 본문 */}
      <div className="p-3.5">
        <div className="mb-3 flex gap-4">
          <div>
            <p className="text-[11px] text-navy-300">참가인원</p>
            <p className="text-[14px] font-bold text-navy-900">{t.entryCount}명</p>
          </div>
          <div>
            <p className="text-[11px] text-navy-300">기준어종</p>
            <p className="text-[14px] font-bold text-navy-900">{t.speciesName ?? "전어종"}</p>
          </div>
          <div>
            <p className="text-[11px] text-navy-300">상태</p>
            <p className="text-[14px] font-bold text-aqua-500">{st.label}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/tournaments/${t.id}`} className="flex-1">
            <Button variant="primary" size="sm" full>계측 제출</Button>
          </Link>
          <Link href={`/tournaments/${t.id}`} className="flex-1">
            <Button variant="outline" size="sm" full>랭킹 순위</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
});

export function TournamentList({ tournaments }: { tournaments: T[] }) {
  const { bassOnlyMode } = useAppSettings();
  const [filter, setFilter] = useState("ALL");
  const visible = tournaments.filter((t) => {
    // 배스 전용 모드: 배스낚시 대회만 표시
    if (bassOnlyMode && !(t.speciesName ?? "").includes("배스")) return false;
    return filter === "ALL" ? true :
      ["WEEKLY", "MONTHLY", "GRAND"].includes(filter) ? t.type === filter : t.status === filter;
  });

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</Chip>
        ))}
      </div>
      <div className="space-y-3 px-4 pb-10">
        {visible.map((t) => (
          <TournamentCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
