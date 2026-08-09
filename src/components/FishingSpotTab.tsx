"use client";
/**
 * 내 어장포인트 탭 (마이페이지 "낚시활동" 서브탭)
 *
 * 구성
 * - 지도(Leaflet) + 내 스팟 마커 → 마커 클릭 시 상세 시트
 * - "+" 버튼 → 위치 선택(지도 탭 / 현재 위치 / 내 기록에서 불러오기) → 저장 모달
 * - 지도 아래 스팟 목록 카드 (수정 / 삭제)
 *
 * 저장 모달은 스마트피싱·AI 측정과 공용인 FishingSpotSaveModal 을 재사용한다.
 */
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import {
  Crosshair, Fish, Loader2, MapPin, Pencil, Plus, Route, Ruler, Trash2, X,
} from "lucide-react";
import { Sheet } from "@/components/ui";
import { useToast } from "@/components/Toast";
import {
  FishingSpotSaveModal,
  type FishingSpot,
  type FishingSpotDraft,
  type FishingSpotSource,
} from "@/components/FishingSpotSaveModal";

const SpotMap = dynamic(() => import("@/components/map/FishingSpotMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0d1b2a]">
      <Loader2 size={16} className="animate-spin text-aqua-500" />
    </div>
  ),
});

type TripSummary = {
  id: string;
  region: string | null;
  distanceM: number;
  catchCount: number;
  createdAt: string;
};

/** 저장 모달에 넘길 대기 상태 */
type PendingDraft = {
  draft: FishingSpotDraft;
  sourceType: FishingSpotSource;
  sourceTripId?: string | null;
  sourceCatchId?: string | null;
  spotId?: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul",
  });
}

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

