"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, ImagePlus, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

// half: singleColumn 모드에서만 의미가 있다 — 나란히 두는 게 편한 짝(시작일/종료일)용
type Field = { name: string; label: string; type?: "text" | "number" | "date" | "select" | "image"; options?: { value: string; label: string }[]; required?: boolean; placeholder?: string; uploadUrl?: string; half?: boolean };

export function CreateForm({ actionType, title, fields, fixed, singleColumn }: {
  actionType: string; title: string; fields: Field[]; fixed?: Record<string, any>; singleColumn?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function uploadImage(f: Field, file: File) {
    setUploading(f.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(f.uploadUrl || "/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      setValues((v) => ({ ...v, [f.name]: data.url }));
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(null);
      // 같은 파일을 다시 골라도 change 가 발생하도록 초기화
      const input = fileInputs.current[f.name];
      if (input) input.value = "";
    }
  }

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
    // overflow-x-hidden: overflow-y-auto 만 주면 overflow-x 가 auto 로 계산돼 모바일에서 좌우로도 끌린다
    <div className={cn("card animate-scalein", singleColumn ? "max-h-[90vh] overflow-y-auto overflow-x-hidden p-5" : "p-4")}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-navy-800">{title}</h3>
        <button onClick={() => setOpen(false)} aria-label="닫기" className="rounded-full p-1 text-navy-400 transition-colors hover:bg-navy-50"><X size={18} /></button>
      </div>
      <div className={cn("grid grid-cols-2", singleColumn ? "gap-4" : "gap-3")}>
        {fields.map((f) => (
          // min-w-0: 그리드 아이템 기본값(min-width:auto) 탓에 date/select 의 고유 너비만큼 칸이 벌어져 가로로 넘친다
          <div key={f.name} className={cn("min-w-0",
            singleColumn
              ? (f.half ? "col-span-1" : "col-span-2")
              : f.type === "image" ? "col-span-2" : f.type === "select" ? "col-span-2 sm:col-span-1" : ""
          )}>
            <label className={cn("mb-1 block font-semibold text-navy-500", singleColumn ? "text-[13px]" : "text-xs")}>{f.label}</label>
            {f.type === "image" ? (
              <div>
                <input
                  ref={(el) => { fileInputs.current[f.name] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(f, file); }}
                />
                {values[f.name] ? (
                  // 카드와 같은 16:7 비율로 미리보기
                  <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl border border-navy-100 bg-navy-50">
                    {/* base64 data URI 라 next/image 최적화 대상이 아니다 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={values[f.name]} alt="배너 미리보기" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setValues((v) => ({ ...v, [f.name]: "" }))}
                      aria-label="이미지 삭제"
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploading === f.name}
                    onClick={() => fileInputs.current[f.name]?.click()}
                    className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-navy-200 text-navy-400 transition-colors hover:border-aqua-400 hover:text-aqua-400 disabled:opacity-50"
                  >
                    {uploading === f.name
                      ? <Loader2 size={22} strokeWidth={1.7} className="animate-spin" />
                      : <ImagePlus size={22} strokeWidth={1.7} />}
                    <span className="text-[12px] font-semibold">
                      {uploading === f.name ? "업로드 중..." : "이미지 선택 (선택사항)"}
                    </span>
                    <span className="text-[11px] text-navy-300">jpg · png · webp · gif / 최대 5MB</span>
                  </button>
                )}
              </div>
            ) : f.type === "select" ? (
              <Select className={cn(singleColumn && "px-4 py-3")} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                <option value="">선택</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            ) : (
              <Input className={cn(singleColumn && "px-4 py-3")} type={f.type || "text"} placeholder={f.placeholder} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      <Button
        onClick={submit}
        disabled={loading || !!uploading}
        size={singleColumn ? "md" : "sm"}
        full={singleColumn}
        className={singleColumn ? "mt-5 py-3" : "mt-3"}
        leftIcon={loading ? <Loader2 size={singleColumn ? 16 : 14} className="animate-spin" /> : undefined}
      >
        등록
      </Button>
    </div>
  );
}
