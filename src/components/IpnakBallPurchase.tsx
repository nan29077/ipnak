"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, Coins, CreditCard, KeyRound, Loader2, MapPin, Minus, Package, Plus, Radio, Search, ShieldCheck, Truck, X } from "lucide-react";
import { AddressSearchModal } from "@/components/AddressSearchModal";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import { clampUsablePoints, usePointBalance } from "@/lib/usePointBalance";

type Step = "intro" | "form" | "pay" | "done";
type ProductType = "ball" | "keyring";
type ProductInfo = {
  imageUrl?: string;
  imageUrls?: string[];
  name?: string;
  description?: string;
  optionEnabled?: boolean;
  optionOneLabel?: string;
  optionOnePrice?: number | null;
  optionTwoLabel?: string;
  optionTwoPrice?: number | null;
};
type TypeConfig = { enabled: boolean; price: number };

const TYPES: ProductType[] = ["ball", "keyring"];
const TYPE_LABEL: Record<ProductType, string> = { ball: "입낚볼", keyring: "입낚키링" };
const TYPE_ICON = { ball: Radio, keyring: KeyRound } as const;

const methods = [
  { key: "card", label: "신용·체크카드" },
  { key: "transfer", label: "계좌이체" },
  { key: "phone", label: "휴대폰 결제" },
];

/* imageUrl은 단일 URL 문자열 또는 JSON 배열 문자열 두 형태를 모두 저장한다. */
function parseImageUrls(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return [raw];
}

