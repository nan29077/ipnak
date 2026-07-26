"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, ShoppingBag, X, Minus, Plus, ChevronRight, Loader2, Check, CreditCard, MapPin } from "lucide-react";
import { useToast } from "@/components/Toast";
import { won } from "@/lib/utils";
import Link from "next/link";

interface ProductForPurchase {
  id: string;
  name: string;
  price: number;
  options: string | null;
  feeRate: number;
  shippingFee: number;
  freeShippingThreshold?: number;
  imageUrl?: string | null;
}

interface ShippingAddress {
  id: string;
  name: string;
  phone: string;
  address: string;
  addressDetail: string;
  isDefault: number;
}

interface CartItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  quantity: number;
  shippingFee: number;
}

type ParsedOption = { name: string; values: string[] };

function parseOptions(optionsJson: string | null): ParsedOption[] {
  if (!optionsJson) return [];
  try {
    const parsed = JSON.parse(optionsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((o: any) => o.name && Array.isArray(o.values));
    }
    if (parsed.options && Array.isArray(parsed.options)) {
      return parsed.options.filter((o: any) => o.name && Array.isArray(o.values));
    }
    return [];
  } catch {
    return [];
  }
}

function addToLocalCart(item: CartItem) {
  const raw = localStorage.getItem("ipnak_cart");
  let cart: CartItem[] = [];
  try { cart = raw ? JSON.parse(raw) : []; } catch {}
  const idx = cart.findIndex((c) => c.id === item.id);
  if (idx >= 0) {
    cart[idx].quantity += item.quantity;
  } else {
    cart.push(item);
  }
  localStorage.setItem("ipnak_cart", JSON.stringify(cart));
}

function CardInput({ label, value, onChange, placeholder, maxLen }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; maxLen: number }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-white/50">{label}</label>
      <input
        className="w-full rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-white outline-none focus:border-orange-400 placeholder:text-white/25 transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLen))}
        placeholder={placeholder}
        inputMode="numeric"
      />
    </div>
  );
}

