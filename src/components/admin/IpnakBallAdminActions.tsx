"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

export function BallStatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter(); const toast = useToast(); const [loading, setLoading] = useState(false); const [carrier, setCarrier] = useState(""); const [trackingNumber, setTracking] = useState("");
  async function update(next: string) { setLoading(true); try { const res = await fetch("/api/admin/ipnak-ball", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: next, carrier, trackingNumber }) }); const d = await res.json(); if (!res.ok) throw new Error(d.error); toast("주문 상태를 변경했습니다", "success"); router.refresh(); } catch (e: any) { toast(e.message || "처리에 실패했습니다", "error"); } finally { setLoading(false); } }
  return <div className="flex min-w-[230px] flex-wrap gap-1.5">{status === "PAID" && <button disabled={loading} onClick={() => update("PREPARING")} className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white">배송 준비</button>}{status === "PREPARING" && <><input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="배송사" className="w-20 rounded-lg px-2 py-1.5 text-xs"/><input value={trackingNumber} onChange={e => setTracking(e.target.value)} placeholder="송장번호" className="w-28 rounded-lg px-2 py-1.5 text-xs"/><button disabled={loading} onClick={() => update("SHIPPED")} className="rounded-lg bg-aqua-500 px-2.5 py-1.5 text-xs font-bold text-white">발송</button></>}{status === "SHIPPED" && <button disabled={loading} onClick={() => update("DELIVERED")} className="rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-bold text-white">배송 완료</button>}{!["CANCELLED","REFUNDED","DELIVERED"].includes(status) && <button disabled={loading} onClick={() => update(status === "PAID" || status === "PREPARING" || status === "SHIPPED" ? "REFUNDED" : "CANCELLED")} className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-bold text-red-400">{status === "REQUESTED" ? "취소" : "환불"}</button>}{loading && <Loader2 size={15} className="animate-spin"/>}</div>;
}

/**
 * 판매 가격은 해당 상품 레코드(IpnakBallProduct.price)를 직접 수정한다.
 * 예전에는 ipnak_*_price 설정값을 따로 저장해 상품의 기본가와 두 벌로 나뉘어 있었다.
 */
export function BallPriceForm({ initial, productId, label = "입낚볼" }: { initial: number; productId: string | null; label?: string }) {
  const router = useRouter(); const toast = useToast(); const [price, setPrice] = useState(String(initial)); const [loading, setLoading] = useState(false);
  async function save(e: FormEvent) { e.preventDefault(); const n = Number(price); if (!Number.isInteger(n) || n < 100) return toast("100원 이상의 가격을 입력해 주세요", "error"); setLoading(true); try { const res = await fetch("/api/admin/ipnak-ball/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, price: n }) }); const d = await res.json(); if (!res.ok) throw new Error(d.error); toast(`${label} 판매 가격을 변경했습니다`, "success"); router.refresh(); } catch (e: any) { toast(e.message || "저장에 실패했습니다", "error"); } finally { setLoading(false); } }

  if (!productId) {
    return <div className="card max-w-xl p-5">
      <h2 className="text-lg font-extrabold text-navy-800">{label} 판매 가격</h2>
      <p className="mt-3 rounded-xl border border-orange-400/30 bg-orange-500/5 px-4 py-3 text-sm text-orange-400">
        등록된 {label} 상품이 없습니다. 먼저 <b>상품 관리</b> 탭에서 {label} 상품을 등록해 주세요.
      </p>
    </div>;
  }

  return <form onSubmit={save} className="card max-w-xl p-5"><h2 className="text-lg font-extrabold text-navy-800">{label} 판매 가격</h2><p className="mt-1 text-sm text-navy-400">{label} 상품의 기본가를 변경합니다. 저장 즉시 낚시꾼 마이페이지와 신규 주문 결제 금액에 반영됩니다. 기존 주문 가격은 변경되지 않습니다.</p><label className="mt-5 block text-sm font-bold text-navy-700" htmlFor="ipnak-price-input">판매 가격</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><input id="ipnak-price-input" type="number" min="100" step="100" value={price} onChange={e => setPrice(e.target.value)} className="h-16 w-full rounded-2xl border-2 border-orange-400 bg-[#ffffff] px-4 pr-14 text-right text-2xl font-extrabold tabular-nums text-[#111827] caret-orange-500 outline-none transition-shadow focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20" style={{ color: "#111827", backgroundColor: "#ffffff" }}/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base font-extrabold text-[#374151]">원</span></div><button disabled={loading} className="h-16 rounded-2xl bg-orange-500 px-7 text-base font-extrabold text-white shadow-soft transition-colors hover:bg-orange-600 disabled:opacity-50">{loading ? "저장 중" : "가격 저장"}</button></div><p className="mt-2 text-xs font-medium text-navy-400">현재 입력값: {Number(price || 0).toLocaleString()}원</p></form>;
}
