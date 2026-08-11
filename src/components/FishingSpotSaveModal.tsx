"use client";
/**
 * 어장포인트 저장 공통 바텀시트
 *
 * 스마트피싱 기록(TripDetailSheet)·AI 측정(measure)·어장 탭(FishingSpotTab)에서 재사용한다.
 * - 위치·날씨·기온·수온·바람·물때·어종은 호출부가 initial 로 자동 입력해 주고,
 *   사용자는 그대로 두거나 직접 고칠 수 있다 (값이 없으면 빈 칸으로 둔다 — 숨기지 않는다).
 * - 수심·최적 계절/시간·메모는 센서로 알 수 없어 수동 입력 항목이다.
 * - spotId 가 있으면 수정 모드(PATCH), 없으면 신규 저장(POST).
 *
 * 다른 바텀시트(z-9999) 위에 떠야 하므로 body 포털 + z-[10000] 으로 올린다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
  /* ── 위치 표기 + 환경 정보 (Prisma 스키마 밖 raw 컬럼) ── */
  locationName?: string | null;
  weather?: string | null;
  airTemp?: number | null;
  waterTemp?: number | null;
  wind?: string | null;
  tideName?: string | null;
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
  /* ── 자동 입력 항목 — 폼에 채워지고 사용자가 수정할 수 있다 ── */
  /** 위치 표기 (지명). 없으면 좌표 문자열로 채운다. */
  locationName?: string | null;
  /** 날씨 상태 (예: "맑음") */
  weather?: string | null;
  /** 기온(°C) */
  temperature?: number | null;
  /** 수온(°C) */
  waterTemp?: number | null;
  /** 풍속(m/s) — windLabel 과 합쳐 "서북서 0.9m/s" 형태로 표시한다 */
  windSpeed?: number | null;
  /** 풍향 한글 (북/북동/동 ...) */
  windLabel?: string | null;
  /** 이미 조합된 바람 문자열 (수정 모드에서 저장된 값을 되돌려줄 때 사용) */
  wind?: string | null;
  /** 물때 이름 (예: "4물") */
  tideName?: string | null;
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
const labelCls = "mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-navy-400";

/** 자동 입력 항목임을 알리는 작은 배지 — 수정 가능하다는 점을 함께 알린다 */
function AutoBadge() {
  return (
    <span className="rounded-full bg-aqua-500/12 px-1.5 py-[1px] text-[9.5px] font-bold text-aqua-300">
      자동
    </span>
  );
}

