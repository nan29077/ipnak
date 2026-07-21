"use client";
/**
 * 측정일지 바텀시트
 * AI측정 페이지에서 "측정일지" 버튼 클릭 시 하단에서 올라오는 시트
 * DiaryPage 와 동일한 로직 — PageHeader 없이 Sheet 안에 임베드
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera, Trophy, Ruler, Hash, MapPin, Thermometer, Waves,
  Trash2, CloudSun, Moon, ChevronRight, Loader2,
} from "lucide-react";
import { Button, Chip, EmptyState, LoadingState, Sheet, Badge } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FISH_SPECIES } from "@/constants/errorMessages";
import { dbService } from "@/services/DatabaseService";
import syncService from "@/services/SyncService";
import { kstFormat } from "@/lib/utils";

const PAGE_SIZE = 20;

type Item = {
  id: number;
  measuredAt: string;
  lengthCm: number;
  weightG: number | null;
  speciesKr: string;
  confidenceGrade: string | null;
  imageBase64: string | null;
  locationName: string | null;
  weather: string | null;
  temperature: number | null;
  tidePhase: string | null;
  synced: number;
};

type TournamentInfo = {
  id: string; title: string; type: string; speciesName: string | null;
  startDate: string | null; endDate: string | null; entryCount: number;
};

const GRADE_STYLE: Record<string, { label: string; cls: string }> = {
  HIGH: { label: "정밀", cls: "bg-green-500/15 text-green-400" },
  MEDIUM: { label: "일반", cls: "bg-amber-500/15 text-amber-400" },
  LOW: { label: "재측정", cls: "bg-red-500/15 text-red-400" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface DiarySheetProps {
  open: boolean;
  onClose: () => void;
  /** true 이면 측정일지를 날짜별로 묶어서 표시 (마이페이지 전체보기 용) */
  groupByDate?: boolean;
}

/** items 를 measuredAt 기준 날짜로 그룹핑 (최신순 정렬 기준) */
function groupItemsByDate(items: Item[]): { dateLabel: string; items: Item[] }[] {
  const groups: { dateLabel: string; items: Item[] }[] = [];
  for (const item of items) {
    const d = new Date(item.measuredAt);
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    const last = groups[groups.length - 1];
    if (last && last.dateLabel === label) {
      last.items.push(item);
    } else {
      groups.push({ dateLabel: label, items: [item] });
    }
  }
  return groups;
}

