"use client";
/**
 * 어종 자동 인식 섹션 (AI 계측 결과 화면)
 * - 계측에 사용한 사진을 /api/ai/identify-species 로 보내 어종을 추정한다.
 * - 사용자가 결과를 수정할 수 있고, "이 어종으로 저장"으로 확정한다.
 * - OpenAI 키가 없거나 인식에 실패해도 기존 어종 칩 선택 흐름은 그대로 쓸 수 있다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Fish, Loader2, Pencil, RefreshCcw, Sparkles, X } from "lucide-react";

const IDENTIFY_TIMEOUT_MS = 15000; // 하드 타임아웃 — 무한 로딩 방지

type Confidence = "high" | "medium" | "low";
type Status = "loading" | "done" | "failed" | "no-key";

const CONFIDENCE_STYLE: Record<Confidence, { label: string; className: string }> = {
  high: { label: "확신도 높음", className: "bg-green-500/15 text-green-500" },
  medium: { label: "확신도 보통", className: "bg-amber-400/15 text-amber-500" },
  low: { label: "확신도 낮음", className: "bg-navy-100 text-navy-400" },
};

// 재시도해도 결과가 달라지지 않는 실패 — 안내 문구를 따로 주고 '다시 시도' 버튼을 숨긴다.
const FAIL_MESSAGE: Record<string, string> = {
  "rate-limited": "자동 인식 횟수를 초과했어요. 잠시 후 다시 시도해 주세요.",
  unauthorized: "로그인 후 이용할 수 있어요. 아래에서 어종을 직접 선택해 주세요.",
  "image-too-large": "사진이 너무 커서 인식할 수 없어요. 아래에서 직접 선택해 주세요.",
};
const NO_RETRY_REASONS = ["rate-limited", "unauthorized", "image-too-large", "no-image"];

type Props = {
  /** 계측에 사용한 사진 (data URL 또는 http URL). null 이면 인식하지 않는다. */
  imageUrl: string | null;
  /** 현재 선택된 어종 — "이 어종으로 저장" 이후 상태 표시에 사용 */
  currentSpecies: string;
  /** 사용자가 어종을 확정했을 때 호출 */
  onApply: (species: string) => void;
};