export function IpnakBallPurchase({
  price, buyer, openOnMount = false, triggerOpen = false, hideCard = false, onOpened,
  ballEnabled = true, keyringEnabled = false, keyringPrice = 0,
}: {
  price: number;
  buyer: { name: string; email: string };
  openOnMount?: boolean;
  triggerOpen?: boolean;
  hideCard?: boolean;
  onOpened?: () => void;
  ballEnabled?: boolean;
  keyringEnabled?: boolean;
  keyringPrice?: number;
}) {
  const toast = useToast();
  const detailAddressRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState("card");
  const [loading, setLoading] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [usedPoints, setUsedPoints] = useState(0);
  // 상품 타입별 판매 여부·판매가 (서버 설정이 기준, props는 SSR 초기값)
  const [config, setConfig] = useState<Record<ProductType, TypeConfig>>({
    ball: { enabled: ballEnabled, price },
    keyring: { enabled: keyringEnabled, price: keyringPrice },
  });
  const [products, setProducts] = useState<Partial<Record<ProductType, ProductInfo>>>({});
  const [activeType, setActiveType] = useState<ProductType>(ballEnabled ? "ball" : keyringEnabled ? "keyring" : "ball");
  // 상품 이미지 캐러셀
  const [imgIdx, setImgIdx] = useState(0);
  const touchStartX = useRef(0);
  // 옵션 선택: "one" | "two" | null
  const [selectedOption, setSelectedOption] = useState<"one" | "two" | null>(null);
  const [form, setForm] = useState({
    buyerName: buyer.name, buyerPhone: "", buyerEmail: buyer.email,
    recipientName: buyer.name, recipientPhone: "", postalCode: "", address: "",
    addressDetail: "", deliveryMemo: "",
  });

  useEffect(() => {
    fetch("/api/shop/ipnak-ball/products")
      .then((r) => r.json())
      .then((data) => {
        const nextProducts: Partial<Record<ProductType, ProductInfo>> = {};
        for (const p of (data?.products ?? []) as any[]) {
          const t: ProductType = p.type === "keyring" ? "keyring" : "ball";
          if (nextProducts[t]) continue; // 타입별 1개만 사용
          const imageUrls = parseImageUrls(p.imageUrl);
          nextProducts[t] = {
            imageUrl: imageUrls[0],
            imageUrls,
            name: p.name,
            description: p.description,
            optionEnabled: Boolean(p.optionEnabled),
            optionOneLabel: p.optionOneLabel,
            optionOnePrice: p.optionOnePrice,
            optionTwoLabel: p.optionTwoLabel,
            optionTwoPrice: p.optionTwoPrice,
          };
        }
        setProducts(nextProducts);
        if (data?.config) {
          setConfig((prev) => ({
            ball: { enabled: Boolean(data.config.ball?.enabled), price: Number(data.config.ball?.price) || prev.ball.price },
            keyring: { enabled: Boolean(data.config.keyring?.enabled), price: Number(data.config.keyring?.price) || prev.keyring.price },
          }));
        }
      })
      .catch(() => {});
  }, []);

  const enabledTypes = TYPES.filter((t) => config[t].enabled);

  // 현재 탭이 비활성화되면 켜져 있는 다른 탭으로 이동한다.
  useEffect(() => {
    if (config[activeType].enabled) return;
    const fallback = TYPES.find((t) => config[t].enabled);
    if (fallback) setActiveType(fallback);
  }, [config, activeType]);

  useEffect(() => {
    if (openOnMount) {
      setStep("intro");
      setOpen(true);
    }
  }, [openOnMount]);

  const prevTrigger = useRef(false);
  useEffect(() => {
    if (triggerOpen && !prevTrigger.current) {
      setStep("intro");
      setOpen(true);
      onOpened?.();
    }
    prevTrigger.current = triggerOpen;
  }, [triggerOpen, onOpened]);

  const label = TYPE_LABEL[activeType];
  const TypeIcon = TYPE_ICON[activeType];
  const product = products[activeType] ?? {};
  const basePrice = config[activeType].price;

  // 탭 전환: 상품마다 옵션·수량·단계가 다르므로 구매 흐름을 처음부터 다시 시작한다.
  function switchType(next: ProductType) {
    if (next === activeType) return;
    setActiveType(next);
    setStep("intro");
    setQty(1);
    setSelectedOption(null);
    setImgIdx(0);
    setPointInput("");
  }

  // 현재 단가: 옵션 활성화 시 선택된 옵션 가격, 아니면 기본가
  const unitPrice = (() => {
    if (!product.optionEnabled) return basePrice;
    if (selectedOption === "one" && product.optionOnePrice != null) return product.optionOnePrice;
    if (selectedOption === "two" && product.optionTwoPrice != null) return product.optionTwoPrice;
    return basePrice;
  })();

  const totalPrice = unitPrice * qty;

  // ── 포인트 사용 ──
  // 보유 포인트는 시트가 열릴 때 조회한다. 포인트 제도 OFF·비로그인이면 enabled=false 로 섹션을 숨긴다.
  const { enabled: pointsEnabled, balance: pointBalance } = usePointBalance(open);
  const [pointInput, setPointInput] = useState("");
  const appliedPoints = clampUsablePoints(pointInput, pointBalance, totalPrice);
  const payableAmount = Math.max(0, totalPrice - appliedPoints);
  const usablePointMax = Math.min(pointBalance, totalPrice);

  const images = product.imageUrls ?? [];
  function moveImage(delta: number) {
    if (images.length < 2) return;
    setImgIdx((i) => Math.min(images.length - 1, Math.max(0, i + delta)));
  }

  // 옵션 선택 시 안내 문구 (예: 2개입 × 2개 = 총 4개)
  const optionHint = (() => {
    if (!product.optionEnabled || selectedOption === null) return null;
    const optionLabel = selectedOption === "one" ? (product.optionOneLabel ?? "1개입") : (product.optionTwoLabel ?? "2개입");
    const perPack = selectedOption === "one" ? 1 : 2;
    const totalItems = perPack * qty;
    return `${optionLabel} × ${qty}개 = 총 ${totalItems}개`;
  })();

  // ── 디바이스 뒤로가기 버튼 처리: 바텀시트 열릴 때 history 엔트리 push ──
  const historyPushedRef = useRef(false);
  const stepRef = useRef<Step>(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => {
    if (!open) return;

    // 시트가 열릴 때 history 엔트리 하나 추가 (뒤로가기가 페이지 이탈 대신 시트 닫힘으로)
    history.pushState({ ballPurchaseOpen: true }, "");
    historyPushedRef.current = true;

    function onPopState() {
      const s = stepRef.current;
      if (s === "pay") {
        // pay → form
        history.pushState({ ballPurchaseOpen: true }, "");
        setStep("form");
      } else if (s === "form") {
        // form → intro
        history.pushState({ ballPurchaseOpen: true }, "");
        setStep("intro");
      } else {
        // intro / done → 시트 닫기 (browser가 이미 한 스텝 뒤로 감)
        historyPushedRef.current = false;
        setOpen(false);
        setStep("intro");
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // X 버튼 등으로 시트가 programmatic하게 닫힐 때 push했던 엔트리 제거
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        history.go(-1);
      }
    };
  }, [open]);

  const close = () => {
    if (!loading) {
      setAddressOpen(false);
      setOpen(false);
      setPointInput("");
      if (step === "done") setStep("intro");
    }
  };
  function submitInfo(e: FormEvent) { e.preventDefault(); setStep("pay"); }
  async function pay() {
    setLoading(true);
    try {
      const res = await fetch("/api/ipnak-ball/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantity: qty, paymentMethod: method, selectedOption, productType: activeType, usePoints: appliedPoints }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "결제에 실패했습니다.");
      setOrderNo(data.orderNo); setUsedPoints(Number(data.pointsUsed) || 0); setPointInput(""); setStep("done");
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }
  const field = (key: keyof typeof form, fieldLabel: string, required = false, type = "text") => (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-white/60">{fieldLabel}{required && " *"}</span>
      <input type={type} required={required} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-[16px] text-white outline-none focus:border-aqua-400" />
    </label>
  );

  // 두 스위치가 모두 꺼져 있으면 구매 카드는 숨기고, 시트가 열리면 판매 중지 안내를 보여준다.
  return <>
    {!hideCard && enabledTypes.length > 0 && <div className="overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/15 via-[#202020] to-aqua-500/10 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-soft"><TypeIcon size={23} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-extrabold text-navy-900">스마트 계측의 시작, {enabledTypes.map((t) => TYPE_LABEL[t]).join(" · ")}</p>
          <p className="mt-0.5 text-[12px] text-navy-400">NFC 연동으로 나의 어획 기록을 더 간편하게</p>
        </div>
      </div>
      <button onClick={() => { setStep("intro"); setOpen(true); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-extrabold text-white">
        {enabledTypes.length > 1 ? "구매하기" : `${TYPE_LABEL[enabledTypes[0]]} 구매하기`}
      </button>
    </div>}

    {open && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/75 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close()}>
        <div className="ipnak-ball-scrollbar h-[76vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-[#151b21] text-white shadow-2xl sm:rounded-[28px]">
          <div className="sticky top-0 z-10 border-b border-white/10 bg-[#151b21]/95 backdrop-blur">
            <div className="flex items-center justify-between px-5 py-4">
              <button onClick={() => step === "intro" ? close() : setStep(step === "pay" ? "form" : "intro")} className="p-1 text-white/60">{step === "intro" || step === "done" ? <X /> : <ChevronLeft />}</button>
              <p className="font-bold">{step === "intro" ? `${label} 소개` : step === "form" ? "구매자·배송지 정보" : step === "pay" ? "PG 결제" : "주문 완료"}</p><span className="w-7" />
            </div>
            {/* 상품 탭 — 두 스위치가 모두 켜져 있을 때만 노출 */}
            {enabledTypes.length > 1 && step === "intro" && (
              <div className="flex gap-1.5 px-5 pb-3">
                {enabledTypes.map((t) => {
                  const Icon = TYPE_ICON[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => switchType(t)}
                      aria-pressed={activeType === t}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-bold transition",
                        activeType === t ? "border-orange-400 bg-orange-500/15 text-orange-300" : "border-white/10 text-white/50 hover:border-white/25"
                      )}
                    >
                      <Icon size={15} /> {TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {enabledTypes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-white/60">현재 판매 중인 상품이 없습니다.</p>
              <button onClick={close} className="mt-6 w-full rounded-2xl bg-white/10 py-3 font-bold">확인</button>
            </div>
          ) : <>
          {step === "intro" && <div className="p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            {images.length === 0 ? (
              <div className="flex items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/15 to-aqua-500/10">
                <div className="flex h-48 items-center justify-center"><TypeIcon size={72} className="text-orange-400" /></div>
              </div>
            ) : images.length === 1 ? (
              <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/15 to-aqua-500/10">
                <img src={images[0]} alt={product.name ?? label} className="aspect-square w-full object-contain" />
              </div>
            ) : (
              <div>
                <div
                  className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/15 to-aqua-500/10"
                  onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    const diff = e.changedTouches[0].clientX - touchStartX.current;
                    if (Math.abs(diff) > 50) moveImage(diff < 0 ? 1 : -1);
                  }}
                >
                  {/* 슬라이드 트랙 — 이미지를 가로로 나란히 배치하고 translateX로 이동 */}
                  <div
                    className="flex"
                    style={{
                      transform: `translateX(-${Math.min(imgIdx, images.length - 1) * 100}%)`,
                      transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    {images.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`${product.name ?? label} 이미지 ${i + 1}`}
                        className="aspect-square w-full shrink-0 object-contain"
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-center gap-2">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setImgIdx(i)}
                      aria-label={`${i + 1}번 이미지 보기`}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        i === Math.min(imgIdx, images.length - 1) ? "w-5 bg-orange-400" : "w-2 bg-white/25"
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            <h2 className="mt-5 text-xl font-extrabold">{product.name ?? `${label} 하나로 더 스마트한 낚시`}</h2>
            <div className="mt-4 space-y-3 text-sm text-white/65">
              {product.description
                ? <p className="whitespace-pre-line">{product.description}</p>
                : <>
                    <p className="flex gap-2"><TypeIcon className="shrink-0 text-aqua-400" size={18} /> NFC 태그로 앱과 빠르게 연결</p>
                    <p className="flex gap-2"><ShieldCheck className="shrink-0 text-aqua-400" size={18} /> 측정 기록과 {label} ID를 안전하게 저장</p>
                    <p className="flex gap-2"><Truck className="shrink-0 text-aqua-400" size={18} /> 결제 완료 후 순차 배송</p>
                  </>}
            </div>

            {/* 옵션 선택 (optionEnabled === true 일 때만 표시) */}
            {product.optionEnabled && (
              <div className="mt-5 rounded-2xl bg-white/[.05] p-4 space-y-3">
                <p className="text-sm font-bold text-white/80">옵션 선택</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* 1개입 옵션 */}
                  <button
                    type="button"
                    onClick={() => setSelectedOption("one")}
                    className={cn(
                      "flex flex-col items-center rounded-xl border px-3 py-3 text-sm font-semibold transition",
                      selectedOption === "one"
                        ? "border-orange-400 bg-orange-500/15 text-orange-300"
                        : "border-white/10 text-white/60 hover:border-white/25"
                    )}
                  >
                    <span className="font-bold">{product.optionOneLabel ?? "1개입"}</span>
                    {product.optionOnePrice != null && (
                      <span className="mt-0.5 text-xs text-white/50">{product.optionOnePrice.toLocaleString()}원</span>
                    )}
                  </button>
                  {/* 2개입 옵션 */}
                  <button
                    type="button"
                    onClick={() => setSelectedOption("two")}
                    className={cn(
                      "flex flex-col items-center rounded-xl border px-3 py-3 text-sm font-semibold transition",
                      selectedOption === "two"
                        ? "border-orange-400 bg-orange-500/15 text-orange-300"
                        : "border-white/10 text-white/60 hover:border-white/25"
                    )}
                  >
                    <span className="font-bold">{product.optionTwoLabel ?? "2개입"}</span>
                    {product.optionTwoPrice != null && (
                      <span className="mt-0.5 text-xs text-white/50">{product.optionTwoPrice.toLocaleString()}원</span>
                    )}
                  </button>
                </div>
                {optionHint && (
                  <p className="text-center text-xs text-aqua-400 font-semibold">{optionHint}</p>
                )}
              </div>
            )}

            {/* 수량 선택 */}
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/[.05] p-4">
              <span>수량</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="rounded-full bg-white/10 p-1"><Minus size={16}/></button>
                <b>{qty}</b>
                <button onClick={() => setQty(Math.min(10, qty + 1))} className="rounded-full bg-white/10 p-1"><Plus size={16}/></button>
              </div>
            </div>

            <button
              onClick={() => {
                if (product.optionEnabled && selectedOption === null) {
                  toast("옵션을 선택해주세요.", "error");
                  return;
                }
                setStep("form");
              }}
              className="mt-5 w-full rounded-2xl bg-orange-500 py-3.5 font-extrabold"
            >
              {totalPrice.toLocaleString()}원 · 구매하기
            </button>
          </div>}

          {step === "form" && <form onSubmit={submitInfo} className="space-y-5 p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="rounded-xl bg-white/[.05] px-4 py-2.5 text-[13px] font-bold text-orange-300">{label} 주문</div>
            <section><h3 className="mb-3 flex items-center gap-2 font-bold"><Package size={17} className="text-orange-400"/>구매자 정보</h3><div className="space-y-3">{field("buyerName", "이름", true)}{field("buyerPhone", "휴대전화", true, "tel")}{field("buyerEmail", "이메일", false, "email")}</div></section>
            <section>
              <h3 className="mb-3 flex items-center gap-2 font-bold"><MapPin size={17} className="text-aqua-400"/>배송지 정보</h3>
              <div className="space-y-3">
                {field("recipientName", "받는 분", true)}
                {field("recipientPhone", "연락처", true, "tel")}
                <div>
                  <span className="mb-1 block text-[12px] font-semibold text-white/60">주소 *</span>
                  <div className="flex gap-2">
                    <input required readOnly value={form.postalCode} placeholder="우편번호" onClick={() => setAddressOpen(true)} className="w-[110px] rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-sm text-white outline-none" />
                    <button type="button" onClick={() => setAddressOpen(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-orange-500/50 bg-orange-500/10 px-3 py-2.5 text-sm font-bold text-orange-300 hover:bg-orange-500/20"><Search size={16} /> 주소 검색</button>
                  </div>
                  <input required readOnly value={form.address} placeholder="주소 검색 버튼을 눌러 주세요" onClick={() => setAddressOpen(true)} className="mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400" />
                </div>
                <label className="block"><span className="mb-1 block text-[12px] font-semibold text-white/60">상세 주소</span><input ref={detailAddressRef} value={form.addressDetail} onChange={(e) => setForm({ ...form, addressDetail: e.target.value })} placeholder="동·호수 등 상세주소" className="w-full rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-[16px] text-white outline-none focus:border-aqua-400" /></label>
                {field("deliveryMemo", "배송 메모")}
              </div>
            </section>
            <button type="submit" className="w-full rounded-2xl bg-orange-500 py-3.5 font-extrabold">{totalPrice.toLocaleString()}원 결제하기</button>
          </form>}

          {step === "pay" && <div className="p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="rounded-2xl bg-white/[.05] p-5 text-center">
              <p className="text-xs text-white/50">{label} · 최종 결제 금액</p>
              <p className="mt-1 text-3xl font-extrabold">₩{payableAmount.toLocaleString()}</p>
              {appliedPoints > 0 && (
                <p className="mt-1 text-xs text-orange-300">
                  상품금액 {totalPrice.toLocaleString()}원 − 포인트 {appliedPoints.toLocaleString()}P
                </p>
              )}
              {optionHint && <p className="mt-1 text-xs text-aqua-400">{optionHint}</p>}
            </div>

            {/* 포인트 사용 — 보유 포인트 이내, 결제금액 이하로만 사용 가능(서버에서 재검증) */}
            {pointsEnabled && (
              <div className="mt-4 rounded-2xl bg-white/[.05] p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-white/80">
                    <Coins size={15} className="text-orange-400" /> 포인트 사용
                  </p>
                  <p className="text-[12px] text-white/50">보유 {pointBalance.toLocaleString()}P</p>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pointInput}
                    onChange={(e) => setPointInput(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    placeholder="0"
                    disabled={usablePointMax <= 0}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-right text-[16px] text-white outline-none focus:border-orange-400 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setPointInput(String(usablePointMax))}
                    disabled={usablePointMax <= 0}
                    className="shrink-0 rounded-xl border border-orange-500/50 bg-orange-500/10 px-3 text-[12px] font-bold text-orange-300 disabled:opacity-40"
                  >
                    전액 사용
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-white/45">
                  {usablePointMax <= 0
                    ? "사용 가능한 포인트가 없습니다."
                    : `최대 ${usablePointMax.toLocaleString()}P까지 사용할 수 있습니다.`}
                </p>
              </div>
            )}

            <p className="mb-2 mt-5 text-xs font-bold text-white/60">결제 수단</p><div className="grid grid-cols-3 gap-2">{methods.map(m => <button key={m.key} onClick={() => setMethod(m.key)} className={cn("rounded-xl border px-2 py-3 text-xs font-semibold", method === m.key ? "border-aqua-400 bg-aqua-500/10 text-aqua-300" : "border-white/10 text-white/50")}>{m.label}</button>)}</div>
            <p className="mt-4 rounded-xl bg-white/[.05] p-3 text-[11px] leading-relaxed text-white/50">현재 개발 환경의 테스트 PG 결제창입니다. 운영 PG 키 연동 시 동일한 주문 흐름에서 실제 승인 결과를 처리합니다.</p>
            <button onClick={pay} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 font-extrabold disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18}/> : <CreditCard size={18}/>} ₩{payableAmount.toLocaleString()} 결제 승인</button>
          </div>}

          {step === "done" && <div className="p-8 text-center pb-[max(32px,env(safe-area-inset-bottom))]"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-500/15 text-aqua-400"><Check size={32}/></span><h2 className="mt-4 text-xl font-extrabold">구매가 완료되었습니다</h2><p className="mt-2 text-sm text-white/55">주문번호 {orderNo}<br/>{usedPoints > 0 && <>포인트 {usedPoints.toLocaleString()}P 사용<br/></>}관리자가 배송 상태를 순차적으로 업데이트합니다.</p><button onClick={close} className="mt-6 w-full rounded-2xl bg-white/10 py-3 font-bold">확인</button></div>}
          </>}
        </div>
      </div>, document.body)}

    <AddressSearchModal open={addressOpen} onClose={() => setAddressOpen(false)} onComplete={({ postalCode, address }) => {
      setForm((current) => ({ ...current, postalCode, address }));
      setAddressOpen(false);
      window.setTimeout(() => detailAddressRef.current?.focus(), 50);
    }} />
  </>;
}