export function ProductPurchaseBar({ product, shopTagEnabled }: { product: ProductForPurchase; shopTagEnabled: boolean }) {
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pgOpen, setPgOpen] = useState(false);
  const [pgResult, setPgResult] = useState<"success" | "fail" | null>(null);
  const [pgLoading, setPgLoading] = useState(false);

  // 구매 바텀시트 state
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);

  // PG 모달 state
  const [cardNum, setCardNum] = useState(["", "", "", ""]);
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const parsedOptions = parseOptions(product.options);

  // 조건부 무료배송: threshold 이상 주문 시 배송비 0원
  const threshold = product.freeShippingThreshold ?? 0;
  const effectiveShippingFee =
    threshold > 0 && product.price * quantity >= threshold ? 0 : (product.shippingFee ?? 0);
  const totalAmount = product.price * quantity + effectiveShippingFee;

  function handleAddToCart() {
    addToLocalCart({
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl || "",
      price: product.price,
      quantity: 1,
      shippingFee: product.shippingFee ?? 0,
    });
    toast("장바구니에 담았습니다", "success");
  }

  async function openBuySheet() {
    setSheetOpen(true);
    setAddrLoading(true);
    try {
      const res = await fetch("/api/me/shipping-addresses");
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses ?? []);
        const def = (data.addresses ?? []).find((a: ShippingAddress) => a.isDefault === 1);
        if (def) setSelectedAddressId(def.id);
        else if (data.addresses?.length > 0) setSelectedAddressId(data.addresses[0].id);
      }
    } catch {}
    finally { setAddrLoading(false); }
  }

  function openPg() {
    setCardNum(["", "", "", ""]);
    setExpiry("");
    setCvc("");
    setPgResult(null);
    setPgOpen(true);
  }

  async function handlePay() {
    const cardFull = cardNum.join("").length === 16;
    const expiryOk = expiry.length === 5;
    const cvcOk = cvc.length === 3;
    if (!cardFull || !expiryOk || !cvcOk) {
      toast("카드 정보를 모두 입력해 주세요", "error");
      return;
    }
    setPgLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    const ok = Math.random() < 0.9;
    setPgLoading(false);
    if (ok) {
      setPgResult("success");
      // 주문 저장
      try {
        await fetch("/api/me/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity,
            shippingFee: product.shippingFee ?? 0,
            totalAmount,
            shippingAddressId: selectedAddressId ?? null,
            paymentMethod: "CARD",
          }),
        });
      } catch {}
    } else {
      setPgResult("fail");
    }
  }

  function closePg() {
    setPgOpen(false);
    setPgResult(null);
    if (pgResult === "success") {
      setSheetOpen(false);
    }
  }

  // Card number auto-format
  function handleCardNum(idx: number, val: string) {
    const nums = val.replace(/\D/g, "").slice(0, 4);
    const next = [...cardNum];
    next[idx] = nums;
    setCardNum(next);
  }

  // Expiry auto-format MM/YY
  function handleExpiry(val: string) {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    if (clean.length >= 3) {
      setExpiry(clean.slice(0, 2) + "/" + clean.slice(2));
    } else {
      setExpiry(clean);
    }
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const bottomBar = (
    <div
      className="fixed inset-x-0 z-50 border-t border-navy-100 bg-[#0d1b2a]/90 p-3 backdrop-blur-md md:relative md:!bottom-auto md:border-0 md:bg-[#162538]"
      style={{ bottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex max-w-[640px] gap-2">
        {/* 장바구니 버튼 */}
        <button
          type="button"
          onClick={handleAddToCart}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-navy-100/30 bg-[#162538] text-navy-400 transition-colors hover:border-orange-400 hover:text-orange-400"
          aria-label="장바구니 담기"
        >
          <ShoppingCart size={20} />
        </button>
        {/* 구매하기 버튼 */}
        <button
          type="button"
          onClick={openBuySheet}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-[15px] font-semibold text-white shadow-soft btn-press transition-colors outline-none hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-aqua-300 focus-visible:ring-offset-1"
        >
          <ShoppingBag size={18} /> 구매하기
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return bottomBar;

  const buySheet = sheetOpen && createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-[4px]" onClick={() => setSheetOpen(false)} />
      <div
        className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col rounded-t-[28px] overflow-hidden"
        style={{ background: "linear-gradient(160deg,#0c1e2e 0%,#0d1b2a 100%)", maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 shrink-0"><div className="h-1 w-10 rounded-full bg-white/20" /></div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <p className="text-[16px] font-bold text-white">구매하기</p>
          <button type="button" onClick={() => setSheetOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 pb-6 space-y-4">
          {/* 상품 요약 */}
          <div className="flex items-center gap-3 rounded-2xl border border-navy-100/20 bg-white/[0.03] p-3">
            {product.imageUrl && <img src={product.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white truncate">{product.name}</p>
              <p className="text-[15px] font-extrabold text-orange-400 mt-0.5">{won(product.price)}</p>
              {product.shippingFee === 0
                ? <p className="text-[11px] text-green-400">무료배송</p>
                : threshold > 0
                  ? <p className="text-[11px] text-navy-400">{won(threshold)} 이상 무료 / 기본 {won(product.shippingFee)}</p>
                  : <p className="text-[11px] text-navy-400">배송비 {won(product.shippingFee)}</p>}
            </div>
          </div>

          {/* 옵션 선택 */}
          {parsedOptions.length > 0 && (
            <div className="space-y-3">
              <p className="text-[12px] font-bold text-white/50">옵션 선택</p>
              {parsedOptions.map((opt) => (
                <div key={opt.name}>
                  <label className="mb-1.5 block text-[11px] text-white/40">{opt.name}</label>
                  <div className="flex flex-wrap gap-2">
                    {opt.values.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSelectedOptions((prev) => ({ ...prev, [opt.name]: val }))}
                        className={"rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors " + (selectedOptions[opt.name] === val ? "border-orange-400 bg-orange-500/15 text-orange-400" : "border-navy-100/20 text-white/50 hover:border-navy-100/40")}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 수량 선택 */}
          <div>
            <p className="mb-2 text-[12px] font-bold text-white/50">수량</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-navy-100/20 text-white/60 hover:border-navy-100/40">
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-[16px] font-bold text-white">{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-navy-100/20 text-white/60 hover:border-navy-100/40">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* 배송지 선택 */}
          <div>
            <p className="mb-2 text-[12px] font-bold text-white/50">배송지</p>
            {addrLoading ? (
              <div className="flex items-center gap-2 text-[12px] text-white/40"><Loader2 size={14} className="animate-spin" /> 불러오는 중...</div>
            ) : addresses.length === 0 ? (
              <Link href="/me/shipping" className="flex items-center gap-2 rounded-xl border border-dashed border-navy-100/20 p-3 text-[12px] text-navy-400 hover:border-orange-400 hover:text-orange-400">
                <MapPin size={14} /> 배송지 등록하기 <ChevronRight size={14} className="ml-auto" />
              </Link>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={"flex items-start gap-3 w-full rounded-xl border p-3 text-left transition-colors " + (selectedAddressId === addr.id ? "border-orange-400 bg-orange-500/10" : "border-navy-100/20 hover:border-navy-100/30")}
                  >
                    <MapPin size={14} className={"mt-0.5 shrink-0 " + (selectedAddressId === addr.id ? "text-orange-400" : "text-navy-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-white">{addr.name} <span className="text-navy-400 font-normal">{addr.phone}</span></p>
                      <p className="text-[11px] text-navy-400 truncate">{addr.address} {addr.addressDetail}</p>
                    </div>
                    {addr.isDefault === 1 && <span className="shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">기본</span>}
                  </button>
                ))}
                <Link href="/me/shipping" className="block text-center text-[11px] text-orange-400 hover:underline pt-1">+ 배송지 추가</Link>
              </div>
            )}
          </div>

          {/* 총 결제금액 */}
          <div className="rounded-2xl border border-navy-100/20 bg-white/[0.03] p-4">
            <div className="flex justify-between text-[12px] text-white/50 mb-1">
              <span>상품금액</span><span>{won(product.price * quantity)}</span>
            </div>
            <div className="flex justify-between text-[12px] text-white/50 mb-2">
              <span>배송비</span>
              <span>
                {effectiveShippingFee === 0
                  ? <span className="text-green-400">무료</span>
                  : won(effectiveShippingFee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-navy-100/15 pt-2">
              <span className="text-[13px] font-bold text-white">총 결제금액</span>
              <span className="text-[16px] font-extrabold text-orange-400">{won(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* 결제하기 버튼 */}
        <div className="shrink-0 border-t border-white/[0.06] px-5 py-4">
          <button
            type="button"
            onClick={openPg}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[15px] font-bold text-white hover:bg-orange-600 transition-colors"
          >
            <CreditCard size={18} /> 결제하기
          </button>
        </div>
      </div>
    </>,
    document.body,
  );

  const pgModal = pgOpen && createPortal(
    <>
      <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-[6px]" onClick={!pgLoading && !pgResult ? closePg : undefined} />
      <div
        className="fixed inset-0 z-[10001] flex items-center justify-center px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg,#0c1e2e 0%,#0d1b2a 100%)" }}>
          {pgResult === "success" ? (
            <div className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"><Check size={32} className="text-green-400" /></div>
              <div>
                <p className="text-[18px] font-bold text-white">결제가 완료되었습니다</p>
                <p className="mt-1 text-[13px] text-navy-400">구매내역에서 확인하실 수 있습니다</p>
              </div>
              <button type="button" onClick={closePg} className="mt-2 w-full rounded-xl bg-orange-500 py-3 text-[14px] font-bold text-white hover:bg-orange-600">확인</button>
            </div>
          ) : pgResult === "fail" ? (
            <div className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20"><X size={32} className="text-red-400" /></div>
              <div>
                <p className="text-[18px] font-bold text-white">결제에 실패했습니다</p>
                <p className="mt-1 text-[13px] text-navy-400">카드 정보를 확인하고 다시 시도해 주세요</p>
              </div>
              <button type="button" onClick={closePg} className="mt-2 w-full rounded-xl border border-navy-100/20 py-3 text-[14px] font-semibold text-white/70 hover:bg-white/[0.05]">닫기</button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[16px] font-bold text-white">카드 결제</p>
                  <p className="text-[12px] text-navy-400 mt-0.5">{won(totalAmount)}</p>
                </div>
                <button type="button" onClick={closePg} disabled={pgLoading} className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10"><X size={16} /></button>
              </div>

              {/* 카드번호 */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-white/50">카드 번호</label>
                <div className="flex gap-1.5">
                  {cardNum.map((v, i) => (
                    <input
                      key={i}
                      className="flex-1 rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-2 py-2.5 text-[14px] text-center text-white outline-none focus:border-orange-400 transition-colors"
                      value={v}
                      onChange={(e) => handleCardNum(i, e.target.value)}
                      placeholder="0000"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[11px] font-semibold text-white/50">유효기간</label>
                  <input
                    className="w-full rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-white outline-none focus:border-orange-400 transition-colors"
                    value={expiry}
                    onChange={(e) => handleExpiry(e.target.value)}
                    placeholder="MM/YY"
                    maxLength={5}
                    inputMode="numeric"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-[11px] font-semibold text-white/50">CVC</label>
                  <input
                    className="w-full rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-white outline-none focus:border-orange-400 transition-colors"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="000"
                    maxLength={3}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handlePay}
                disabled={pgLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[15px] font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {pgLoading ? <><Loader2 size={16} className="animate-spin" /> 결제 처리 중...</> : <><CreditCard size={16} /> 결제 완료</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );

  return (
    <>
      {bottomBar}
      {buySheet}
      {pgModal}
    </>
  );
}
