"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, X, ChevronLeft, ChevronRight, ImagePlus,
  Tag, DollarSign, FileText, Check, ShoppingBag,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { PRODUCT_CATEGORIES } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

type OptionRow = { name: string; values: string };

const STEPS = [
  { label: "사진", icon: ImagePlus },
  { label: "기본 정보", icon: Tag },
  { label: "가격", icon: DollarSign },
  { label: "설명 & 옵션", icon: FileText },
];

const inputCls =
  "w-full rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-white outline-none focus:border-orange-400 placeholder:text-white/25 transition-colors";

export function ProductCreateForm({ shopTagEnabled }: { shopTagEnabled: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Step 1: 사진
  const [imageUrl, setImageUrl] = useState("");
  const [extraImages, setExtraImages] = useState<string[]>([]);

  // Step 2: 기본 정보
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]?.key ?? "ETC");

  // Step 3: 가격
  const [price, setPrice] = useState("");
  const [shippingFee, setShippingFee] = useState("0");
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("");
  const [feeRate, setFeeRate] = useState("10");
  const [stock, setStock] = useState("0");

  // Step 4: 설명 & 옵션
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<OptionRow[]>([]);

  function resetForm() {
    setStep(0);
    setImageUrl(""); setExtraImages([]);
    setName(""); setBrand(""); setCategory(PRODUCT_CATEGORIES[0]?.key ?? "ETC");
    setPrice(""); setShippingFee("0"); setFreeShippingEnabled(false); setFreeShippingThreshold(""); setFeeRate("10"); setStock("0");
    setDescription(""); setOptions([]);
  }

  function openModal() { setOpen(true); setStep(0); }
  function closeModal() { setOpen(false); resetForm(); }

  // ─── 이미지 업로드 ───
  // API는 { url: string } 반환 (data.url)
  async function uploadImage(file: File, slot: string): Promise<string | null> {
    setUploading(slot);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      // API returns { url: "/uploads/..." }
      console.log("[upload] response:", data);
      const resultUrl = data.url ?? data.imageUrl;
      if (!resultUrl) throw new Error("서버에서 URL을 반환하지 않았습니다");
      return resultUrl as string;
    } catch (err: any) {
      toast(err.message, "error");
      return null;
    } finally {
      setUploading(null);
    }
  }

  async function handleThumbUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "thumb");
    if (url) setImageUrl(url);
    e.target.value = "";
  }

  async function handleExtraUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i], `extra-${i}`);
      if (url) setExtraImages((prev) => [...prev, url]);
    }
    e.target.value = "";
  }

  function removeExtra(idx: number) {
    setExtraImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function addOption() {
    setOptions((prev) => [...prev, { name: "", values: "" }]);
  }
  function updateOption(idx: number, field: keyof OptionRow, val: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: val } : o)));
  }
  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function canNext(): boolean {
    if (step === 0) return true;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return price.trim().length > 0 && Number(price) > 0;
    return true;
  }

  async function handleSubmit() {
    if (!name.trim()) { toast("상품명을 입력해 주세요", "error"); return; }
    if (!price || Number(price) <= 0) { toast("가격을 입력해 주세요", "error"); return; }
    setSubmitting(true);
    try {
      const optionList = options
        .filter((o) => o.name.trim())
        .map((o) => ({
          name: o.name.trim(),
          values: o.values.split(",").map((v) => v.trim()).filter(Boolean),
        }));

      const optionsPayload =
        optionList.length > 0 || extraImages.length > 0
          ? JSON.stringify({ options: optionList, extraImages })
          : undefined;

      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PRODUCT_CREATE",
          name: name.trim(),
          brand: brand.trim() || undefined,
          category,
          price: Number(price),
          shippingFee: Number(shippingFee) || 0,
          freeShippingThreshold: freeShippingEnabled && Number(freeShippingThreshold) > 0 ? Number(freeShippingThreshold) : 0,
          options: optionsPayload,
          imageUrl: imageUrl || undefined,
          buyUrl: "#",
          description: description.trim() || undefined,
          feeRate: shopTagEnabled ? (Number(feeRate) || 10) : 0,
          stock: Number(stock) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      toast("상품이 등록되었습니다", "success");
      closeModal();
      router.refresh();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── 모달 콘텐츠 (공통) ───
  const modalContent = (
    <>
      {/* 상단 헤더 */}
      <div className="h-[3px] w-full shrink-0 bg-gradient-to-r from-orange-700/40 via-orange-400 to-orange-700/40" />
      {/* 모바일 드래그 핸들 */}
      <div className="flex shrink-0 justify-center pt-2 md:hidden">
        <div className="h-1 w-10 rounded-full bg-white/20" />
      </div>
      <div className="flex shrink-0 items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-orange-500/15 ring-1 ring-orange-500/25">
            <ShoppingBag size={17} className="text-orange-400" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">상품 등록</p>
            <p className="text-[11px] text-white/35">단계 {step + 1} / {STEPS.length}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeModal}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.08] hover:text-white/70"
        >
          <X size={18} />
        </button>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex shrink-0 items-center gap-0 px-5 pb-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all",
                  done ? "bg-orange-500 text-gray-900" :
                  active ? "bg-orange-500/20 ring-2 ring-orange-500 text-orange-400" :
                  "bg-white/[0.06] text-white/25"
                )}>
                  {done ? <Check size={14} strokeWidth={2.5} /> : <Icon size={13} strokeWidth={1.8} />}
                </div>
                <span className={cn(
                  "text-[9px] font-semibold whitespace-nowrap",
                  active ? "text-orange-400" : done ? "text-white/60" : "text-white/20"
                )}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "mx-1 mb-4 h-[2px] flex-1 rounded-full transition-all",
                  done ? "bg-orange-500" : "bg-white/[0.08]"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* 본문 — overscroll-contain으로 모바일 흔들림 방지 */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
        {/* ─── Step 1: 사진 ─── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[12px] font-semibold text-white/50">대표(썸네일) 사진</p>
              <label className="block cursor-pointer">
                {imageUrl ? (
                  <div className="relative">
                    <img src={imageUrl} alt="" className="h-44 w-full rounded-2xl object-cover ring-2 ring-orange-500/50" />
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setImageUrl(""); }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
                    >
                      <X size={13} />
                    </button>
                    <span className="absolute bottom-2 right-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-gray-900">대표</span>
                  </div>
                ) : (
                  <div className={cn(
                    "flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/[0.12] bg-white/[0.03] transition-colors hover:border-orange-400/60 hover:bg-orange-500/5",
                    uploading === "thumb" && "pointer-events-none opacity-60"
                  )}>
                    {uploading === "thumb" ? (
                      <Loader2 size={24} className="animate-spin text-orange-400" />
                    ) : (
                      <>
                        <ImagePlus size={28} strokeWidth={1.4} className="text-white/25" />
                        <p className="text-[12px] font-semibold text-white/35">터치하여 대표 사진 업로드</p>
                        <p className="text-[10px] text-white/20">JPG, PNG, WEBP 지원</p>
                      </>
                    )}
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} disabled={!!uploading} />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-white/50">추가 사진 <span className="text-white/25">({extraImages.length}장)</span></p>
                <label className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-orange-400 hover:bg-orange-500/10",
                  !!uploading && "pointer-events-none opacity-50"
                )}>
                  <Plus size={12} /> 사진 추가
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleExtraUpload} disabled={!!uploading} />
                </label>
              </div>

              {extraImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {extraImages.map((url, idx) => (
                    <div key={idx} className="relative aspect-square overflow-hidden rounded-xl">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeExtra(idx)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {uploading?.startsWith("extra") && (
                    <div className="flex aspect-square items-center justify-center rounded-xl bg-white/[0.05]">
                      <Loader2 size={18} className="animate-spin text-orange-400" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-[12px] text-white/20">
                  추가 사진이 없습니다
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 2: 기본 정보 ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-white/50">상품명 <span className="text-orange-400">*</span></label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="상품명을 입력하세요"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-white/50">브랜드</label>
              <input
                className={inputCls}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="브랜드명 (선택)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-white/50">카테고리</label>
              <select
                className={cn(inputCls, "appearance-none")}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ─── Step 3: 가격 ─── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-white/50">
                가격 (원) <span className="text-orange-400">*</span>
              </label>
              <input
                type="number"
                className={inputCls}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                min={1}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-white/50">배송비 (원)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className={cn(inputCls, "flex-1")}
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  placeholder="0"
                  min={0}
                />
                {Number(shippingFee) === 0 && (
                  <span className="shrink-0 rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-bold text-green-400">무료</span>
                )}
              </div>
              {/* 조건부 무료배송 */}
              {Number(shippingFee) > 0 && (
                <div className="mt-2.5 space-y-2">
                  <label className="flex cursor-pointer select-none items-center gap-2">
                    <input
                      type="checkbox"
                      checked={freeShippingEnabled}
                      onChange={(e) => setFreeShippingEnabled(e.target.checked)}
                      className="h-4 w-4 accent-orange-500"
                    />
                    <span className="text-[13px] font-semibold text-white/70">일정 금액 이상 무료배송</span>
                  </label>
                  {freeShippingEnabled && (
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-white/50">얼마 이상 주문 시 무료 (원)</label>
                      <input
                        type="number"
                        className={inputCls}
                        value={freeShippingThreshold}
                        onChange={(e) => setFreeShippingThreshold(e.target.value)}
                        placeholder="예: 50000"
                        min={0}
                      />
                      {Number(freeShippingThreshold) > 0 && (
                        <p className="mt-1 text-[11px] text-green-400">
                          {Number(freeShippingThreshold).toLocaleString()}원 이상 무료배송 / 기본 {Number(shippingFee).toLocaleString()}원
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* 수수료: 쇼핑 스위치 ON일 때만 표시 */}
            {shopTagEnabled && (
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold text-white/50">수수료 (%)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={feeRate}
                  onChange={(e) => setFeeRate(e.target.value)}
                  placeholder="10"
                  min={0}
                  max={100}
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-white/50">재고 수량</label>
              <input
                type="number"
                className={inputCls}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
          </div>
        )}


        {/* ─── Step 4: 설명 & 옵션 ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-white/50">상품 설명</label>
              <textarea
                className={cn(inputCls, "min-h-[100px] resize-y")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="상품 설명 (선택)"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[12px] font-semibold text-white/50">옵션</label>
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-orange-400 hover:bg-orange-500/10"
                >
                  <Plus size={12} /> 옵션 추가
                </button>
              </div>
              {options.length > 0 ? (
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className={cn(inputCls, "flex-[2]")}
                        value={opt.name}
                        onChange={(e) => updateOption(idx, "name", e.target.value)}
                        placeholder="옵션명 (예: 색상)"
                      />
                      <input
                        className={cn(inputCls, "flex-[3]")}
                        value={opt.values}
                        onChange={(e) => updateOption(idx, "values", e.target.value)}
                        placeholder="쉼표 구분 (예: 블랙,화이트)"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/15"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-14 items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-[12px] text-white/20">
                  옵션이 없습니다
                </div>
              )}
            </div>

            {/* 등록 정보 요약 */}
            <div className="space-y-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">등록 정보 확인</p>
              <p className="text-[13px] font-semibold text-white">{name || "—"}</p>
              {brand && <p className="text-[12px] text-white/40">{brand}</p>}
              <div className="flex items-center gap-3 text-[12px] text-white/50">
                {price && <span className="font-semibold text-orange-400">{Number(price).toLocaleString()}원</span>}
                {Number(shippingFee) === 0
                  ? <span className="text-green-400">무료배송</span>
                  : freeShippingEnabled && Number(freeShippingThreshold) > 0
                    ? <span>{Number(freeShippingThreshold).toLocaleString()}원 이상 무료 / 기본 {Number(shippingFee).toLocaleString()}원</span>
                    : <span>배송비 {Number(shippingFee).toLocaleString()}원</span>}
              </div>
              {imageUrl && (
                <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                  <Check size={11} className="text-green-400" /> 대표사진 · 추가사진 {extraImages.length}장
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="shrink-0 border-t border-white/[0.06] px-5 py-4">
        <div className="flex gap-2.5">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-white/60 transition-all hover:bg-white/[0.08]"
            >
              <ChevronLeft size={15} /> 이전
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                if (canNext()) setStep((s) => s + 1);
                else if (step === 1) toast("상품명을 입력해 주세요", "error");
                else if (step === 2) toast("가격을 입력해 주세요", "error");
              }}
              disabled={!!uploading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-3 text-[13px] font-bold text-gray-900 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
            >
              다음 <ChevronRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-3 text-[13px] font-bold text-gray-900 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {submitting ? "등록 중..." : "상품 등록 완료"}
            </button>
          )}
        </div>
      </div>
    </>
  );

  // ─── 모달 렌더링 ───
  // 모바일: 바텀시트 — fixed bottom-0으로 고정 (브라우저 주소창 변동에도 흔들림 없음)
  // PC(md:): 중앙 팝업 — overlay 클릭으로 닫기
  const modal = open && typeof document !== "undefined" && createPortal(
    <>
      {/* 딤 오버레이 */}
      <div
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-[4px]"
        onClick={closeModal}
      />

      {/* 모바일: 바텀시트 — fixed bottom-0 */}
      <div
        className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col overflow-hidden rounded-t-[28px] md:hidden"
        style={{
          background: "linear-gradient(160deg,#0c1e2e 0%,#0d1b2a 100%)",
          maxHeight: "92dvh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {modalContent}
      </div>

      {/* PC: 중앙 팝업 다이얼로그 */}
      <div
        className="fixed inset-0 z-[9999] hidden items-center justify-center md:flex"
        onClick={closeModal}
      >
        <div
          className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-[24px]"
          style={{
            background: "linear-gradient(160deg,#0c1e2e 0%,#0d1b2a 100%)",
            maxHeight: "90vh",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {modalContent}
        </div>
      </div>
    </>,
    document.body,
  );

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-[13px] font-bold text-gray-900 shadow-soft transition-all hover:bg-orange-600 active:scale-[0.97]"
      >
        <Plus size={15} /> 상품 등록
      </button>
      {modal}
    </>
  );
}
