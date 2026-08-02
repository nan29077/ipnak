"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** 해시태그 검색어 정규화 — 사용자가 실수로 # 를 입력해도 무시하고 소문자로 맞춘다 */
export function normalizeTagQuery(q: string) {
  return q.trim().replace(/^#+/, "").trim().toLowerCase();
}

/** 해시태그 배열에 검색어가 포함되는지 (부분 일치, 대소문자 무시) — 검색어가 비면 항상 true */
export function matchesHashtag(hashtags: string[] | null | undefined, q: string) {
  const key = normalizeTagQuery(q);
  if (!key) return true;
  return (hashtags ?? []).some((tag) => tag.toLowerCase().includes(key));
}

/** 일반 텍스트 검색어 정규화 */
export function normalizeTextQuery(q: string) {
  return q.trim().toLowerCase();
}

/**
 * 항상 펼쳐져 있는 해시태그 검색창 — # 는 입력창 내부 prefix 로만 표시한다.
 * 피싱 피드 / 일상 피드처럼 가로 공간이 있는 화면에서 사용.
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
        // min-w-0 필수 — 없으면 input 의 기본 고유 너비가 flex 자동 최소 크기가 되어 옆의 토글을 밀어낸다
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

/**
 * 아이콘 확장형 검색창 (A안) — 평소엔 돋보기 버튼만, 클릭하면 왼쪽으로 입력창이 펼쳐진다.
 * 입력창은 absolute 로 띄우므로 옆의 리스트/카드 토글 버튼이 밀리지 않는다.
 * ESC 또는 바깥 클릭 시 닫히면서 입력 내용을 초기화한다.
 */
export function ExpandableSearch({
  value,
  onChange,
  hashPrefix = true,
  placeholder = "해시태그",
  label = "해시태그 검색",
}: {
  value: string;
  onChange: (v: string) => void;
  hashPrefix?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    onChange("");
  }, [onChange]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative h-8 w-8 shrink-0">
      <div
        className={cn(
          "absolute right-0 top-1/2 z-20 flex -translate-y-1/2 items-center overflow-hidden rounded-xl border transition-all duration-200",
          // max-w-[45vw] — 좁은 화면(320px)에서 펼친 입력창이 화면 왼쪽 밖으로 나가지 않게 제한
          open ? "w-[190px] max-w-[45vw] border-white/10 bg-[#162538]" : "w-8 border-transparent bg-transparent"
        )}
      >
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-label={open ? "검색 닫기" : label}
          aria-expanded={open}
          className={cn(
            "flex h-8 shrink-0 items-center justify-center text-navy-400 transition-colors hover:text-navy-800",
            open ? "w-7" : "w-8"
          )}
        >
          <Search size={16} strokeWidth={1.8} />
        </button>
        {hashPrefix && (
          <span aria-hidden className={cn("shrink-0 text-[13px] font-bold text-aqua-400", !open && "hidden")}>#</span>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-1.5 py-1.5 text-[13px] text-navy-800 outline-none placeholder:text-navy-400/70",
            !open && "pointer-events-none"
          )}
        />
        {open && value !== "" && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="검색어 지우기"
            className="mr-1.5 shrink-0 rounded-full p-0.5 text-navy-400 transition-colors hover:text-navy-800"
          >
            <X size={13} />
          </button>
        )}
      </div>
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
        // min-w-0 필수 — 없으면 input 의 기본 고유 너비가 flex 자동 최소 크기가 되어 옆의 토글을 밀어낸다
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
