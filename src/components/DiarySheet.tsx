"use client";
/**
 * 계측일지 바텀시트
 * AI측정 페이지에서 "계측일지" 버튼 클릭 시 하단에서 올라오는 시트
 * DiaryPage 와 동일한 로직 — PageHeader 없이 Sheet 안에 임베드
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera, Trophy, Ruler, Hash, MapPin, Thermometer, Waves,
  Trash2, CloudSun, Moon, ChevronRight, Loader2,
} from "lucide-react";
import { Button, Chip, EmptyState, LoadingState, Sheet, Badge } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { entryFeeConfirmText, fetchEntryFeeInfo, type EntryFeeInfo } from "@/lib/tournamentFee";
import { FISH_SPECIES } from "@/constants/errorMessages";
import { dbService } from "@/services/DatabaseService";
import { loadDiaryItems, filterDiaryItems, computeStats } from "@/services/DiaryDataService";
import syncService from "@/services/SyncService";

const PAGE_SIZE = 20;

type Item = {
  /** 로컬 기록은 number(타임스탬프), 서버 기록은 "srv:<id>" 문자열 */
  id: number | string;
  /** "local" = 이 기기 localStorage, "server" = /api/catch 서버 기록 */
  source?: "local" | "server";
  measuredAt: string;
  lengthCm: number;
  weightG: number | null;
  speciesKr: string;
  confidenceGrade: string | null;
  /** 서버 업로드 사진 URL (신규 기록) */
  imageUrl?: string | null;
  /** 업로드 실패 시 폴백으로 남는 로컬 base64 (구 기록 포함) */
  imageBase64: string | null;
  locationName: string | null;
  weather: string | null;
  temperature: number | null;
  tidePhase: string | null;
  /** 물때 이름 (예: "7물") — 구 기록에는 없을 수 있음 */
  tideName?: string | null;
  /** 수온(°C) — 구 기록에는 없을 수 있음 */
  waterTemp?: number | null;
  synced: number;
};

type TournamentInfo = {
  id: string; title: string; type: string; speciesName: string | null;
  startDate: string | null; endDate: string | null; entryCount: number;
  // 참가비 / 순위 보상 포인트 — null 이면 무료 / 보상 없음
  entryFee?: number | null;
  reward1st?: number | null; reward2nd?: number | null; reward3rd?: number | null;
};

const GRADE_STYLE: Record<string, { label: string; cls: string }> = {
  HIGH: { label: "정밀", cls: "bg-green-500/15 text-green-400" },
  MEDIUM: { label: "일반", cls: "bg-amber-500/15 text-amber-400" },
  LOW: { label: "재측정", cls: "bg-red-500/15 text-red-400" },
};

