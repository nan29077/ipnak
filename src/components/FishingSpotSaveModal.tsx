"use client";
/**
 * 어장포인트 저장 공통 모달
 *
 * 스마트피싱 기록(TripDetailSheet)·AI 측정(measure) 양쪽에서 재사용한다.
 * - 위치·어종·사진 등은 호출부가 initial 로 자동 입력해 준다.
 * - 사용자는 스팟 이름과 메모만 채우면 저장된다.
 * - spotId 가 있으면 수정 모드(PATCH), 없으면 신규 저장(POST).
 *
 * 바텀시트(z-9999) 위에 떠야 하므로 body 포털 + z-[10000] 으로 올린다.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPin, X } from "lucide-react";
import { useToast } from "@/components/Toast";

export type FishingSpotSource = "ai" | "trip" | "manual";

export type FishingSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  depth: number | null;
  species: string | null;
  season: string | null;
  memo: string | null;
  photoUrl: string | null;
  sourceType: string | null;
  sourceTripId: string | null;
  sourceCatchId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FishingSpotDraft = {
  name?: string | null;
  lat: number;
  lng: number;
  depth?: number | null;
  species?: string | null;
  season?: string | null;
  memo?: string | null;
  photoUrl?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** 자동 입력값 (위치는 필수) */
  initial: FishingSpotDraft | null;
  /** 저장 출처 */
  sourceType: FishingSpotSource;
  sourceTripId?: string | null;
  sourceCatchId?: string | null;
  /** 값이 있으면 수정 모드 */
  spotId?: string | null;
  /** 저장 성공 시 콜백 */
  onSaved?: (spot: FishingSpot) => void;
};

const inputCls =
  "w-full rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-navy-800 outline-none transition-colors placeholder:text-navy-400 focus:border-orange-400";
const labelCls = "mb-1 block text-[11px] font-semibold text-navy-400";

export function FishingSpotSaveModal({
  open,
  onClose,
  initial,
  sourceType,
  sourceTripId,
  sourceCatchId,
  spotId,
  onSaved,
}: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [depth, setDepth] = useState("");
  const [species, setSpecies] = useState("");
  const [season, setSeason] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  // 자동 입력값은 ref 로 들고 있는다 — 호출부가 렌더마다 새 객체를 만들어도
  // 입력 중인 폼이 초기화되지 않도록 "닫힘 → 열림" 전환에서만 채운다.
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    if (!open) return;
    const src = initialRef.current;
    setName(src?.name ?? "");
    setDepth(src?.depth != null ? String(src.depth) : "");
    setSpecies(src?.species ?? "");
    setSeason(src?.season ?? "");
    setMemo(src?.memo ?? "");
    setSaving(false);
  }, [open]);

  if (!open || !initial || typeof document === "undefined") return null;

  async function handleSave() {
    if (saving || !initial) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast("스팟 이름을 입력해 주세요.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: trimmed,
        lat: initial.lat,
        lng: initial.lng,
        depth: depth.trim() === "" ? null : Number(depth),
        species: species.trim() || null,
        season: season.trim() || null,
        memo: memo.trim() || null,
        photoUrl: initial.photoUrl ?? null,
        sourceType,
        sourceTripId: sourceTripId ?? null,
        sourceCatchId: sourceCatchId ?? null,
      };
      const res = await fetch(spotId ? `/api/fishing-spots/${spotId}` : "/api/fishing-spots", {
        method: spotId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "어장포인트 저장에 실패했어요.", "error");
        return;
      }
      toast(spotId ? "어장포인트를 수정했어요" : "어장포인트에 저장했어요", "success");
      if (data.spot) onSaved?.(data.spot as FishingSpot);
      onClose();
    } catch {
      toast("어장포인트 저장에 실패했어요.", "error");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="어장포인트 저장"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#162538] sm:rounded-3xl">
        {/* 드래그 핸들 */}
        <div className="mx-auto mt-2.5 mb-0.5 h-1 w-10 rounded-full bg-navy-200/50" aria-hidden />
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-navy-100/15 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-orange-400" strokeWidth={2} />
            <p className="text-[15px] font-bold text-navy-800">
              {spotId ? "어장포인트 수정" : "어장포인트로 저장"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-1 text-navy-300 transition-colors hover:bg-white/5"
          >
            <X size={19} />
          </button>
        </div>

        {/* 폼 */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {/* 자동 입력된 위치 */}
          <div className="rounded-xl border border-navy-100/20 bg-[#0d1b2a] px-3 py-2.5">
            <p className="text-[11px] font-semibold text-navy-400">위치 (자동 입력)</p>
            <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-navy-800">
              {initial.lat.toFixed(5)}, {initial.lng.toFixed(5)}
            </p>
          </div>

          {initial.photoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={initial.photoUrl}
              alt="어장포인트 사진"
              className="h-32 w-full rounded-xl object-cover"
            />
          )}

          <div>
            <label className={labelCls} htmlFor="spot-name">
              스팟 이름 <span className="text-orange-400">*</span>
            </label>
            <input
              id="spot-name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 나주호 북단 수초대"
              maxLength={60}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} htmlFor="spot-depth">수심 (m)</label>
              <input
                id="spot-depth"
                className={inputCls}
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                inputMode="decimal"
                placeholder="예: 3.5"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="spot-season">최적 계절/시간</label>
              <input
                id="spot-season"
                className={inputCls}
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="예: 봄 새벽"
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="spot-species">주요 어종 (쉼표로 구분)</label>
            <input
              id="spot-species"
              className={inputCls}
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="예: 배스, 붕어"
              maxLength={200}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="spot-memo">메모</label>
            <textarea
              id="spot-memo"
              className={`${inputCls} min-h-[84px] resize-none`}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="채비·진입로·주차 등 다시 올 때 도움이 될 내용"
              maxLength={1000}
            />
          </div>
        </div>

        {/* 저장 */}
        <div className="border-t border-navy-100/15 px-4 py-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-[14px] font-semibold text-gray-900 transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "저장 중..." : spotId ? "수정 저장" : "어장포인트 저장"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
