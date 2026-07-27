"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, ChevronRight, Loader2, MapPin,
  Minus, Package, Plus, Radio, ShoppingBag, Truck,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  stock: number;
  imageUrl?: string | null;
};
type ShippingAddress = {
  id: string;
  name: string;
  phone: string;
  address: string;
  addressDetail: string;
  isDefault: boolean | number;
};
type Step = "list" | "form" | "done";

export default function IpnakBallShopPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<Step>("list");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/shop/ipnak-ball/products").then((r) => r.json()),
      fetch("/api/me/shipping-addresses").then((r) => r.json()),
    ])
      .then(([prodData, addrData]) => {
        if (Array.isArray(prodData.products)) setProducts(prodData.products);
        if (Array.isArray(addrData.addresses)) {
          setAddresses(addrData.addresses);
          const def = addrData.addresses.find((a: ShippingAddress) => a.isDefault);
          const first = addrData.addresses[0];
          if (def) setSelectedAddressId(def.id);
          else if (first) setSelectedAddressId(first.id);
        }
      })
      .finally(() => setLoadingInit(false));
  }, []);

  async function handleOrder() {
    if (!selectedProduct || !selectedAddressId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/shop/ipnak-ball/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity,
          addressId: selectedAddressId,
          memo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "주문에 실패했습니다.");
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── 로딩 ── */
  if (loadingInit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1b2a]">
        <Loader2 size={32} className="animate-spin text-orange-400" />
      </div>
    );
  }

  /* ── 주문 완료 ── */
  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0d1b2a] px-6 pb-16 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-orange-500/20 ring-4 ring-orange-500/10">
          <Check size={44} className="text-orange-400" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[24px] font-extrabold text-white">주문 완료!</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/50">
            주문이 정상적으로 접수되었습니다.<br />
            배송 준비 후 발송해 드립니다.
          </p>
        </div>
        <div className="flex w-full max-w-[320px] flex-col gap-2.5">
          <button
            onClick={() => router.push("/me?tab=settings")}
            className="w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-white"
          >
            마이페이지로
          </button>
          <button
            onClick={() => { setStep("list"); setMemo(""); }}
            className="w-full rounded-2xl border border-white/15 py-3.5 text-[14px] font-semibold text-white/60"
          >
            쇼핑 계속하기
          </button>
        </div>
      </div>
    );
  }

  const totalPrice = selectedProduct ? selectedProduct.price * quantity : 0;

  return (
    <div className="min-h-screen bg-[#0d1b2a] pb-24">
      {/* 헤더 */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#0d1b2a]/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => {
            if (step === "form") { setStep("list"); return; }
            // 직접 URL 진입 등 히스토리가 없으면 홈으로
            if (window.history.length > 1) router.back(); else router.replace("/home");
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/20"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <p className="text-[17px] font-bold text-white">입낚볼 구매</p>
      </div>

      {/* ── 상품 목록 ── */}
      {step === "list" && (
        <div className="space-y-4 px-4 py-5">
          {products.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-4 text-center">
              <Package size={52} className="text-white/15" strokeWidth={1.2} />
              <p className="text-[15px] text-white/40">현재 판매 중인 상품이 없습니다</p>
              <p className="text-[13px] text-white/25">관리자가 상품을 등록하면 여기에 표시됩니다</p>
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#162538]">
                {/* 상품 이미지 */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0d1b2a]">
                  <img
                    src={product.imageUrl || "/ipnak-ball-flat-bass-example.png"}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                  {product.stock <= 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-[1px]">
                      <span className="rounded-xl bg-white/10 px-5 py-2 text-[16px] font-bold text-white/80">품절</span>
                    </div>
                  )}
                  {product.stock > 0 && product.stock <= 10 && (
                    <div className="absolute right-3 top-3 rounded-full bg-orange-500/90 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                      잔여 {product.stock}개
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Radio size={14} className="shrink-0 text-orange-400" strokeWidth={1.8} />
                        <p className="text-[17px] font-extrabold text-white">{product.name}</p>
                      </div>
                      {product.description && (
                        <p className="mt-1 text-[13px] text-white/50">{product.description}</p>
                      )}
                    </div>
                    <p className="shrink-0 text-[22px] font-extrabold text-yellow-400">
                      {product.price.toLocaleString()}
                      <span className="text-[14px] font-semibold text-yellow-400/70">원</span>
                    </p>
                  </div>
                  <button
                    disabled={product.stock <= 0}
                    onClick={() => {
                      setSelectedProduct(product);
                      setQuantity(1);
                      setError("");
                      setStep("form");
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[15px] font-bold text-white transition-colors hover:bg-orange-600 active:scale-[0.99] disabled:opacity-40"
                  >
                    <ShoppingBag size={17} strokeWidth={2} />
                    {product.stock <= 0 ? "품절" : "구매하기"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 구매 폼 ── */}
      {step === "form" && selectedProduct && (
        <div className="space-y-4 px-4 py-5">
          {/* 선택 상품 요약 */}
          <div className="flex gap-3 rounded-2xl border border-white/10 bg-[#162538] p-4">
            <img
              src={selectedProduct.imageUrl || "/ipnak-ball-flat-bass-example.png"}
              alt={selectedProduct.name}
              className="h-16 w-16 shrink-0 rounded-xl object-cover bg-[#0d1b2a]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-white">{selectedProduct.name}</p>
              <p className="mt-0.5 text-[13px] text-white/40">{selectedProduct.price.toLocaleString()}원 / 개</p>
            </div>
          </div>

          {/* 수량 선택 */}
          <div className="rounded-2xl border border-white/10 bg-[#162538] p-4">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-white/40">수량</p>
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition-colors active:bg-white/20"
              >
                <Minus size={16} strokeWidth={2.5} />
              </button>
              <p className="text-[28px] font-extrabold tabular-nums text-white">{quantity}</p>
              <button
                onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition-colors active:bg-white/20"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-white/25">최대 5개까지 구매 가능</p>
          </div>

          {/* 배송지 선택 */}
          <div className="rounded-2xl border border-white/10 bg-[#162538] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wider text-white/40">배송지</p>
              <Link href="/me/shipping" className="flex items-center gap-0.5 text-[12px] text-orange-400">
                배송지 관리 <ChevronRight size={13} strokeWidth={2} />
              </Link>
            </div>

            {addresses.length === 0 ? (
              <div className="py-5 text-center">
                <MapPin size={28} className="mx-auto mb-2 text-white/20" strokeWidth={1.5} />
                <p className="text-[14px] font-semibold text-white/50">저장된 배송지가 없습니다</p>
                <Link
                  href="/me/shipping"
                  className="mt-3 inline-block rounded-xl bg-orange-500/15 px-4 py-2 text-[13px] font-semibold text-orange-400"
                >
                  배송지 등록하러 가기
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => {
                  const selected = selectedAddressId === addr.id;
                  return (
                    <button
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                        selected
                          ? "border-orange-500/60 bg-orange-500/10"
                          : "border-white/10 bg-white/5 active:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            selected ? "border-orange-500 bg-orange-500" : "border-white/30"
                          }`}
                        >
                          {selected && <Check size={9} strokeWidth={3} className="text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold text-white">{addr.name}</p>
                            <p className="text-[12px] text-white/40">{addr.phone}</p>
                            {(addr.isDefault === true || addr.isDefault === 1) && (
                              <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">
                                기본
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[12px] text-white/55">
                            {addr.address} {addr.addressDetail}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 배송 메모 */}
          <div className="rounded-2xl border border-white/10 bg-[#162538] p-4">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-white/40">배송 메모 (선택)</p>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="문 앞에 놔주세요, 부재 시 경비실에..."
              style={{ fontSize: "16px" }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] text-white placeholder-white/20 outline-none transition-colors focus:border-orange-400/50"
            />
          </div>

          {/* 결제 요약 */}
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/8 p-4">
            <div className="flex items-center justify-between py-1 text-[14px] text-white/55">
              <span>상품금액</span>
              <span>{(selectedProduct.price * quantity).toLocaleString()}원</span>
            </div>
            <div className="flex items-center justify-between py-1 text-[14px] text-white/55">
              <span>배송비</span>
              <span className="font-semibold text-aqua-400">무료</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-[16px] font-bold text-white">총 결제금액</span>
              <span className="text-[20px] font-extrabold text-yellow-400">
                {totalPrice.toLocaleString()}원
              </span>
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-center text-[13px] font-semibold text-red-400">
              {error}
            </p>
          )}

          {/* 구매하기 버튼 */}
          <button
            onClick={handleOrder}
            disabled={submitting || !selectedAddressId || addresses.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-[16px] font-extrabold text-white transition-colors hover:bg-orange-600 active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Truck size={20} strokeWidth={2} />
            )}
            {submitting ? "주문 처리 중..." : `${totalPrice.toLocaleString()}원 결제하기`}
          </button>
        </div>
      )}
    </div>
  );
}
