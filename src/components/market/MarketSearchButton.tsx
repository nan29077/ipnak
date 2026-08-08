"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function MarketSearchButton() {
  const pathname = usePathname() || "/market";
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState(currentQuery);

  useEffect(() => {
    setDraft(currentQuery);
  }, [currentQuery]);

  function updateQuery(query: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set("q", query);
    else params.delete("q");

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateQuery(draft.trim());
  }

  function clearSearch() {
    setDraft("");
    updateQuery("");
  }

  return (
    <form
      onSubmit={applySearch}
      role="search"
      className="flex min-w-0 flex-1 items-center rounded-xl border border-white/10 bg-[#122030] transition-colors focus-within:border-orange-400/70 focus-within:ring-2 focus-within:ring-orange-400/10"
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="중고마켓 검색"
        aria-label="중고마켓 검색어"
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-navy-800 outline-none placeholder:text-navy-300"
      />
      {draft && (
        <button
          type="button"
          onClick={clearSearch}
          aria-label="검색어 지우기"
          className="shrink-0 rounded-full p-1 text-navy-300 hover:text-white"
        >
          <X size={14} />
        </button>
      )}
      <button
        type="submit"
        aria-label="중고마켓 찾기"
        className="m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-gray-900 shadow-soft transition-colors hover:bg-orange-400 active:scale-95"
      >
        <Search size={17} strokeWidth={2.2} />
      </button>
    </form>
  );
}
