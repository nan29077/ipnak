"use client";
import { memo, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Award, Trophy } from "lucide-react";
import { cn, kstFormat } from "@/lib/utils";
import { Chip, EmptyState } from "@/components/ui";
import { TOURNAMENT_TYPES, isBassOnlySpecies } from "@/lib/taxonomy";
import { useAppSettings } from "@/lib/appSettingsContext";
import { tournamentBannerSrc } from "@/lib/tournamentBanner";

type T = {
  id: string; title: string; type: string; speciesName: string | null; status: string;
  startAt: string; endAt: string; bannerUrl: string | null; entryCount: number;
  // 관리자가 업로드한 배너 (base64 data URI 또는 URL). 없으면 어종별 기본 배너로 폴백
  bannerImage: string | null;
  // 참가비 / 순위 보상 포인트 — null 이면 무료 / 보상 없음
  entryFee: number | null; reward1st: number | null; reward2nd: number | null; reward3rd: number | null;
};

type BadgeTone = "navy" | "aqua" | "amber" | "red" | "green" | "gray";
const STATUS: Record<string, { label: string; tone: BadgeTone; text: string }> = {
  UPCOMING: { label: "예정", tone: "amber", text: "text-yellow-400" },
  ONGOING: { label: "진행중", tone: "aqua", text: "text-green-400" },
  ENDED: { label: "종료", tone: "gray", text: "text-gray-400" },
};
const FILTERS = [
  { key: "ALL", label: "전체" }, { key: "ONGOING", label: "진행중" },
  { key: "UPCOMING", label: "예정" }, { key: "WEEKLY", label: "주간전" },
  { key: "MONTHLY", label: "월간전" }, { key: "GRAND", label: "왕중왕전" },
];

const UNKNOWN_STATUS: { label: string; tone: BadgeTone; text: string } = { label: "미정", tone: "gray", text: "text-gray-400" };

