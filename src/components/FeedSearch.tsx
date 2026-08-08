"use client";
import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** 해시태그 검색어 정규화 — 사용자가 실수로 # 를 입력해도 무시하고 소문자로 맞춘다 */
export function normalizeTagQuery(q: string) {
  return q.trim().replace(/^#+/, "").trim().toLowerCase();
}

/** 일반 텍스트 검색어 정규화 */
export function normalizeTextQuery(q: string) {
  return q.trim().toLowerCase();
}

/**
 * 입력이 멈춘 뒤 delay(ms) 가 지나야 값이 갱신되는 디바운스 값.
 * 검색은 서버 요청이므로 타이핑 한 글자마다 요청이 나가지 않게 막는다.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** 서버 검색 응답을 기다리는 동안 보여줄 로딩 표시 — 빈 결과 문구가 깜빡이는 것을 막는다 */
export function SearchLoading() {
  return (
    <div className="flex justify-center py-14" role="status" aria-live="polite">
      <Loader2 size={20} strokeWidth={1.8} className="animate-spin text-aqua-400" />
      <span className="sr-only">검색 중</span>
    </div>
  );
}

/**
 * 항상 펼쳐져 있는 해시태그 검색창 — # 는 입력창 내부 prefix 로만 표시하고
 * 사용자는 키워드만 입력한다. 피드 / 워킹 피드 / 조행기에서 공통으로 사용.
 */
export function HashtagSearchInput({
  value,
  onChange,
  className,
  placeholder = "해시태그 검색",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div
      className={cn(
        // min-w-0 필수 — 없으면 input 의 기본 고유 너비가 flex 자동 최소 크기가 되어 옆 요소를 밀어낸다
        "flex min-w-0 items-center gap-1 rounded-xl border border-white/10 bg-[#162538] px-2.5 transition-colors focus-within:border-aqua-400/60",
        className
      )}
    >
      <span aria-hidden className="shrink-0 text-[13px] font-bold text-aqua-400">#</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="해시태그 검색"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] text-navy-800 outline-none placeholder:text-navy-400/70"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className="shrink-0 rounded-full p-0.5 text-navy-400 transition-colors hover:text-navy-800"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/** 항상 펼쳐져 있는 일반 텍스트 검색창 — 돋보기 아이콘을 prefix 로 표시한다. */
export function TextSearchInput({
  value,
  onChange,
  className,
  placeholder = "검색",
  label = "검색",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        // min-w-0 필수 — 없으면 input 의 기본 고유 너비가 flex 자동 최소 크기가 되어 옆 요소를 밀어낸다
        "flex h-9 min-w-0 items-center gap-1.5 rounded-xl border border-white/10 bg-[#122030] px-2.5 transition-colors focus-within:border-orange-400/70",
        className
      )}
    >
      <Search size={14} strokeWidth={1.8} className="shrink-0 text-aqua-400" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-navy-800 outline-none placeholder:text-navy-400/70"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className="shrink-0 rounded-full p-0.5 text-navy-400 transition-colors hover:text-navy-800"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
