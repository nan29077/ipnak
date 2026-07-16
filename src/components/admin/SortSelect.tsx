"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Option = { value: string; label: string };

export function SortSelect({ options, param = "sort", defaultValue }: { options: Option[]; param?: string; defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param) ?? defaultValue ?? options[0]?.value;

  function change(v: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set(param, v);
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      aria-label="정렬"
      className="field w-auto appearance-none py-2 pr-8 text-sm"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
