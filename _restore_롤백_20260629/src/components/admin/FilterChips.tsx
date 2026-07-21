"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Chip = { value: string; label: string };

export function FilterChips({ chips, param, defaultValue = "" }: { chips: Chip[]; param: string; defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param) ?? defaultValue;

  function select(v: string) {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(param, v); else sp.delete(param);
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const on = current === c.value;
        return (
          <button key={c.value} onClick={() => select(c.value)}
            className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors btn-press",
              on ? "bg-orange-500 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100")}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