export function SpeciesIdentifySection({ imageUrl, currentSpecies, onApply }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [species, setSpecies] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("low");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [failReason, setFailReason] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const identify = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), IDENTIFY_TIMEOUT_MS);
    // 이 요청이 아직 최신인지 — 뒤늦게 끝난 이전 요청(중단 포함)이
    // 새로 시작한 요청의 'loading' 상태를 'failed' 로 덮어쓰지 않도록 막는다.
    const isCurrent = () => abortRef.current === controller;

    setStatus("loading");
    setFailReason(null);
    setEditing(false);
    try {
      const res = await fetch("/api/ai/identify-species", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!isCurrent()) return;

      if (data?.reason === "no-ai-key") { setStatus("no-key"); return; }
      if (!data?.ok || typeof data.species !== "string" || !data.species) {
        setFailReason(typeof data?.reason === "string" ? data.reason : null);
        setStatus("failed");
        return;
      }
      setSpecies(data.species);
      setConfidence(
        data.confidence === "high" || data.confidence === "medium" ? data.confidence : "low",
      );
      setStatus("done");
    } catch {
      if (isCurrent()) setStatus("failed");
    } finally {
      clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    // 사진이 없으면 인식할 수 없다 — 초기값인 'loading' 을 유지하면 스피너가 영원히 돈다.
    if (!imageUrl) {
      setFailReason("no-image");
      setStatus("failed");
      return;
    }
    void identify(imageUrl);
  }, [imageUrl, identify]);

  // 언마운트 시 진행 중인 요청 정리
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(species === "불명" ? "" : species);
    setEditing(true);
  }

  function commitEdit() {
    const next = draft.trim().slice(0, 20);
    if (next) setSpecies(next);
    setEditing(false);
  }

  const applied = status === "done" && species.length > 0 && currentSpecies === species;
  const badge = CONFIDENCE_STYLE[confidence];
  // 모델이 식별에 실패해 '불명' 을 준 경우 — 그대로 저장하면 어종이 '불명' 으로 기록된다.
  const unknownSpecies = species === "불명";
  const failText =
    (failReason && FAIL_MESSAGE[failReason]) || "어종을 인식하지 못했어요. 직접 선택해 주세요.";
  const canRetry = !!imageUrl && !NO_RETRY_REASONS.includes(failReason ?? "");

  return (
    <div className="rounded-card border border-navy-100 bg-surface-200 p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aqua-500/15 text-aqua-500">
          <Sparkles size={15} strokeWidth={1.8} />
        </span>
        <p className="text-[13px] font-bold text-navy-900">어종 자동 인식</p>
        {status === "done" && (
          <button
            type="button"
            onClick={() => imageUrl && identify(imageUrl)}
            className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-navy-400 transition-colors hover:text-navy-600"
          >
            <RefreshCcw size={12} strokeWidth={2} />
            다시 인식
          </button>
        )}
      </div>

      {/* ── 인식 중 ── */}
      {status === "loading" && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-navy-50/60 px-3 py-3">
          <Loader2 size={16} className="shrink-0 animate-spin text-aqua-500" />
          <p className="text-[13px] font-medium text-navy-500">어종을 분석 중이에요...</p>
        </div>
      )}

      {/* ── AI 키 미설정 ── */}
      {status === "no-key" && (
        <p className="mt-3 rounded-xl bg-navy-50/60 px-3 py-3 text-[12px] leading-relaxed text-navy-400">
          관리자가 AI 키를 등록하면 자동 인식됩니다. 아래에서 어종을 직접 선택해 주세요.
        </p>
      )}

      {/* ── 인식 실패 ── */}
      {status === "failed" && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-navy-50/60 px-3 py-3">
          <p className="text-[12px] text-navy-400">{failText}</p>
          {canRetry && (
            <button
              type="button"
              onClick={() => imageUrl && identify(imageUrl)}
              className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-semibold text-aqua-500 transition-colors hover:text-aqua-600"
            >
              <RefreshCcw size={12} strokeWidth={2} />
              다시 시도
            </button>
          )}
        </div>
      )}

      {/* ── 인식 완료 ── */}
      {status === "done" && (
        <div className="mt-3 space-y-2.5">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                  if (e.key === "Escape") setEditing(false);
                }}
                maxLength={20}
                placeholder="어종명을 입력하세요"
                className="min-w-0 flex-1 rounded-xl border border-navy-200 bg-navy-50 px-3 py-2.5 text-[14px] font-semibold text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-aqua-400"
              />
              <button
                type="button"
                onClick={commitEdit}
                aria-label="어종명 확인"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aqua-500 text-white transition-colors hover:bg-aqua-600 active:scale-[0.95]"
              >
                <Check size={16} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="수정 취소"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-navy-200 text-navy-400 transition-colors hover:text-navy-600 active:scale-[0.95]"
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="flex w-full items-center gap-2.5 rounded-xl bg-navy-50/60 px-3 py-2.5 text-left transition-colors hover:bg-navy-100/60 active:scale-[0.99]"
            >
              <Fish size={16} strokeWidth={1.9} className="shrink-0 text-navy-400" />
              <span className="text-[15px] font-bold text-navy-900">{species}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${badge.className}`}>
                {badge.label}
              </span>
              <Pencil size={13} strokeWidth={1.9} className="ml-auto shrink-0 text-navy-300" />
            </button>
          )}

          {!editing && (
            unknownSpecies ? (
              <p className="rounded-xl bg-navy-50/60 px-3 py-2.5 text-[12px] leading-relaxed text-navy-400">
                사진만으로는 어종을 알기 어려워요. 위를 탭해 직접 입력하거나 아래에서 선택해 주세요.
              </p>
            ) : applied ? (
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-aqua-500/10 py-2.5 text-[12.5px] font-bold text-aqua-500">
                <Check size={14} strokeWidth={2.4} />
                {species}(으)로 지정했어요
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onApply(species)}
                className="w-full rounded-xl bg-orange-500 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-orange-600 active:scale-[0.98]"
              >
                이 어종으로 저장
              </button>
            )
          )}

          {!unknownSpecies && (
            <p className="text-[11px] text-navy-400">
              AI 추정값이에요. 다르면 탭해서 수정하거나 아래에서 직접 선택하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
