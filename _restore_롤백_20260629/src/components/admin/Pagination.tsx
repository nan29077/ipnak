"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, totalPages, total }: { page: number; totalPages: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(p: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set("page", String(p));
    router.push(`${pathname}?${sp.toString()}`);
  }

  if (totalPages <= 1) {
    return <div className="mt-3 text-center text-[12px] text-navy-400">총 {total.toLocaleString()}건</div>;
  }

  // 현재 페이지 주변 최대 5개 표시
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const nums = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i).filter((n) => n <= totalPages);

  return (
    <div className="mt-4 flex items-center justify-center gap-1.5">
      <button onClick={() => go(page - 1)} disabled={page <= 1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-500 transition-colors hover:bg-navy-100 disabled:opacity-40">
        <ChevronLeft size={16} />
      </button>
      {nums.map((n) => (
        <button key={n} onClick={() => go(n)}
          className={cn("inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-semibold transition-colors",
            n === page ? "bg-orange-500 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100")}>
          {n}
        </button>
      ))}
      <button onClick={() => go(page + 1)} disabled={page >= totalPages}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-500 transition-colors hover:bg-navy-100 disabled:opacity-40">
        <ChevronRight size={16} />
      </button>
      <span className="ml-2 text-[12px] text-navy-400">{page} / {totalPages} · 총 {total.toLocaleString()}건</span>
    </div>
  );
}