export function DiarySheet({ open, onClose, groupByDate = false }: DiarySheetProps) {
  const toast = useToast();
  const [stats, setStats] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [species, setSpecies] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 대회 참가 관련 상태
  const [tournamentTarget, setTournamentTarget] = useState<Item | null>(null);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [tourLoading, setTourLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStats = useCallback(async () => {
    setStats(await dbService.getStats());
    const st = await syncService.getSyncStatus();
    setPendingSync(st.pendingCount);
  }, []);

  const loadPage = useCallback(async (p: number, sp: string, replace: boolean) => {
    const r = await dbService.getMeasurements({ page: p, limit: PAGE_SIZE, species: sp });
    setTotal(r.total);
    setItems((prev) => (replace ? r.items : [...prev, ...r.items]));
    setLoading(false);
  }, []);

  // 시트 열릴 때마다 데이터 초기화 + 로드
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPage(1);
    setSpecies("");
    setDetail(null);
    setDeleteTarget(null);
    setTournamentTarget(null);
    loadPage(1, "", true);
    loadStats();
  }, [open, loadPage, loadStats]);

  // 어종 필터 변경
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPage(1);
    loadPage(1, species, true);
  }, [species, open, loadPage]);

  // 무한 스크롤 (Sheet 내부 스크롤 컨테이너 기준)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && items.length < total) {
          const next = page + 1;
          setPage(next);
          loadPage(next, species, false);
        }
      },
      { rootMargin: "200px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [items.length, total, page, species, loadPage]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await dbService.deleteMeasurement(deleteTarget.id);
    setDeleteTarget(null);
    setDetail(null);
    setLoading(true);
    setPage(1);
    await loadPage(1, species, true);
    await loadStats();
    toast("기록을 삭제했어요", "info");
  }

  // 대회 참가 버튼 클릭 → 진행중 대회 목록 로드
  async function handleTournamentClick(item: Item) {
    setTournamentTarget(item);
    setTourLoading(true);
    try {
      const res = await fetch("/api/tournaments");
      const data = await res.json();
      setTournaments(data);
    } catch {
      setTournaments([]);
    } finally {
      setTourLoading(false);
    }
  }

  // 대회 선택 후 제출
  async function submitToTournament(t: TournamentInfo) {
    if (!tournamentTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${t.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speciesName: tournamentTarget.speciesKr,
          sizeCm: tournamentTarget.lengthCm,
          photoUrl: tournamentTarget.imageBase64 ?? null,
          measuredImageUrl: tournamentTarget.imageBase64 ?? null,
          region: tournamentTarget.locationName ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(`"${t.title}" 대회에 제출했습니다 (심사중)`, "success");
      setTournamentTarget(null);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 통계 카드 (Sheet stickyContent 로 전달) ──
  const statsContent = stats ? (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={<Trophy size={17} strokeWidth={1.8} />}
          label="최대어"
          value={stats.maxFish ? `${stats.maxFish.lengthCm}cm` : "-"}
          sub={stats.maxFish ? stats.maxFish.speciesKr : "기록 없음"}
        />
        <StatCard
          icon={<Ruler size={17} strokeWidth={1.8} />}
          label="평균 길이"
          value={stats.totalCount ? `${stats.avgLength}cm` : "-"}
          sub={`${stats.totalCount}회 측정`}
        />
        <StatCard
          icon={<Hash size={17} strokeWidth={1.8} />}
          label="총 마릿수"
          value={`${stats.totalCount}`}
          sub={`${Object.keys(stats.speciesBreakdown || {}).length}개 어종`}
        />
      </div>
      {pendingSync > 0 && (
        <p className="text-center text-[11px] text-navy-300">
          서버 미동기화 기록 {pendingSync}건 — 온라인 연결 시 자동 업로드됩니다
        </p>
      )}
      {/* 어종 필터 */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Chip size="sm" active={species === ""} onClick={() => setSpecies("")}>전체</Chip>
        {FISH_SPECIES.map((s: any) => (
          <Chip key={s.key} size="sm" active={species === s.key} onClick={() => setSpecies(s.key)}>
            {s.key}
          </Chip>
        ))}
      </div>
    </div>
  ) : null;

  function ItemCard({ m, onDetailClick, onTournamentClick }: { m: Item; onDetailClick: () => void; onTournamentClick: () => void }) {
    const grade = m.confidenceGrade ? GRADE_STYLE[m.confidenceGrade] : null;
    return (
      <li>
        <div className="rounded-card border border-navy-100 bg-surface-200 overflow-hidden">
          <button
            type="button"
            onClick={onDetailClick}
            className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-300 active:scale-[0.99]"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-100">
              {m.imageBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.imageBase64} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-navy-300">
                  <Ruler size={20} strokeWidth={1.6} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-navy-900">{m.speciesKr}</span>
                <span className="text-[16px] font-extrabold text-orange-500">{m.lengthCm}cm</span>
                {grade && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${grade.cls}`}>{grade.label}</span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-navy-400">
                {m.weightG ? `약 ${m.weightG}g · ` : ""}{fmtDate(m.measuredAt)}
              </p>
              {m.locationName && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-navy-300">
                  <MapPin size={11} strokeWidth={1.8} className="shrink-0" />
                  {m.locationName}
                </p>
              )}
            </div>
          </button>
          {/* 대회 참가 버튼 */}
          <div className="border-t border-navy-100 px-3 py-2">
            <button
              type="button"
              onClick={onTournamentClick}
              className="flex w-full items-center justify-between rounded-xl bg-orange-500/10 px-3 py-2 text-left transition-colors hover:bg-orange-500/20"
            >
              <div className="flex items-center gap-2">
                <Trophy size={13} className="text-orange-400" strokeWidth={1.8} />
                <span className="text-[12px] font-semibold text-orange-400">대회 참가</span>
              </div>
              <ChevronRight size={13} className="text-orange-300" />
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="측정일지" size="diary" stickyContent={statsContent}>
        <div className="space-y-2.5">
          {/* ── 기록 리스트 ── */}
          {loading ? (
            <LoadingState label="기록 불러오는 중..." />
          ) : items.length === 0 ? (
            <EmptyState
              title="아직 측정 기록이 없어요"
              desc="입낚볼과 함께 촬영하면 길이·무게가 자동 기록됩니다."
              action={
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-[16px] bg-orange-500 px-4 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-colors hover:bg-orange-600"
                >
                  <Camera size={16} strokeWidth={1.9} />
                  첫 측정 시작하기
                </button>
              }
            />
          ) : groupByDate ? (
            /* ── 일별 그룹 뷰 (마이페이지 전체보기) ── */
            <div className="space-y-5">
              {groupItemsByDate(items).map((group) => (
                <div key={group.dateLabel}>
                  <p className="mb-2 border-b border-navy-100 pb-1.5 text-[12px] font-bold text-navy-400">
                    {group.dateLabel} <span className="ml-1 font-normal text-navy-300">({group.items.length}마리)</span>
                  </p>
                  <ul className="space-y-2.5">
                    {group.items.map((m) => (
                      <ItemCard
                        key={m.id}
                        m={m}
                        onDetailClick={() => setDetail(m)}
                        onTournamentClick={() => handleTournamentClick(m)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            /* ── 기본 목록 뷰 (AI측정 페이지 바텀시트) ── */
            <ul className="space-y-2.5">
              {items.map((m) => (
                <ItemCard
                  key={m.id}
                  m={m}
                  onDetailClick={() => setDetail(m)}
                  onTournamentClick={() => handleTournamentClick(m)}
                />
              ))}
            </ul>
          )}

          {/* 무한 스크롤 센티널 */}
          <div ref={sentinelRef} />
          {!loading && items.length > 0 && items.length >= total && (
            <p className="pt-2 text-center text-[11px] text-navy-300">모든 기록을 확인했어요</p>
          )}
        </div>
      </Sheet>

      {/* ── 상세 시트 (중첩) ── */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.speciesKr} ${detail.lengthCm}cm` : ""}
      >
        {detail && (
          <div className="space-y-3">
            {detail.imageBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.imageBase64} alt="측정 사진" className="w-full rounded-2xl ring-1 ring-navy-100" />
            )}
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <InfoRow icon={<Ruler size={14} strokeWidth={1.8} />} label="전장" value={`${detail.lengthCm}cm`} />
              <InfoRow icon={<Hash size={14} strokeWidth={1.8} />} label="추정 무게" value={detail.weightG ? `약 ${detail.weightG}g` : "-"} />
              <InfoRow icon={<CloudSun size={14} strokeWidth={1.8} />} label="날씨" value={detail.weather || "-"} />
              <InfoRow icon={<Thermometer size={14} strokeWidth={1.8} />} label="기온" value={detail.temperature != null ? `${detail.temperature}°C` : "-"} />
              <InfoRow icon={<Waves size={14} strokeWidth={1.8} />} label="물때" value={detail.tidePhase || "-"} />
              <InfoRow icon={<Moon size={14} strokeWidth={1.8} />} label="측정 일시" value={fmtDate(detail.measuredAt)} />
            </div>
            {detail.locationName && (
              <p className="flex items-center gap-1.5 rounded-xl bg-navy-50 px-3 py-2 text-[12px] text-navy-500">
                <MapPin size={13} strokeWidth={1.8} className="shrink-0 text-aqua-400" />
                {detail.locationName}
              </p>
            )}
            <Button
              variant="danger"
              size="sm"
              full
              leftIcon={<Trash2 size={15} />}
              onClick={() => setDeleteTarget(detail)}
            >
              기록 삭제
            </Button>
          </div>
        )}
      </Sheet>

      {/* ── 대회 선택 시트 ── */}
      <Sheet
        open={!!tournamentTarget}
        onClose={() => setTournamentTarget(null)}
        title="참가할 대회 선택"
        size="md"
      >
        {tournamentTarget && (
          <div className="space-y-3">
            {/* 선택된 물고기 요약 */}
            <div className="flex items-center gap-3 rounded-xl bg-surface-200 border border-navy-100 p-3">
              {tournamentTarget.imageBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tournamentTarget.imageBase64} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy-50 text-navy-300">
                  <Ruler size={18} strokeWidth={1.6} />
                </div>
              )}
              <div>
                <p className="text-[14px] font-bold text-navy-900">{tournamentTarget.speciesKr}</p>
                <p className="text-[15px] font-extrabold text-orange-500">{tournamentTarget.lengthCm}cm</p>
              </div>
            </div>

            {tourLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-navy-400">
                <Loader2 size={18} className="animate-spin text-aqua-500" />
                <span className="text-[13px]">대회 목록 불러오는 중...</span>
              </div>
            ) : tournaments.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[14px] font-semibold text-navy-600">진행중인 대회가 없어요</p>
                <p className="mt-1 text-[12px] text-navy-300">대회가 시작되면 여기서 참가할 수 있습니다.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {tournaments.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitToTournament(t)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-navy-100 bg-surface-200 p-3.5 text-left transition-colors hover:border-orange-400/40 hover:bg-orange-500/5 active:scale-[0.99] disabled:opacity-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-aqua-500">
                        <Trophy size={18} className="text-white" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-navy-900">{t.title}</p>
                        <p className="text-[11px] text-navy-400">
                          {t.speciesName ?? "전어종"} · 참가 {t.entryCount}명
                          {t.endDate && ` · ~${new Date(t.endDate).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}`}
                        </p>
                      </div>
                      {submitting ? (
                        <Loader2 size={16} className="shrink-0 animate-spin text-navy-300" />
                      ) : (
                        <ChevronRight size={16} className="shrink-0 text-navy-300" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Sheet>

      {/* ── 삭제 확인 다이얼로그 ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={
          deleteTarget
            ? `${deleteTarget.speciesKr}${deleteTarget.lengthCm != null ? ` ${deleteTarget.lengthCm}cm` : ""} 기록을 삭제할까요?`
            : ""
        }
        message="삭제한 기록은 복구할 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-card border border-navy-100 bg-surface-200 p-3">
      <div className="flex items-center gap-1.5 text-navy-400">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-[18px] font-extrabold text-navy-900">{value}</p>
      <p className="truncate text-[11px] text-navy-300">{sub}</p>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-navy-50 px-3 py-2.5">
      <span className="shrink-0 text-aqua-400">{icon}</span>
      <span className="text-navy-400">{label}</span>
      <span className="ml-auto truncate font-semibold text-navy-800">{value}</span>
    </div>
  );
}