/** 좌표를 사람이 읽는 문자열로 (지명이 없을 때의 기본 위치 표기) */
function coordText(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * 위치 입력값 파싱 — "위도, 경도" 형태면 좌표로 인정한다.
 * 지명을 적었으면 null 을 돌려주고, 좌표는 원래 값을 유지한다.
 */
function parseCoords(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,/\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** 자동 수집된 풍향·풍속 → "서북서 0.9m/s" */
function windText(d: FishingSpotDraft): string {
  if (d.wind) return d.wind;
  if (d.windSpeed == null) return d.windLabel ?? "";
  return `${d.windLabel ? `${d.windLabel} ` : ""}${d.windSpeed}m/s`;
}

/** 저장 시점의 계절 — 3~5월 봄 / 6~8월 여름 / 9~11월 가을 / 12~2월 겨울 */
function seasonNow(): string {
  const m = new Date().getMonth() + 1; // getMonth 는 0-based
  if (m >= 3 && m <= 5) return "봄";
  if (m >= 6 && m <= 8) return "여름";
  if (m >= 9 && m <= 11) return "가을";
  return "겨울";
}

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
  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState("");
  const [airTemp, setAirTemp] = useState("");
  const [waterTemp, setWaterTemp] = useState("");
  const [wind, setWind] = useState("");
  const [tideName, setTideName] = useState("");
  const [depth, setDepth] = useState("");
  const [species, setSpecies] = useState("");
  const [season, setSeason] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  // 바텀시트 슬라이드 업 — 마운트 직후 한 프레임 뒤에 올린다
  const [shown, setShown] = useState(false);

  // 자동 입력값은 ref 로 들고 있는다 — 호출부가 렌더마다 새 객체를 만들어도
  // 입력 중인 폼이 초기화되지 않도록 "닫힘 → 열림" 전환에서만 채운다.
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    if (!open) { setShown(false); return; }
    const src = initialRef.current;
    setName(src?.name ?? "");
    // 위치: 지명이 있으면 지명, 없으면 좌표 문자열을 기본값으로 채운다
    setLocation(src?.locationName ?? (src ? coordText(src.lat, src.lng) : ""));
    setWeather(src?.weather ?? "");
    setAirTemp(src?.temperature != null ? String(src.temperature) : "");
    setWaterTemp(src?.waterTemp != null ? String(src.waterTemp) : "");
    setWind(src ? windText(src) : "");
    setTideName(src?.tideName ?? "");
    setDepth(src?.depth != null ? String(src.depth) : "");
    setSpecies(src?.species ?? "");
    // 계절은 저장 시점 기준으로 자동 입력한다. 이미 값이 있으면(수정 모드 등) 그대로 둔다.
    setSeason(src?.season || seasonNow());
    setMemo(src?.memo ?? "");
    setSaving(false);
    // 한 프레임 뒤에 올린다. requestAnimationFrame 은 화면이 가려진 탭에서 아예 발화하지
    // 않아 시트가 화면 밖에 멈춰 버리므로, 숨김 상태에서도 도는 타이머를 쓴다.
    const t = setTimeout(() => setShown(true), 16);
    return () => clearTimeout(t);
  }, [open]);

  // 닫기 — 시트를 먼저 내리고 애니메이션이 끝나면 언마운트한다
  const requestClose = useCallback(() => {
    setShown(false);
    setTimeout(onClose, 220);
  }, [onClose]);

  // ESC 로 닫기 (데스크톱)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

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
      // 위치 칸에 좌표를 직접 적었으면 그 좌표로 저장한다 (지명이면 좌표는 그대로 유지).
      const typed = parseCoords(location);
      const payload = {
        name: trimmed,
        lat: typed?.lat ?? initial.lat,
        lng: typed?.lng ?? initial.lng,
        locationName: location.trim() || null,
        weather: weather.trim() || null,
        airTemp: airTemp.trim() === "" ? null : Number(airTemp),
        waterTemp: waterTemp.trim() === "" ? null : Number(waterTemp),
        wind: wind.trim() || null,
        tideName: tideName.trim() || null,
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
      requestClose();
    } catch {
      toast("어장포인트 저장에 실패했어요.", "error");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="어장포인트 저장"
    >
      {/* 배경 — 클릭하면 닫힌다 */}
      <div
        className={
          "absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-200 " +
          (shown ? "opacity-100" : "opacity-0")
        }
        onClick={requestClose}
      />

      {/* 바텀시트 — 화면 하단에서 올라온다 */}
      <div
        className={
          "relative flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#162538] " +
          "transition-transform duration-200 ease-out will-change-transform " +
          (shown ? "translate-y-0" : "translate-y-full")
        }
        style={{ maxHeight: "85vh" }}
      >
        {/* pill 드래그 핸들 */}
        <div className="mx-auto mb-0.5 mt-2.5 h-1 w-10 shrink-0 rounded-full bg-navy-200/50" aria-hidden />

        {/* 헤더 — 제목이 잘리지 않도록 아이콘/닫기 버튼을 shrink-0 로 고정한다 */}
        <div className="flex shrink-0 items-center gap-2 border-b border-navy-100/15 px-4 py-3.5">
          <MapPin size={16} className="shrink-0 text-orange-400" strokeWidth={2} />
          <p className="min-w-0 flex-1 text-[15px] font-bold text-navy-800">
            {spotId ? "어장포인트 수정" : "어장포인트로 저장"}
          </p>
          <button
            type="button"
            onClick={requestClose}
            aria-label="닫기"
            className="shrink-0 rounded-full p-1 text-navy-300 transition-colors hover:bg-white/5"
          >
            <X size={19} />
          </button>
        </div>

        {/* 폼 — 내부 스크롤 */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {/* 계측 사진 — 측정선·수치가 찍힌 사진이라 한 귀퉁이도 잘리면 안 된다.
              가로를 꽉 채우고 높이는 사진 비율대로 늘어난다(h-auto). 세로로 긴 사진은
              폼이 화면 밖으로 밀리지 않게 높이만 제한하고, object-contain 이 남는 자리를
              어두운 배경으로 남겨 잘림 없이 전체가 보이게 한다. */}
          {initial.photoUrl && (
            <div className="overflow-hidden rounded-xl border border-navy-100/20 bg-[#0d1b2a]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={initial.photoUrl}
                alt="어장포인트 사진"
                className="block h-auto w-full object-contain"
                style={{ maxHeight: "38vh" }}
              />
            </div>
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

          <div>
            <label className={labelCls} htmlFor="spot-location">위치 <AutoBadge /></label>
            <input
              id="spot-location"
              className={inputCls}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="지명 또는 좌표 (예: 34.79000, 126.39000)"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} htmlFor="spot-weather">날씨 <AutoBadge /></label>
              <input
                id="spot-weather"
                className={inputCls}
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="예: 맑음"
                maxLength={64}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="spot-airtemp">기온 (°C) <AutoBadge /></label>
              <input
                id="spot-airtemp"
                className={inputCls}
                value={airTemp}
                onChange={(e) => setAirTemp(e.target.value)}
                inputMode="decimal"
                placeholder="예: 24.6"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="spot-watertemp">수온 (°C) <AutoBadge /></label>
              <input
                id="spot-watertemp"
                className={inputCls}
                value={waterTemp}
                onChange={(e) => setWaterTemp(e.target.value)}
                inputMode="decimal"
                placeholder="예: 26.5"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="spot-wind">바람 <AutoBadge /></label>
              <input
                id="spot-wind"
                className={inputCls}
                value={wind}
                onChange={(e) => setWind(e.target.value)}
                placeholder="예: 서북서 0.9m/s"
                maxLength={64}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="spot-tide">물때 <AutoBadge /></label>
              <input
                id="spot-tide"
                className={inputCls}
                value={tideName}
                onChange={(e) => setTideName(e.target.value)}
                placeholder="예: 4물"
                maxLength={32}
              />
            </div>
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
          </div>

          <div>
            <label className={labelCls} htmlFor="spot-season">최적 계절/시간 <AutoBadge /></label>
            <input
              id="spot-season"
              className={inputCls}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="예: 봄 새벽"
              maxLength={100}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="spot-species">주요 어종 (쉼표로 구분) <AutoBadge /></label>
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

        {/* 저장 — 하단 고정 */}
        <div
          className="shrink-0 border-t border-navy-100/15 px-4 pt-3"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
        >
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
