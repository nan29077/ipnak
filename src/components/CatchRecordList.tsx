"use client";
import { useMemo, useState } from "react";
import { Fish, MapPin, Ruler, PenLine, Trophy, Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, Badge, Chip } from "@/components/ui";
import { kstFormat } from "@/lib/utils";
import { estimateWeightKg, formatWeight, speciesAvgCm, vsAveragePct } from "@/lib/fishData";
import { useAppSettings } from "@/lib/appSettingsContext";

export type CatchRecordItem = {
  id: string;
  speciesName: string;
  sizeCm: number | null;
  photoUrl: string | null;
  measuredLengthCm: number | null;
  confidence: number | null;
  region: string | null;
  createdAt: string;
};

// 기록에 표시할 최종 길이 (직접입력 우선, 없으면 스마트 자 측정값)
const effLen = (r: CatchRecordItem) => r.sizeCm ?? r.measuredLengthCm ?? null;

// 배스낚시 전용 모드에서 표시할 어종명 목록
const BASS_SPECIES = ["배스", "Largemouth Bass", "Smallmouth Bass", "배스(라지마우스)", "배스(스몰마우스)"];

export function CatchRecordList({ records }: { records: CatchRecordItem[] }) {
  const { bassOnlyMode } = useAppSettings();
  const [filter, setFilter] = useState<string>("전체");

  // 배스 전용 모드 시 배스 관련 기록만 표시
  const displayRecords = useMemo(
    () =>
      bassOnlyMode
        ? records.filter((r) => BASS_SPECIES.some((b) => r.speciesName.includes("배스") || r.speciesName === b))
        : records,
    [records, bassOnlyMode]
  );

  // 어종별 개인 최고 기록(PB) — 같은 어종 중 가장 긴 기록의 id
  const pbIds = useMemo(() => {
    const best = new Map<string, { id: string; len: number }>();
    for (const r of displayRecords) {
      const len = effLen(r);
      if (len == null) continue;
      const cur = best.get(r.speciesName);
      if (!cur || len > cur.len) best.set(r.speciesName, { id: r.id, len });
    }
    return new Set(Array.from(best.values()).map((v) => v.id));
  }, [displayRecords]);

  const speciesList = useMemo(
    () => Array.from(new Set(displayRecords.map((r) => r.speciesName))).filter(Boolean),
    [displayRecords]
  );

  const shown = filter === "전체" ? displayRecords : displayRecords.filter((r) => r.speciesName === filter);

  // 요약: 전체 최고 기록
  const overallBest = useMemo(() => {
    let best: CatchRecordItem | null = null;
    for (const r of displayRecords) {
      const len = effLen(r);
      if (len == null) continue;
      if (!best || len > (effLen(best) ?? 0)) best = r;
    }
    return best;
  }, [displayRecords]);

  return (
    <div className="space-y-3 p-4">
      {/* 배스 전용 모드 알림 */}
      {bassOnlyMode && (
        <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2.5 text-[13px] font-semibold text-orange-600">
          <Fish size={15} />
          배스낚시 전용 모드 — 배스 기록만 표시 중
        </div>
      )}
      {/* 요약 카드 */}
      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-[11px] text-navy-300">나의 최고 기록</p>
          {overallBest ? (
            <p className="mt-0.5">
              <span className="text-[26px] font-extrabold text-aqua-500">{(effLen(overallBest) ?? 0).toFixed(1)}</span>
              <span className="ml-1 text-[14px] font-semibold text-navy-300">cm</span>
              <span className="ml-2 text-[13px] font-semibold text-navy-500">{overallBest.speciesName}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-navy-300">-</p>
          )}
        </div>
        <div className="text-right text-[12px] text-navy-300">
          <p>총 {records.length}건</p>
          <p className="mt-0.5">어종 {speciesList.length}종 · PB {pbIds.size}개</p>
        </div>
      </Card>

      {/* 어종 필터 */}
      {speciesList.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip active={filter === "전체"} onClick={() => setFilter("전체")}>전체</Chip>
          {speciesList.map((s) => (
            <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>{s}</Chip>
          ))}
        </div>
      )}

      {/* 기록 카드 목록 */}
      <div className="space-y-2.5">
        {shown.map((r) => {
          const len = effLen(r);
          const weight = estimateWeightKg(r.speciesName, len);
          const avg = speciesAvgCm(r.speciesName);
          const pct = vsAveragePct(r.speciesName, len);
          const isSmart = r.measuredLengthCm != null;
          const isPB = pbIds.has(r.id);
          return (
            <Card key={r.id} className="p-3">
              <div className="flex gap-3">
                {r.photoUrl ? (
                  <img src={r.photoUrl} alt={r.speciesName} className="h-[76px] w-[76px] shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-xl bg-aqua-500/15 text-aqua-300">
                    <Fish size={26} strokeWidth={1.5} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold text-navy-800">
                      {r.speciesName}
                      {isPB && (
                        <Badge tone="amber" className="shrink-0 gap-1"><Trophy size={11} />PB</Badge>
                      )}
                    </p>
                    <span className="shrink-0 text-[11px] text-navy-300">{kstFormat(new Date(r.createdAt), "yy.M.d")}</span>
                  </div>
                  <p className="mt-0.5">
                    <span className="text-[22px] font-extrabold text-aqua-500">{len != null ? len.toFixed(1) : "--"}</span>
                    <span className="ml-0.5 text-[13px] font-semibold text-navy-300">cm</span>
                    {weight != null && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold text-navy-400">
                        <Scale size={12} />추정 {formatWeight(weight)}
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {isSmart ? (
                      <Badge tone="aqua" className="gap-1">
                        <Ruler size={11} />스마트 자{r.confidence != null ? ` · ${r.confidence}%` : ""}
                      </Badge>
                    ) : (
                      <Badge tone="gray" className="gap-1"><PenLine size={11} />직접 입력</Badge>
                    )}
                    {r.region && <Badge tone="gray" className="gap-1"><MapPin size={11} />{r.region}</Badge>}
                  </div>
                </div>
              </div>

              {/* 어종 평균 대비 */}
              {len != null && avg != null && pct != null && (
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-navy-300">{r.speciesName} 평균 {avg}cm 대비</span>
                    <span className={`inline-flex items-center gap-0.5 font-bold ${pct > 100 ? "text-emerald-400" : pct < 100 ? "text-navy-400" : "text-navy-400"}`}>
                      {pct > 100 ? <TrendingUp size={12} /> : pct < 100 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {pct > 100 ? `+${pct - 100}%` : pct < 100 ? `-${100 - pct}%` : "평균"}
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-navy-50">
                    {/* 평균 위치 마커 = 66.7% 지점 (표시 상한 150%) */}
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-400/80" : "bg-aqua-500/70"}`}
                      style={{ width: `${Math.min(100, (pct / 150) * 100)}%` }}
                    />
                    <div className="absolute top-0 h-full w-px bg-navy-300/70" style={{ left: "66.7%" }} />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
