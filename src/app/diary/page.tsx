"use client";
/**
 * 측정일지 페이지
 * - 통계 카드 (최대어 / 평균 길이 / 총 마릿수)
 * - 어종 필터 + 무한 스크롤 기록 리스트
 * - 기록 상세 시트 (이미지 + 자동 태그) / 삭제
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera, Trophy, Ruler, Hash, MapPin, Thermometer, Waves, Trash2, CloudSun, Moon,
} from "lucide-react";
import { PageHeader, Button, Chip, EmptyState, LoadingState, Sheet } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FISH_SPECIES } from "@/constants/errorMessages";
import { dbService } from "@/services/DatabaseService";
import syncService from "@/services/SyncService";

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

const GRADE_STYLE: Record<string, { label: string; cls: string }> = {
  HIGH: { label: "정밀", cls: "bg-green-500/15 text-green-400" },
  MEDIUM: { label: "일반", cls: "bg-amber-500/15 text-amber-400" },
  LOW: { label: "재측정", cls: "bg-red-500/15 text-red-400" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DiaryPage() {
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

  // 최초 로드 + 필터 변경
  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadPage(1, species, true);
    loadStats();
  }, [species, loadPage, loadStats]);

  // 무한 스크롤
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && items.length < total) {
        const next = page + 1;
        setPage(next);
        loadPage(next, species, false);
      }
    }, { rootMargin: "200px" });
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

  return (
    <div className="pb-10">
      <PageHeader
        title="측정일지"
        back
        sub="AI 측정 기록 모아보기"
        right={
          <Link
            href="/measure"
            className="flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-soft transition-colors hover:bg-orange-600"
          >
            <Camera size={15} strokeWidth={1.9} />
            측정하기
          </Link>
        }
      />

      <div className="space-y-4 p-4">
        {/* ── 통계 카드 ── */}
        {stats && (
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
        )}

        {pendingSync > 0 && (
          <p className="text-center text-[11px] text-navy-300">
            서버 미동기화 기록 {pendingSync}건 — 온라인 연결 시 자동 업로드됩니다
          </p>
        )}

        {/* ── 어종 필터 ── */}
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          <Chip size="sm" active={species === ""} onClick={() => setSpecies("")}>전체</Chip>
          {FISH_SPECIES.map((s: any) => (
            <Chip key={s.key} size="sm" active={species === s.key} onClick={() => setSpecies(s.key)}>
              {s.key}
            </Chip>
          ))}
        </div>

        {/* ── 기록 리스트 ── */}
        {loading ? (
          <LoadingState label="기록 불러오는 중..." />
        ) : items.length === 0 ? (
          <EmptyState
            title="아직 측정 기록이 없어요"
            desc="입낚볼과 함께 촬영하면 길이·무게가 자동 기록됩니다."
            action={
              <Link
                href="/measure"
                className="inline-flex items-center gap-2 rounded-[16px] bg-orange-500 px-4 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-colors hover:bg-orange-600"
              >
                <Camera size={16} strokeWidth={1.9} />
                첫 측정 시작하기
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {items.map((m) => {
              const grade = m.confidenceGrade ? GRADE_STYLE[m.confidenceGrade] : null;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(m)}
                    className="flex w-full items-center gap-3 rounded-card border border-navy-100 bg-surface-200 p-3 text-left transition-colors hover:bg-surface-300 active:scale-[0.99]"
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
                </li>
              );
            })}
          </ul>
        )}

        {/* 무한 스크롤 센티널 */}
        <div ref={sentinelRef} />
        {!loading && items.length > 0 && items.length >= total && (
          <p className="pt-2 text-center text-[11px] text-navy-300">모든 기록을 확인했어요</p>
        )}
      </div>

      {/* ── 상세 시트 ── */}
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.speciesKr} ${detail.lengthCm}cm` : ""}>
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
            <Button variant="danger" size="sm" full leftIcon={<Trash2 size={15} />} onClick={() => setDeleteTarget(detail)}>
              기록 삭제
            </Button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `${deleteTarget.speciesKr}${deleteTarget.lengthCm != null ? ` ${deleteTarget.lengthCm}cm` : ""} 기록을 삭제할까요?` : ""}
        message="삭제한 기록은 복구할 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-navy-50 px-3 py-2.5">
      <span className="shrink-0 text-aqua-400">{icon}</span>
      <span className="text-navy-400">{label}</span>
      <span className="ml-auto truncate font-semibold text-navy-800">{value}</span>
    </div>
  );
}