export function FishingSpotTab() {
  const toast = useToast();
  const [spots, setSpots] = useState<FishingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 위치 선택 모달
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripLoadingId, setTripLoadingId] = useState<string | null>(null);

  // 저장 모달
  const [pending, setPending] = useState<PendingDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fishing-spots");
      const data = await res.json().catch(() => ({}));
      setSpots(Array.isArray(data.spots) ? data.spots : []);
    } catch {
      setSpots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = spots.find((s) => s.id === selectedId) ?? null;

  /* ── 스팟 추가 흐름 ── */

  function openPicker() {
    setPicked(null);
    setPickerOpen(true);
  }

  function useCurrentPosition() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast("이 기기에서는 현재 위치를 쓸 수 없어요.", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPicked([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        toast("현재 위치를 가져오지 못했어요.", "error");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function openTripPicker() {
    setTripPickerOpen(true);
    if (trips.length > 0) return;
    setTripsLoading(true);
    try {
      const res = await fetch("/api/trips");
      const data = await res.json().catch(() => ({}));
      setTrips(Array.isArray(data.trips) ? data.trips : []);
    } catch {
      setTrips([]);
    } finally {
      setTripsLoading(false);
    }
  }

  /** 스마트피싱 기록 선택 → 상세 조회로 위치·어종 자동 입력 */
  async function pickFromTrip(tripId: string) {
    if (tripLoadingId) return;
    setTripLoadingId(tripId);
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      const data = await res.json().catch(() => ({}));
      const trip = data?.trip;
      const points: { lat: number; lng: number }[] = Array.isArray(trip?.routePoints) ? trip.routePoints : [];
      const catches: { speciesName?: string | null }[] = Array.isArray(trip?.catches) ? trip.catches : [];
      // 출조 위치: 동선 중간 지점(없으면 첫 지점)
      const base = points.length > 0 ? points[Math.floor(points.length / 2)] ?? points[0] : null;
      if (!base) {
        toast("이 기록에는 위치 정보가 없어요.", "error");
        return;
      }
      const species = Array.from(
        new Set(catches.map((c) => c.speciesName).filter((v): v is string => !!v))
      ).join(", ");
      setTripPickerOpen(false);
      setPickerOpen(false);
      setPending({
        draft: {
          name: trip?.region ? `${trip.region} 포인트` : "",
          lat: base.lat,
          lng: base.lng,
          species: species || null,
          memo: trip?.startedAt ? `출조일 ${formatDate(trip.startedAt)}` : null,
        },
        sourceType: "trip",
        sourceTripId: tripId,
      });
    } catch {
      toast("기록을 불러오지 못했어요.", "error");
    } finally {
      setTripLoadingId(null);
    }
  }

  function confirmPicked() {
    if (!picked) return;
    setPickerOpen(false);
    setPending({
      draft: { lat: picked[0], lng: picked[1] },
      sourceType: "manual",
    });
  }

  /* ── 수정 / 삭제 ── */

  function startEdit(spot: FishingSpot) {
    setDetailOpen(false);
    setPending({
      draft: {
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        depth: spot.depth,
        species: spot.species,
        season: spot.season,
        memo: spot.memo,
        photoUrl: spot.photoUrl,
      },
      sourceType: (spot.sourceType as FishingSpotSource) || "manual",
      sourceTripId: spot.sourceTripId,
      sourceCatchId: spot.sourceCatchId,
      spotId: spot.id,
    });
  }

  async function handleDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/fishing-spots/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "삭제에 실패했어요.", "error");
        return;
      }
      setSpots((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) { setSelectedId(null); setDetailOpen(false); }
      toast("어장포인트를 삭제했어요", "success");
    } catch {
      toast("삭제에 실패했어요.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  /** 저장/수정 성공 → 목록 반영 */
  function handleSaved(spot: FishingSpot) {
    setSpots((prev) => {
      const idx = prev.findIndex((s) => s.id === spot.id);
      if (idx === -1) return [spot, ...prev];
      const next = [...prev];
      next[idx] = spot;
      return next;
    });
    setPending(null);
  }

  const markers = spots.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name }));

  return (
    <div className="space-y-3">
      {/* ── 지도 ── */}
      <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
        <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
          <MapPin size={14} className="text-aqua-400" strokeWidth={1.8} />
          <p className="text-[13px] font-bold text-navy-700">내 어장포인트</p>
          <span className="ml-1 text-[11px] text-navy-400">{spots.length}곳</span>
          {/* + 버튼: 헤더 우측 인라인 배치 (글쓰기 FAB 겹침 방지) */}
          <button
            type="button"
            onClick={openPicker}
            aria-label="어장포인트 추가"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-gray-900 shadow-sm transition-colors hover:bg-orange-600"
          >
            <Plus size={15} strokeWidth={2.4} />
          </button>
        </div>
        <div className="h-56 w-full">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center bg-[#0d1b2a]">
              <Loader2 size={16} className="animate-spin text-aqua-500" />
            </div>
          ) : (
            <SpotMap
              spots={markers}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setDetailOpen(true); }}
            />
          )}
        </div>
      </div>

      {/* ── 목록 ── */}
      <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
        <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
          <Fish size={14} className="text-orange-400" strokeWidth={1.8} />
          <p className="text-[13px] font-bold text-navy-700">스팟 목록</p>
        </div>
        <div className="p-3">
          {loading ? (
            <p className="py-6 text-center text-[13px] text-navy-400">불러오는 중...</p>
          ) : spots.length === 0 ? (
            <div className="py-6 text-center">
              <MapPin size={26} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
              <p className="text-[13px] text-navy-400">저장한 어장포인트가 없습니다</p>
              <button
                type="button"
                onClick={openPicker}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-orange-400/60 px-3 py-1 text-[12px] font-semibold text-orange-400"
              >
                <Plus size={13} /> 첫 스팟 추가
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {spots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-2.5"
                >
                  <button
                    type="button"
                    onClick={() => { setSelectedId(s.id); setDetailOpen(true); }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {s.photoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={s.photoUrl} alt={s.name} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-aqua-500/15">
                        <MapPin size={17} className="text-aqua-400" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-navy-800">{s.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-navy-400">
                        {[
                          s.species,
                          s.depth != null ? `수심 ${s.depth}m` : null,
                          s.season,
                        ].filter(Boolean).join(" · ") || formatDate(s.createdAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    aria-label="수정"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-white/5 hover:text-orange-400"
                  >
                    <Pencil size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    aria-label="삭제"
                    title={deleteConfirmId === s.id ? "한 번 더 누르면 삭제됩니다" : "삭제"}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                      deleteConfirmId === s.id
                        ? "bg-red-500/20 text-red-400"
                        : "text-navy-400 hover:bg-white/5 hover:text-red-400"
                    }`}
                  >
                    {deletingId === s.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} strokeWidth={1.9} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 스팟 상세 시트 ── */}
      <Sheet
        open={detailOpen && !!selected}
        onClose={() => setDetailOpen(false)}
        title={selected?.name || "어장포인트"}
        size="md"
      >
        {selected && (
          <div className="space-y-3">
            {selected.photoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={selected.photoUrl}
                alt={selected.name}
                className="w-full rounded-2xl object-cover"
                style={{ maxHeight: "40vh" }}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[#0d1b2a] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Ruler size={13} className="text-navy-400" />
                  <p className="text-[10px] text-navy-400">수심</p>
                </div>
                <p className="text-[16px] font-bold text-navy-800">
                  {selected.depth != null ? `${selected.depth}m` : "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#0d1b2a] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Fish size={13} className="text-navy-400" />
                  <p className="text-[10px] text-navy-400">주요 어종</p>
                </div>
                <p className="text-[13px] font-semibold text-navy-800">{selected.species || "—"}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0d1b2a] p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <MapPin size={13} className="text-navy-400" />
                <p className="text-[10px] text-navy-400">위치</p>
              </div>
              <p className="text-[13px] font-semibold tabular-nums text-navy-800">
                {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
              </p>
              {selected.season && (
                <p className="mt-1 text-[12px] text-navy-400">최적 계절/시간: {selected.season}</p>
              )}
            </div>

            {selected.memo && (
              <div className="rounded-2xl bg-[#0d1b2a] p-3">
                <p className="mb-1 text-[10px] text-navy-400">메모</p>
                <p className="whitespace-pre-wrap text-[13px] text-navy-700">{selected.memo}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(selected)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-navy-100 bg-surface-200 py-3 text-[13px] font-semibold text-navy-700"
              >
                <Pencil size={15} strokeWidth={1.9} /> 수정
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selected.id)}
                disabled={deletingId === selected.id}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                  deleteConfirmId === selected.id
                    ? "bg-red-500/20 text-red-400"
                    : "border border-navy-100 bg-surface-200 text-navy-700"
                }`}
              >
                {deletingId === selected.id
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Trash2 size={15} strokeWidth={1.9} />}
                {deleteConfirmId === selected.id ? "한 번 더 누르면 삭제" : "삭제"}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* ── 위치 선택 모달 ── */}
      {pickerOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="어장포인트 위치 선택"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setPickerOpen(false)} />
          <div className="relative flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#162538] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-navy-100/15 px-4 py-3.5">
              <p className="text-[15px] font-bold text-navy-800">새 어장포인트 위치</p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="닫기"
                className="rounded-full p-1 text-navy-300 transition-colors hover:bg-white/5"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <p className="text-[12px] text-navy-400">
                지도를 탭해 위치를 찍거나, 아래 버튼으로 현재 위치·내 기록에서 불러오세요.
              </p>
              <div className="h-52 w-full overflow-hidden rounded-2xl border border-navy-100/20">
                <SpotMap
                  spots={markers}
                  pickMode
                  pickedPosition={picked}
                  onPick={(lat, lng) => setPicked([lat, lng])}
                />
              </div>
              {picked && (
                <p className="rounded-xl bg-[#0d1b2a] px-3 py-2 text-[12px] font-semibold tabular-nums text-navy-700">
                  선택 위치: {picked[0].toFixed(5)}, {picked[1].toFixed(5)}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={useCurrentPosition}
                  disabled={locating}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-aqua-400/40 bg-aqua-400/10 py-3 text-[13px] font-semibold text-aqua-300 disabled:opacity-50"
                >
                  {locating ? <Loader2 size={15} className="animate-spin" /> : <Crosshair size={15} />}
                  현재 위치
                </button>
                <button
                  type="button"
                  onClick={openTripPicker}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-navy-100 bg-surface-200 py-3 text-[13px] font-semibold text-navy-700"
                >
                  <Route size={15} />
                  내 기록에서
                </button>
              </div>
            </div>

            <div className="border-t border-navy-100/15 px-4 py-3">
              <button
                type="button"
                onClick={confirmPicked}
                disabled={!picked}
                className="w-full rounded-2xl bg-orange-500 py-3 text-[14px] font-semibold text-gray-900 transition-colors hover:bg-orange-600 disabled:opacity-40"
              >
                이 위치로 저장하기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 내 기록에서 불러오기 ── */}
      {tripPickerOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[10001] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="내 기록에서 불러오기"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setTripPickerOpen(false)} />
          <div className="relative flex max-h-[80vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#162538] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-navy-100/15 px-4 py-3.5">
              <p className="text-[15px] font-bold text-navy-800">내 기록에서 불러오기</p>
              <button
                type="button"
                onClick={() => setTripPickerOpen(false)}
                aria-label="닫기"
                className="rounded-full p-1 text-navy-300 transition-colors hover:bg-white/5"
              >
                <X size={19} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {tripsLoading ? (
                <p className="py-8 text-center text-[13px] text-navy-400">불러오는 중...</p>
              ) : trips.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-navy-400">스마트피싱 기록이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {trips.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickFromTrip(t.id)}
                      disabled={!!tripLoadingId}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-navy-100/15 bg-[#0d1b2a] p-3 text-left disabled:opacity-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15">
                        {tripLoadingId === t.id
                          ? <Loader2 size={15} className="animate-spin text-orange-400" />
                          : <Route size={15} className="text-orange-400" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-navy-800">
                          {t.region || "스마트피싱 기록"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-navy-400">
                          {formatDate(t.createdAt)} · {formatDist(t.distanceM)} · 피쉬 {t.catchCount}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 저장 / 수정 모달 ── */}
      <FishingSpotSaveModal
        open={!!pending}
        onClose={() => setPending(null)}
        initial={pending?.draft ?? null}
        sourceType={pending?.sourceType ?? "manual"}
        sourceTripId={pending?.sourceTripId}
        sourceCatchId={pending?.sourceCatchId}
        spotId={pending?.spotId}
        onSaved={handleSaved}
      />
    </div>
  );
}
