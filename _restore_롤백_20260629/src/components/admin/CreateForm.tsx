"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button, Input, Select } from "@/components/ui";

type Field = { name: string; label: string; type?: "text" | "number" | "date" | "select"; options?: { value: string; label: string }[]; required?: boolean };

export function CreateForm({ actionType, title, fields, fixed }: {
  actionType: string; title: string; fields: Field[]; fixed?: Record<string, any>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  async function submit() {
    for (const f of fields) if (f.required && !values[f.name]) { toast(`${f.label}을(를) 입력하세요`, "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: actionType, ...fixed, ...values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("등록되었습니다", "success");
      setValues({}); setOpen(false); router.refresh();
    } catch (e: any) { toast(e.message, "error"); } finally { setLoading(false); }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" leftIcon={<Plus size={16} />}>
        {title}
      </Button>
    );
  }

  return (
    <div className="card animate-scalein p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-navy-800">{title}</h3>
        <button onClick={() => setOpen(false)} aria-label="닫기" className="rounded-full p-1 text-navy-400 transition-colors hover:bg-navy-50"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.name} className={f.type === "select" ? "col-span-2 sm:col-span-1" : ""}>
            <label className="mb-1 block text-xs font-semibold text-navy-500">{f.label}</label>
            {f.type === "select" ? (
              <Select value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                <option value="">선택</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            ) : (
              <Input type={f.type || "text"} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      <Button onClick={submit} disabled={loading} size="sm" className="mt-3" leftIcon={loading ? <Loader2 size={14} className="animate-spin" /> : undefined}>
        등록
      </Button>
    </div>
  );
}
