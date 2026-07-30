"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { won } from "@/lib/utils";
import { NO_IMAGE_SRC } from "@/lib/noImage";

interface CartItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  quantity: number;
  shippingFee: number;
}

function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("ipnak_cart");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem("ipnak_cart", JSON.stringify(items));
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
  }, []);

  function updateQty(id: string, delta: number) {
    const next = items.map((item) =>
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    );
    setItems(next);
    saveCart(next);
  }

  function removeItem(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    saveCart(next);
  }

  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const totalPrice = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const totalShipping = items.reduce((acc, i) => acc + (i.shippingFee > 0 ? i.shippingFee : 0), 0);
  const totalAmount = totalPrice + totalShipping;

  return (
    <div className="pb-32">
      <PageHeader title="장바구니" back />

      {!mounted ? (
        <div className="flex items-center justify-center py-20 text-navy-400 text-sm">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#162538]">
            <ShoppingBag size={28} className="text-navy-300" />
          </div>
          <p className="text-navy-400 text-[14px]">장바구니가 비어 있습니다</p>
          <Link href="/shop" className="rounded-xl bg-orange-500 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-orange-600">
            쇼핑하러 가기
          </Link>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-2xl border border-navy-100/20 bg-[#162538] p-3">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              ) : (
                <img src={NO_IMAGE_SRC} alt="이미지 없음" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/shop/${item.id}`} className="block truncate text-[13px] font-semibold text-navy-800 hover:text-orange-400">
                  {item.name}
                </Link>
                <p className="mt-1 text-[15px] font-extrabold text-orange-400">{won(item.price)}</p>
                {item.shippingFee === 0
                  ? <p className="text-[11px] text-green-400">무료배송</p>
                  : <p className="text-[11px] text-navy-400">배송비 {won(item.shippingFee)}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-navy-100/20 text-navy-400 hover:border-navy-100/40"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center text-[13px] font-bold text-navy-800">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-navy-100/20 text-navy-400 hover:border-navy-100/40"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={12} /> 삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 결제 합계 & 이동 버튼 */}
      {mounted && items.length > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-[#0d1b2a]/90 backdrop-blur-md">
          <div className="mx-auto max-w-[640px] p-3 space-y-2">
            <div className="flex justify-between text-[12px] text-navy-400 px-1">
              <span>상품금액</span><span>{won(totalPrice)}</span>
            </div>
            <div className="flex justify-between text-[12px] text-navy-400 px-1">
              <span>배송비</span><span>{totalShipping === 0 ? "무료" : won(totalShipping)}</span>
            </div>
            <div className="flex justify-between font-bold px-1 border-t border-navy-100/20 pt-2">
              <span className="text-[13px] text-navy-800">총 결제금액</span>
              <span className="text-[16px] text-orange-400">{won(totalAmount)}</span>
            </div>
            <div className="flex gap-2 pt-1">
              {items.slice(0, 1).map((item) => (
                <Link
                  key={item.id}
                  href={`/shop/${item.id}?qty=${item.quantity}`}
                  className="flex-1 text-center rounded-xl bg-orange-500 py-3 text-[14px] font-bold text-white hover:bg-orange-600 transition-colors"
                >
                  구매하기 ({totalItems}개)
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
