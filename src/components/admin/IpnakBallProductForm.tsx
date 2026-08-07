"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Pencil, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/Toast";

const MAX_IMAGES = 5;

/* imageUrl 필드는 단일 URL 문자열 또는 JSON 배열 문자열 두 형태를 모두 저장한다. */
function parseImageUrls(raw?: string | null): string[] {
  if (!raw) return [""];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [""];
  } catch {}
  return [raw];
}

function serializeImageUrls(urls: string[]): string {
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return JSON.stringify(clean);
}

/* ── 다중 이미지 입력 (URL 직접 입력 + 파일 업로드 + 미리보기) ── */
function ImageUrlsField({ urls, onChange, inputCls }: { urls: string[]; onChange: (next: string[]) => void; inputCls: string }) {
  const toast = useToast();
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function setAt(idx: number, val: string) {
    onChange(urls.map((u, i) => (i === idx ? val : u)));
  }

  function removeAt(idx: number) {
    const next = urls.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : [""]);
  }

  async function handleUpload(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIdx(idx);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      setAt(idx, data.url);
      toast("이미지가 업로드되었습니다.", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploadingIdx(null);
      const input = fileInputRefs.current[idx];
      if (input) input.value = "";
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-navy-400">
        상품 이미지 (최대 {MAX_IMAGES}장 · /로 시작하는 public 경로 또는 외부 URL)
      </span>
      <div className="space-y-2">
        {urls.map((url, idx) => (
          <div key={idx} className="rounded-lg border border-navy-100/40 bg-[#0d1b2a] p-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-[11px] font-bold text-navy-400">{idx + 1}</span>
              <input
                value={url}
                onChange={(e) => setAt(idx, e.target.value)}
                className={inputCls}
                placeholder="/ipnak-ball-product-image.png"
              />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="shrink-0 rounded-lg border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10"
                aria-label={`${idx + 1}번 이미지 삭제`}
              >
                <X size={13} />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2 pl-7">
              <input
                ref={(el) => { fileInputRefs.current[idx] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload(idx, e)}
              />
              <button
                type="button"
                disabled={uploadingIdx === idx}
                onClick={() => fileInputRefs.current[idx]?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-400 hover:border-orange-400/70 hover:text-orange-400 disabled:opacity-50"
              >
                {uploadingIdx === idx ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploadingIdx === idx ? "업로드 중..." : "파일로 업로드"}
              </button>
              {url && <img src={url} alt="미리보기" className="h-10 w-10 rounded-lg border border-navy-100 object-contain bg-[#0d1b2a]" />}
            </div>
          </div>
        ))}
      </div>
      {urls.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => onChange([...urls, ""])}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-navy-100 py-2 text-xs font-semibold text-navy-400 hover:border-orange-400/70 hover:text-orange-400"
        >
          <Plus size={13} /> 이미지 추가 ({urls.length}/{MAX_IMAGES})
        </button>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-navy-400/70">
        권장 이미지: 1:1 비율(정사각형), 최소 800×800px
        <br />
        구매 화면에서 꽉 차게 표시됩니다.
      </p>
    </div>
  );
}

/* 등록 폼 안내 문구는 상품 타입별로 다르게 보여준다(실제 입력값 아님). */
const PLACEHOLDERS = {
  ball: {
    name: "입낚볼 NFC 스마트 계측볼",
    price: "29900",
    description: "NFC 연동으로 어획 기록을 간편하게",
    optionOnePrice: "29900",
    optionTwoPrice: "49900",
    optionExample: null as string | null,
  },
  keyring: {
    name: "예) 입낚 NFC 키링",
    price: "19900",
    description: "예) NFC 태그로 낚시 기록을 간편하게 공유하는 입낚 키링입니다.",
    optionOnePrice: "19900",
    optionTwoPrice: "29900",
    optionExample: "예) 기본가 19,900원 → 옵션 미선택 시 / 1개입 선택 → 19,900원 / 2개입 선택 → 29,900원",
  },
} as const;

export function IpnakBallProductForm({ type = "ball", label = "입낚볼" }: { type?: "ball" | "keyring"; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const ph = PLACEHOLDERS[type];
  const [form, setForm] = useState({
    name: "", price: "", description: "", stock: "0", isActive: true,
    optionEnabled: false,
    optionOneLabel: "1개입", optionOnePrice: "",
    optionTwoLabel: "2개입", optionTwoPrice: "",
  });
  const [imageUrls, setImageUrls] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        type,
        name: form.name,
        price: Number(form.price),
        description: form.description,
        stock: Number(form.stock),
        imageUrl: serializeImageUrls(imageUrls),
        isActive: form.isActive,
        optionEnabled: form.optionEnabled,
      };
      if (form.optionEnabled) {
        body.optionOneLabel = form.optionOneLabel;
        body.optionOnePrice = form.optionOnePrice ? Number(form.optionOnePrice) : null;
        body.optionTwoLabel = form.optionTwoLabel;
        body.optionTwoPrice = form.optionTwoPrice ? Number(form.optionTwoPrice) : null;
      }
      const res = await fetch("/api/admin/ipnak-ball/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      toast("상품이 등록되었습니다.", "success");
      setForm({ name: "", price: "", description: "", stock: "0", isActive: true, optionEnabled: false, optionOneLabel: "1개입", optionOnePrice: "", optionTwoLabel: "2개입", optionTwoPrice: "" });
      setImageUrls([""]);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-navy-100 bg-[#0d1b2a] px-3 py-2 text-sm text-navy-800 outline-none focus:border-orange-400/70";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-navy-100 bg-[#162538] p-4 space-y-3">
      <p className="text-sm font-bold text-navy-700">{label} 새 상품 등록</p>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-navy-400">상품명 *</span>
        <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder={ph.name} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy-400">기본가 (원) *</span>
          <input required type="number" min="100" step="100" value={form.price} onChange={(e) => set("price", e.target.value)} className={inputCls} placeholder={ph.price} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy-400">재고 수량</span>
          <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-navy-400">설명 (선택)</span>
        <input value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} placeholder={ph.description} />
      </label>

      <ImageUrlsField urls={imageUrls} onChange={setImageUrls} inputCls={inputCls} />

      {/* ── 옵션 설정 ── */}
      <div className="rounded-lg border border-navy-100/40 bg-[#0d1b2a] p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.optionEnabled}
            onChange={(e) => set("optionEnabled", e.target.checked)}
            className="h-4 w-4 accent-orange-500"
          />
          <span className="text-sm font-semibold text-navy-600">옵션 사용 (개수 선택 기능)</span>
        </label>
        {form.optionEnabled && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy-400">1개입 옵션명</span>
                <input value={form.optionOneLabel} onChange={(e) => set("optionOneLabel", e.target.value)} className={inputCls} placeholder="1개입" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy-400">1개입 가격 (원)</span>
                <input type="number" min="0" step="100" value={form.optionOnePrice} onChange={(e) => set("optionOnePrice", e.target.value)} className={inputCls} placeholder={ph.optionOnePrice} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy-400">2개입 옵션명</span>
                <input value={form.optionTwoLabel} onChange={(e) => set("optionTwoLabel", e.target.value)} className={inputCls} placeholder="2개입" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy-400">2개입 가격 (원)</span>
                <input type="number" min="0" step="100" value={form.optionTwoPrice} onChange={(e) => set("optionTwoPrice", e.target.value)} className={inputCls} placeholder={ph.optionTwoPrice} />
              </label>
            </div>
            <p className="text-[11px] text-navy-400/70">* 기본가는 옵션 미선택 시 사용됩니다. 옵션 활성화 시에는 위 옵션 가격이 우선 적용됩니다.</p>
            {ph.optionExample && (
              <p className="rounded-lg bg-aqua-500/10 px-3 py-2 text-[11px] leading-relaxed text-aqua-400">{ph.optionExample}</p>
            )}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-orange-500" />
        <span className="text-sm text-navy-600">활성화 (구매 페이지에 노출)</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-gray-900 hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : null}
        상품 등록
      </button>
    </form>
  );
}

/* ── 상품 삭제 버튼 ── */
export function IpnakBallProductDelete({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ipnak-ball/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("상품을 삭제했습니다.", "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-red-400 font-semibold">삭제할까요?</span>
        <button onClick={handleDelete} disabled={loading} className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {loading ? <Loader2 size={11} className="inline animate-spin" /> : "삭제"}
        </button>
        <button onClick={() => setConfirm(false)} className="rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-semibold text-navy-400">
          취소
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirm(true)} className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10">
      <Trash2 size={12} /> 삭제
    </button>
  );
}

/* ── 상품 수정 모달 ── */
type ProductData = {
  id: string; name: string; price: number; description?: string | null;
  stock: number; imageUrl?: string | null; isActive: boolean;
  optionEnabled: boolean; optionOneLabel?: string | null; optionOnePrice?: number | null;
  optionTwoLabel?: string | null; optionTwoPrice?: number | null;
};

export function IpnakBallProductEditModal({ product }: { product: ProductData }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(() => parseImageUrls(product.imageUrl));
  const [form, setForm] = useState({
    name: product.name,
    price: String(product.price),
    description: product.description ?? "",
    stock: String(product.stock),
    isActive: product.isActive,
    optionEnabled: product.optionEnabled,
    optionOneLabel: product.optionOneLabel ?? "1개입",
    optionOnePrice: product.optionOnePrice != null ? String(product.optionOnePrice) : "",
    optionTwoLabel: product.optionTwoLabel ?? "2개입",
    optionTwoPrice: product.optionTwoPrice != null ? String(product.optionTwoPrice) : "",
  });

  function set(key: keyof typeof form, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ipnak-ball/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          name: form.name,
          price: Number(form.price),
          description: form.description,
          stock: Number(form.stock),
          imageUrl: serializeImageUrls(imageUrls),
          isActive: form.isActive,
          optionEnabled: form.optionEnabled,
          optionOneLabel: form.optionOneLabel,
          optionOnePrice: form.optionOnePrice ? Number(form.optionOnePrice) : null,
          optionTwoLabel: form.optionTwoLabel,
          optionTwoPrice: form.optionTwoPrice ? Number(form.optionTwoPrice) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정 실패");
      toast("상품이 수정되었습니다.", "success");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-navy-100 bg-[#0d1b2a] px-3 py-2 text-sm text-navy-800 outline-none focus:border-orange-400/70";

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-bold text-navy-500 hover:border-orange-400/60 hover:text-orange-400">
        <Pencil size={12} /> 수정
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 sm:items-center" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[#0d1b2a] sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-navy-100/20 bg-[#0d1b2a] px-4 py-3">
              <p className="font-bold text-navy-800">상품 수정</p>
              <button onClick={() => setOpen(false)} className="text-navy-400"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy-400">상품명 *</span>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-navy-400">기본가 (원) *</span>
                  <input required type="number" min="100" value={form.price} onChange={(e) => set("price", e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-navy-400">재고</span>
                  <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className={inputCls} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy-400">설명</span>
                <input value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} />
              </label>
              <ImageUrlsField urls={imageUrls} onChange={setImageUrls} inputCls={inputCls} />
              <div className="rounded-lg border border-navy-100/40 bg-[#162538] p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.optionEnabled} onChange={(e) => set("optionEnabled", e.target.checked)} className="h-4 w-4 accent-orange-500" />
                  <span className="text-sm font-semibold text-navy-600">옵션 사용</span>
                </label>
                {form.optionEnabled && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block"><span className="mb-1 block text-xs font-semibold text-navy-400">1개입 옵션명</span><input value={form.optionOneLabel} onChange={(e) => set("optionOneLabel", e.target.value)} className={inputCls} /></label>
                      <label className="block"><span className="mb-1 block text-xs font-semibold text-navy-400">1개입 가격</span><input type="number" min="0" value={form.optionOnePrice} onChange={(e) => set("optionOnePrice", e.target.value)} className={inputCls} /></label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block"><span className="mb-1 block text-xs font-semibold text-navy-400">2개입 옵션명</span><input value={form.optionTwoLabel} onChange={(e) => set("optionTwoLabel", e.target.value)} className={inputCls} /></label>
                      <label className="block"><span className="mb-1 block text-xs font-semibold text-navy-400">2개입 가격</span><input type="number" min="0" value={form.optionTwoPrice} onChange={(e) => set("optionTwoPrice", e.target.value)} className={inputCls} /></label>
                    </div>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-orange-500" />
                <span className="text-sm text-navy-600">활성화</span>
              </label>
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-gray-900 hover:bg-orange-600 disabled:opacity-50">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />} 수정 저장
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function IpnakBallProductToggle({ id, isActive, stock }: { id: string; isActive: boolean; stock: number }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ipnak-ball/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(isActive ? "비활성화했습니다." : "활성화했습니다.", "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${isActive ? "bg-green-500/15 text-green-400" : "bg-navy-50 text-navy-400"} disabled:opacity-50`}
    >
      {loading ? <Loader2 size={12} className="inline animate-spin" /> : isActive ? "판매중" : "비활성"}
    </button>
  );
}
