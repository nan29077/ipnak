"use client";
/**
 * 낚시 관심사 설정 팝업
 *
 * 표시 조건:
 * - 로그인된 유저이고 관심 방식/어종이 모두 비어 있을 때
 * - localStorage에 "ipnak_interest_dismissed"가 없을 때
 *
 * 버튼:
 * - 저장하기: /api/user/interests POST 후 팝업 닫기
 * - 건너뛰기: 팝업만 닫기 (다음 방문 시 다시 표시)
 * - 다시보지않기: localStorage 플래그 설정 후 닫기
 */
import { useState, useEffect, useCallback } from "react";
import { X, Fish, Waves, Plus, Check } from "lucide-react";
import { useToast } from "@/components/Toast";

const FISHING_METHODS = [
  "루어낚시", "지깅낚시", "선상낚시", "좌대낚시", "찌낚시",
  "원투낚시", "플라이낚시", "에깅낚시", "타이라바낚시", "트롤링낚시",
];

const FISH_SPECIES = [
  "배스", "쏘가리", "감성돔", "돌돔", "참돔", "광어", "우럭", "농어",
  "무늬오징어", "갑오징어", "문어", "붕어", "잉어", "송어", "연어",
  "삼치", "부시리", "참치",
];

const LS_KEY = "ipnak_interest_dismissed";

function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium outline-none transition-all active:scale-[0.97] ${
        active
          ? "bg-aqua-400 text-navy-900"
          : "border border-white/[0.15] bg-white/[0.06] text-white/60 hover:border-white/30"
      }`}
    >
      {active && <Check size={11} strokeWidth={2.5} />}
      {label}
    </button>
  );
}

export function FishingInterestPopup({
  nickname,
  hasInterests,
}: {
  nickname?: string;
  hasInterests: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [methods, setMethods] = useState<string[]>([]);
  const [species, setSpecies] = useState<string[]>([]);
  const [customMethod, setCustomMethod] = useState("");
  const [customSpecies, setCustomSpecies] = useState("");
  const [extraMethods, setExtraMethods] = useState<string[]>([]);
  const [extraSpecies, setExtraSpecies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hasInterests) return;
    try {
      if (localStorage.getItem(LS_KEY)) return;
    } catch {}
    // 약간 딜레이 후 표시 (페이지 렌더 직후 팝업 방지)
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [hasInterests]);

  const toggle = useCallback(
    (list: string[], setList: (v: string[]) => void, v: string) => {
      setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    },
    []
  );

  function addCustom(val: string, extras: string[], setExtras: (v: string[]) => void, setInput: (v: string) => void) {
    const v = val.trim();
    if (!v || extras.includes(v)) return;
    setExtras([...extras, v]);
    setInput("");
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          methods: [...methods, ...extraMethods],
          species: [...species, ...extraSpecies],
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      toast("관심 분야가 저장됐어요!", "success");
      setOpen(false);
    } catch {
      toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setSaving(false);
    }
  }

  function dismiss() {
    try { localStorage.setItem(LS_KEY, "1"); } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
      {/* 딤 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* 팝업 카드 */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.1] bg-[#1a2535] shadow-2xl">

        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-white/50 hover:bg-white/[0.15] hover:text-white"
        >
          <X size={14} strokeWidth={2} />
        </button>

        {/* 헤더 */}
        <div className="bg-gradient-to-r from-[#0d1626] to-[#1e3a5f] px-6 py-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-aqua-400">맞춤 추천</p>
          <h2 className="mt-1 text-[20px] font-extrabold text-white">
            {nickname ? `${nickname}님, ` : ""}관심 낚시 분야를 알려주세요
          </h2>
          <p className="mt-1 text-[12px] text-white/50">
            AI가 관심 어종·방식에 맞는 피드를 추천해 드려요
          </p>
        </div>

        {/* 스크롤 영역 */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-5">

          {/* 낚시 방식 */}
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-white/80">
              <Waves size={14} strokeWidth={1.8} className="text-aqua-400" />
              낚시 방식 <span className="text-white/35 font-normal">(다중 선택)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FISHING_METHODS.map((m) => (
                <Chip key={m} label={m} active={methods.includes(m)} onToggle={() => toggle(methods, setMethods, m)} />
              ))}
              {extraMethods.map((m) => (
                <Chip key={m} label={m} active onToggle={() => setExtraMethods(extraMethods.filter((x) => x !== m))} />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customMethod}
                onChange={(e) => setCustomMethod(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(customMethod, extraMethods, setExtraMethods, setCustomMethod); }}}
                placeholder="기타 낚시 방식 직접 입력"
                className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:border-aqua-400/50"
              />
              <button type="button" onClick={() => addCustom(customMethod, extraMethods, setExtraMethods, setCustomMethod)} disabled={!customMethod.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-white/40 hover:text-aqua-400 disabled:opacity-30">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* 관심 어종 */}
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-white/80">
              <Fish size={14} strokeWidth={1.8} className="text-orange-400" />
              관심 어종 <span className="text-white/35 font-normal">(다중 선택)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FISH_SPECIES.map((s) => (
                <Chip key={s} label={s} active={species.includes(s)} onToggle={() => toggle(species, setSpecies, s)} />
              ))}
              {extraSpecies.map((s) => (
                <Chip key={s} label={s} active onToggle={() => setExtraSpecies(extraSpecies.filter((x) => x !== s))} />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customSpecies}
                onChange={(e) => setCustomSpecies(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(customSpecies, extraSpecies, setExtraSpecies, setCustomSpecies); }}}
                placeholder="기타 어종 직접 입력"
                className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:border-aqua-400/50"
              />
              <button type="button" onClick={() => addCustom(customSpecies, extraSpecies, setExtraSpecies, setCustomSpecies)} disabled={!customSpecies.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-white/40 hover:text-orange-400 disabled:opacity-30">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="border-t border-white/[0.08] px-6 py-4 space-y-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || (methods.length + extraMethods.length + species.length + extraSpecies.length === 0)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-aqua-400 py-3 text-[14px] font-bold text-navy-900 transition-colors hover:bg-aqua-300 disabled:opacity-40"
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-2xl border border-white/[0.1] py-2.5 text-[13px] font-medium text-white/50 hover:bg-white/[0.05]"
            >
              건너뛰기
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 rounded-2xl border border-white/[0.1] py-2.5 text-[13px] font-medium text-white/30 hover:bg-white/[0.05]"
            >
              다시보지않기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
