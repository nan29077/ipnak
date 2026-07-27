"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/Toast";

export function IpnakBallProductForm() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: "", price: "", description: "", stock: "0", imageUrl: "", isActive: true,
    optionEnabled: false,
    optionOneLabel: "1개입", optionOnePrice: "",
    optionTwoLabel: "2개입", optionTwoPrice: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set(key: keyof typeof form, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        price: Number(form.price),
        description: form.description,
        stock: Number(form.stock),
        imageUrl: form.imageUrl,
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
      setForm({ name: "", price: "", description: "", stock: "0", imageUrl: "", isActive: true, optionEnabled: false, optionOneLabel: "1개입", optionOnePrice: "", optionTwoLabel: "2개입", optionTwoPrice: "" });
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      set("imageUrl", data.url);
      toast("이미지가 업로드되었습니다.", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const inputCls = "w-full rounded-lg border border-navy-100 bg-[#0d1b2a] px-3 py-2 text-sm text-navy-800 outline-none focus:border-orange-400/70";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-navy-100 bg-[#162538] p-4 space-y-3">
      <p className="text-sm font-bold text-navy-700">새 상품 등록</p>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-navy-400">상품명 *</span>
        <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="입낚볼 NFC 스마트 계측볼" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy-400">기본가 (원) *</span>
          <input required type="number" min="100" step="100" value={form.price} onChange={(e) => set("price", e.target.value)} className={inputCls} placeholder="29900" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy-400">재고 수량</span>
          <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-navy-400">설명 (선택)</span>
        <input value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} placeholder="NFC 연동으로 어획 기록을 간편하게" />
      </label>

      <div>
        <span className="mb-1 block text-xs font-semibold text-navy-400">이미지 URL (선택 · /로 시작하는 public 경로 또는 외부 URL)</span>
        <input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} className={inputCls} placeholder="/ipnak-ball-product-image.png" />
        <div className="mt-1.5 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-400 hover:border-orange-400/70 hover:text-orange-400 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? "업로드 중..." : "파일로 업로드"}
          </button>
          {form.imageUrl && (
            <img src={form.imageUrl} alt="미리보기" className="h-10 w-10 rounded-lg border border-navy-100 object-cover" />
          )}
        </div>
      </div>

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
                <input type="number" min="0" step="100" value={form.optionOnePrice} onChange={(e) => set("optionOnePrice", e.target.value)} className={inputCls} placeholder="29900" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy-400">2개입 옵션명</span>
                <input value={form.optionTwoLabel} onChange={(e) => set("optionTwoLabel", e.target.value)} className={inputCls} placeholder="2개입" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy-400">2개입 가격 (원)</span>
                <input type="number" min="0" step="100" value={form.optionTwoPrice} onChange={(e) => set("optionTwoPrice", e.target.value)} className={inputCls} placeholder="49900" />
              </label>
            </div>
            <p className="text-[11px] text-navy-400/70">* 기본가는 옵션 미선택 시 사용됩니다. 옵션 활성화 시에는 위 옵션 가격이 우선 적용됩니다.</p>
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
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : null}
        상품 등록
      </button>
    </form>
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