/** 목록·상세에서 쓸 사진 소스 — 서버 URL 우선, 없으면 로컬 base64 폴백 */
function photoOf(m: Item) {
  return m.imageUrl || m.imageBase64 || null;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface DiarySheetProps {
  open: boolean;
  onClose: () => void;
  /** true 이면 계측일지를 날짜별로 묶어서 표시 (마이페이지 전체보기 용) */
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

/** 계측 기록 한 줄 카드 — DiarySheet 외부에 정의해 매 렌더마다 새 컴포넌트 참조 생성을 방지 */
function ItemCard({ m, onDetailClick, onTournamentClick }: { m: Item; onDetailClick: () => void; onTournamentClick: () => void }) {
  const grade = m.confidenceGrade ? GRADE_STYLE[m.confidenceGrade] : null;
  const photo = photoOf(m);
  return (
    <li>
      <div className="rounded-card border border-navy-100 bg-surface-200 overflow-hidden">
        <button
          type="button"
          onClick={onDetailClick}
          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-300 active:scale-[0.99]"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-100">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-full w-full object-cover" />
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

export function DiarySheet({ open, onClose, groupByDate = false }: DiarySheetProps) {
  const toast = useToast();
  const [stats, setStats] = useState<any>(null);
  // 로컬 + 서버 병합 원본. 필터·페이지는 이 배열에서 파생시킨다 (중복 로드/중복 항목 원천 차단)
  const [all, setAll] = useState<Item[]>([]);
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
  // 참가비 차감 확인 모달 대상
  const [feeConfirm, setFeeConfirm] = useState<{ t: TournamentInfo; info: EntryFeeInfo } | null>(null);

  /** 로컬 + 서버 기록을 한 번에 읽어 통계까지 갱신 */
  const reload = useCallback(async () => {
    setLoading(true);
    const list = (await loadDiaryItems()) as Item[];
    setAll(list);
    setStats(computeStats(list));
    const st = await syncService.getSyncStatus();
    setPendingSync(st.pendingCount);
    setLoading(false);
  }, []);

  // 시트 열릴 때 1회만 초기화 + 로드 (예전엔 필터 이펙트까지 함께 돌아 2회 로드됐다)
  useEffect(() => {
    if (!open) return;
    setPage(1);
    setSpecies("");
    setDetail(null);
    setDeleteTarget(null);
    setTournamentTarget(null);
    void reload();
  }, [open, reload]);

  // 어종 필터는 이미 받아온 목록에서 걸러낸다 — 재조회 없이 페이지만 처음으로
  useEffect(() => { setPage(1); }, [species]);

  const filtered = useMemo(() => filterDiaryItems(all, { species }) as Item[], [all, species]);
  const total = filtered.length;
  const items = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  // 무한 스크롤 (Sheet 내부 스크롤 컨테이너 기준)
  // 목록을 원본에서 slice 로 파생시키므로 콜백이 여러 번 불려도 항목이 중복되지 않는다.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        setPage((p) => (p * PAGE_SIZE >= total ? p : p + 1));
      },
      { rootMargin: "200px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [items.length, total]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    // 서버 기록은 이 화면에서 지우지 않는다 (로컬 기록만 삭제 대상)
    if (deleteTarget.source === "server") { setDeleteTarget(null); return; }
    await dbService.deleteMeasurement(deleteTarget.id);
    setDeleteTarget(null);
    setDetail(null);
    setPage(1);
    await reload();
    toast("기록을 삭제했어요", "info");
  }

  // 대회 참가 버튼 클릭 → 진행중 대회 목록 로드
  async function handleTournamentClick(item: Item) {
    setTournamentTarget(item);
    setTourLoading(true);
    try {
      const res = await fetch("/api/tournaments");
      const data = await res.json();
      // 오류 응답은 배열이 아니다 — 그대로 넣으면 아래 .map 에서 터진다
      setTournaments(Array.isArray(data) ? data : []);
    } catch {
      setTournaments([]);
    } finally {
      setTourLoading(false);
    }
  }

  // 대회 선택 → 참가비가 차감되는 경우에만 확인 모달을 거친다
  async function submitToTournament(t: TournamentInfo) {
    if (!tournamentTarget) return;
    setSubmitting(true);
    const info = await fetchEntryFeeInfo(t.id);
    setSubmitting(false);
    if (info?.willCharge) { setFeeConfirm({ t, info }); return; }
    await doSubmitToTournament(t);
  }

  async function doSubmitToTournament(t: TournamentInfo) {
    if (!tournamentTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${t.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speciesName: tournamentTarget.speciesKr,
          sizeCm: tournamentTarget.lengthCm,
          photoUrl: photoOf(tournamentTarget),
          measuredImageUrl: photoOf(tournamentTarget),
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

  return (
    <>
      <Sheet open={open} onClose={onClose} title="계측일지" size="diary" stickyContent={statsContent}>
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
                  className="inline-flex items-center gap-2 rounded-[16px] bg-orange-500 px-4 py-2.5 text-[14px] font-semibold text-gray-900 shadow-soft transition-colors hover:bg-orange-600"
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
            {photoOf(detail) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoOf(detail)!} alt="측정 사진" className="w-full rounded-2xl ring-1 ring-navy-100" />
            )}
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <InfoRow icon={<Ruler size={14} strokeWidth={1.8} />} label="전장" value={`${detail.lengthCm}cm`} />
              <InfoRow icon={<Hash size={14} strokeWidth={1.8} />} label="추정 무게" value={detail.weightG ? `약 ${detail.weightG}g` : "-"} />
              {/* 날씨는 저장 시점의 GPS 기준 실황 — 위치 거부·조회 실패 시 값이 없다 */}
              <InfoRow icon={<CloudSun size={14} strokeWidth={1.8} />} label="날씨" value={detail.weather || "정보 없음"} />
              <InfoRow icon={<Thermometer size={14} strokeWidth={1.8} />} label="기온" value={detail.temperature != null ? `${detail.temperature}°C` : "-"} />
              <InfoRow icon={<Thermometer size={14} strokeWidth={1.8} />} label="수온" value={detail.waterTemp != null ? `${detail.waterTemp}°C` : "-"} />
              <InfoRow
                icon={<Waves size={14} strokeWidth={1.8} />}
                label="물때"
                value={[detail.tideName, detail.tidePhase].filter(Boolean).join(" · ") || "-"}
              />
              {/* 날짜+시간이 길어 반 칸에서는 잘린다 — 두 칸을 통으로 사용 */}
              <InfoRow icon={<Moon size={14} strokeWidth={1.8} />} label="측정 일시" value={fmtDate(detail.measuredAt)} className="col-span-2" />
            </div>
            {detail.locationName && (
              <p className="flex items-center gap-1.5 rounded-xl bg-navy-50 px-3 py-2 text-[12px] text-navy-500">
                <MapPin size={13} strokeWidth={1.8} className="shrink-0 text-aqua-400" />
                {detail.locationName}
              </p>
            )}
            {/* 서버 기록은 다른 기기에서 올라온 조과 — 이 화면에서는 삭제 대상이 아니다 */}
            {detail.source === "server" ? (
              <p className="rounded-xl bg-navy-50 px-3 py-2 text-center text-[11px] text-navy-300">
                다른 기기에서 저장된 서버 기록입니다
              </p>
            ) : (
              <Button
                variant="danger"
                size="sm"
                full
                leftIcon={<Trash2 size={15} />}
                onClick={() => setDeleteTarget(detail)}
              >
                기록 삭제
              </Button>
            )}
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
              {photoOf(tournamentTarget) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoOf(tournamentTarget)!} alt="" className="h-12 w-12 rounded-lg object-cover" />
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
                        {/* 참가비 배지 — 없으면 무료 */}
                        <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          t.entryFee && t.entryFee > 0 ? "bg-orange-500/12 text-orange-500" : "bg-navy-50 text-navy-400"
                        }`}>
                          {t.entryFee && t.entryFee > 0 ? `참가비 ${t.entryFee.toLocaleString()}P` : "무료"}
                        </span>
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

      {/* ── 참가비 차감 확인 다이얼로그 ── */}
      <ConfirmDialog
        open={!!feeConfirm}
        title={feeConfirm ? entryFeeConfirmText(feeConfirm.info).title : ""}
        message={feeConfirm ? entryFeeConfirmText(feeConfirm.info).message : undefined}
        confirmLabel="참가하기"
        cancelLabel="취소"
        onConfirm={() => {
          const target = feeConfirm;
          setFeeConfirm(null);
          if (target) void doSubmitToTournament(target.t);
        }}
        onCancel={() => setFeeConfirm(null)}
      />

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
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** 그리드 셀 확장 등 추가 배치 클래스 (예: col-span-2) */
  className?: string;
}) {
  return (
    <div className={"flex items-center gap-2 rounded-xl bg-navy-50 px-3 py-2.5 " + className}>
      <span className="shrink-0 text-aqua-400">{icon}</span>
      {/* 레이블·값 모두 줄바꿈/말줄임 없이 한 줄 유지 — 좁은 셀은 col-span-2 로 해결 */}
      <span className="shrink-0 whitespace-nowrap text-navy-400">{label}</span>
      <span className="ml-auto whitespace-nowrap font-semibold text-navy-800">{value}</span>
    </div>
  );
}