const TournamentCard = memo(function TournamentCard({ t, priority }: { t: T; priority?: boolean }) {
  // DB 에 예상 밖 status 가 들어와도 st.label 접근에서 터지지 않도록 폴백
  const st = STATUS[t.status] ?? UNKNOWN_STATUS;
  const typeLabel = TOURNAMENT_TYPES.find((x) => x.key === t.type)?.label;
  const rewards = [t.reward1st, t.reward2nd, t.reward3rd];
  const hasReward = rewards.some((r) => r && r > 0);
  const paid = !!t.entryFee && t.entryFee > 0;
  // 관리자 업로드 배너 우선, 없으면 어종별 불곰 마스코트 배너
  const banner = t.bannerImage || tournamentBannerSrc(t.speciesName, t.bannerUrl);
  // base64 data URI 는 next/image 최적화 대상이 아니라 <img> 로 그린다
  const isDataUri = banner.startsWith("data:");
  return (
    <article key={t.id} className="overflow-hidden rounded-2xl bg-[#1a2332] shadow-card transition-shadow hover:shadow-cardhover">
      {/* 배너 — 이미지가 없으면 낚시 테마 다크 그라데이션이 그대로 보인다 */}
      <div className="relative aspect-[16/7] overflow-hidden bg-gradient-to-br from-[#0d2137] via-[#122c45] to-[#071522]">
        {isDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner}
            alt={`${t.title} 대회 배너`}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Image
            src={banner}
            alt={`${t.speciesName ?? "낚시"} 낚시를 하는 입낚 불곰`}
            fill
            // 카드 폭: 모바일 = 화면 폭, PC = 최대 640px 컨테이너
            sizes="(max-width: 768px) 100vw, 640px"
            // 첫 카드만 미리 로드 — 나머지는 스크롤 시 lazy
            priority={priority}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* 하단 그라데이션 — 제목/기간 가독성 확보 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" aria-hidden />

        <Trophy size={20} strokeWidth={1.8} className="absolute right-4 top-4 text-white drop-shadow-md" />

        <div className="absolute inset-x-0 top-0 p-4">
          <span className="mr-1 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {typeLabel ?? st.label}
          </span>
          {/* 참가비 배지 — 없으면 "무료" */}
          <span className={cn(
            "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm",
            paid ? "bg-yellow-500/90 text-black" : "bg-white/15 text-white",
          )}>
            {paid ? `${t.entryFee!.toLocaleString()}포인트` : "무료"}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="line-clamp-2 text-xl font-bold leading-snug text-white drop-shadow-md">{t.title}</p>
          <p className="mt-1 text-sm text-white opacity-80 drop-shadow">
            {kstFormat(new Date(t.startAt), "M월 d일")} ~ {kstFormat(new Date(t.endAt), "M월 d일")}
          </p>
        </div>
      </div>

      {/* 통계 행 */}
      <div className="grid grid-cols-3 gap-2 border-t border-white/5 px-4 py-3">
        <div>
          {/* entryCount 는 제출 건수(참가자 수가 아님) — 한 사람이 여러 건 제출할 수 있다 */}
          <p className="text-[11px] text-gray-400">제출기록</p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-white">{t.entryCount}건</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">기준어종</p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-white">{t.speciesName ?? "전어종"}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">상태</p>
          <p className={cn("mt-0.5 truncate text-[14px] font-bold", st.text)}>{st.label}</p>
        </div>
      </div>

      {/* 순위 보상 — 설정된 순위만 표시 */}
      {hasReward && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-white/5 px-2.5 py-2">
          <Award size={13} strokeWidth={1.8} className="text-yellow-500" />
          {rewards.map((r, i) =>
            r && r > 0 ? (
              <span key={i} className="text-[11px] font-semibold text-gray-300">
                {i + 1}위 <span className="text-yellow-500">{r.toLocaleString()}P</span>
              </span>
            ) : null,
          )}
        </div>
      )}

      {/* 액션 버튼 — 1:1 분할, 동일 높이 */}
      <div className="flex gap-2 border-t border-white/5 px-4 py-3">
        <Link
          href={`/tournaments/${t.id}#entry`}
          className="flex flex-1 items-center justify-center rounded-xl bg-[#eab308] px-3 py-2.5 text-[13px] font-bold text-black transition-colors hover:bg-[#ca9a04] active:scale-[0.97]"
        >
          대회 참가
        </Link>
        <Link
          href={`/tournaments/${t.id}#ranking`}
          className="flex flex-1 items-center justify-center rounded-xl bg-[#2a3546] px-3 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#354254] active:scale-[0.97]"
        >
          랭킹 순위
        </Link>
      </div>
    </article>
  );
});

export function TournamentList({ tournaments }: { tournaments: T[] }) {
  const { bassOnlyMode } = useAppSettings();
  const [filter, setFilter] = useState("ALL");
  // 칩 클릭마다 전체 목록을 다시 훑지 않도록 메모이즈 (memo 된 카드의 리렌더도 함께 줄인다)
  const visible = useMemo(
    () =>
      tournaments.filter((t) => {
        // 배스 전용 모드: 배스 계열 어종(BASS_ONLY_SPECIES 8종) 대회만 표시
        if (bassOnlyMode && !isBassOnlySpecies(t.speciesName)) return false;
        return filter === "ALL" ? true :
          ["WEEKLY", "MONTHLY", "GRAND"].includes(filter) ? t.type === filter : t.status === filter;
      }),
    [tournaments, bassOnlyMode, filter],
  );

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</Chip>
        ))}
      </div>
      <div className="space-y-3 px-4 pb-10">
        {visible.length === 0 && (
          <EmptyState title="표시할 대회가 없습니다" desc="필터를 변경하거나 새 대회가 열릴 때까지 기다려 주세요." />
        )}
        {visible.map((t, i) => (
          <TournamentCard key={t.id} t={t} priority={i === 0} />
        ))}
      </div>
    </div>
  );
}
