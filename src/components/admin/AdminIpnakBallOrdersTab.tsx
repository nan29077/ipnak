"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Truck, Save } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Table } from "@/components/admin/ui";
import { won, kstFormat } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending:   { label: "결제완료", className: "text-amber-400 bg-amber-400/10" },
  confirmed: { label: "배송준비", className: "text-blue-400 bg-blue-500/10" },
  shipped:   { label: "배송중",   className: "text-aqua-400 bg-aqua-400/10" },
  delivered: { label: "배송완료", className: "text-green-400 bg-green-400/10" },
  cancelled: { label: "취소",     className: "text-red-400 bg-red-400/10" },
};

const NEXT_STATUS: Record<string, { key: string; label: string } | null> = {
  pending:   { key: "confirmed", label: "배송준비" },
  confirmed: { key: "shipped",   label: "배송중" },
  shipped:   { key: "delivered", label: "배송완료" },
  delivered: null,
  cancelled: null,
};

export function AdminIpnakBallOrdersTab() {
  const toast = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [savingTracking, setSavingTracking] = useState<string | null>(null);

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ipnak-ball/orders");
      const data = await res.json();
      const list = data.orders ?? [];
      setOrders(list);
      // 초기 송장번호 inputs 세팅
      const inputs: Record<string, string> = {};
      for (const o of list) {
        inputs[o.id] = o.trackingNumber ?? "";
      }
      setTrackingInputs(inputs);
    } catch {
      toast("주문 목록 조회에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchOrders(); }, []);

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    try {
      const res = await fetch("/api/admin/ipnak-ball/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "변경 실패");
      toast("상태가 변경되었습니다.", "success");
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUpdating(null);
    }
  }

  async function saveTracking(order: any) {
    const trackingNumber = trackingInputs[order.id] ?? "";
    setSavingTracking(order.id);
    try {
      const res = await fetch("/api/admin/ipnak-ball/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status: order.status, trackingNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast("송장번호가 저장되었습니다.", "success");
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, trackingNumber } : o));
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSavingTracking(null);
    }
  }

  async function cancelOrder(id: string) {
    if (!confirm("이 주문을 취소하시겠습니까?")) return;
    await changeStatus(id, "cancelled");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-navy-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-navy-500">총 {orders.length}건</p>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-500 hover:border-navy-300"
        >
          <RefreshCw size={12} />
          새로고침
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="py-12 text-center text-navy-400">주문 내역이 없습니다.</p>
      ) : (
        <>
          {/* PC 테이블 */}
          <div className="hidden md:block">
            <Table head={["주문일시", "구매자", "상품", "금액", "상태", "송장번호", "관리"]}>
              {orders.map((o) => {
                const st = STATUS_MAP[o.status] ?? { label: o.status, className: "text-navy-400 bg-navy-100/10" };
                const next = NEXT_STATUS[o.status];
                const isShipped = o.status === "shipped";
                return (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-navy-400">
                      {kstFormat(new Date(o.createdAt), "yyyy.MM.dd HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-navy-800">{o.userNickname ?? "—"}</p>
                      <p className="text-xs text-navy-400">{o.userEmail ?? ""}</p>
                      <p className="text-xs text-navy-400">{o.addressName} · {o.phone}</p>
                      <p className="mt-0.5 text-xs text-navy-400">{o.address} {o.addressDetail}</p>
                      {o.memo && <p className="mt-0.5 text-xs text-navy-300 italic">메모: {o.memo}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-navy-700">{o.productName ?? "—"}</p>
                      <p className="text-xs text-navy-400">{o.quantity}개</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-navy-800">
                      {won(o.totalPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.className}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isShipped ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="송장번호 입력"
                            value={trackingInputs[o.id] ?? ""}
                            onChange={(e) =>
                              setTrackingInputs((prev) => ({ ...prev, [o.id]: e.target.value }))
                            }
                            className="w-28 rounded border border-navy-100 bg-[#0d1b2a] px-2 py-1 text-xs text-navy-700 outline-none focus:border-orange-400/70"
                          />
                          <button
                            disabled={savingTracking === o.id}
                            onClick={() => saveTracking(o)}
                            className="flex items-center gap-0.5 rounded bg-orange-500/15 px-1.5 py-1 text-xs font-bold text-orange-400 hover:bg-orange-500/25 disabled:opacity-50"
                          >
                            {savingTracking === o.id
                              ? <Loader2 size={10} className="animate-spin" />
                              : <Save size={10} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-navy-400">{o.trackingNumber || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {next && (
                          <button
                            disabled={updating === o.id}
                            onClick={() => changeStatus(o.id, next.key)}
                            className="flex items-center gap-1 rounded-lg bg-orange-500/15 px-2.5 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/25 disabled:opacity-50"
                          >
                            {updating === o.id
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Truck size={11} />}
                            {next.label}
                          </button>
                        )}
                        {o.status !== "cancelled" && o.status !== "delivered" && (
                          <button
                            disabled={updating === o.id}
                            onClick={() => cancelOrder(o.id)}
                            className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>

          {/* 모바일 카드 */}
          <div className="space-y-3 md:hidden">
            {orders.map((o) => {
              const st = STATUS_MAP[o.status] ?? { label: o.status, className: "text-navy-400 bg-navy-100/10" };
              const next = NEXT_STATUS[o.status];
              const isShipped = o.status === "shipped";
              return (
                <div key={o.id} className="rounded-2xl border border-navy-100 bg-white p-3 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-navy-400">
                        {kstFormat(new Date(o.createdAt), "yyyy.MM.dd HH:mm")}
                      </p>
                      <p className="font-semibold text-navy-800">{o.userNickname ?? "—"}</p>
                      <p className="text-xs text-navy-500">{o.productName ?? "—"} · {o.quantity}개</p>
                      <p className="text-xs text-navy-400">{o.addressName} · {o.phone}</p>
                      <p className="text-xs text-navy-400">{o.address} {o.addressDetail}</p>
                      {o.memo && <p className="mt-0.5 text-xs text-navy-300 italic">메모: {o.memo}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-navy-800">{won(o.totalPrice)}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.className}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  {/* 송장번호 (모바일) */}
                  {isShipped && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="송장번호 입력"
                        value={trackingInputs[o.id] ?? ""}
                        onChange={(e) =>
                          setTrackingInputs((prev) => ({ ...prev, [o.id]: e.target.value }))
                        }
                        className="flex-1 rounded border border-navy-100 bg-[#0d1b2a] px-2 py-1 text-xs text-navy-700 outline-none focus:border-orange-400/70"
                      />
                      <button
                        disabled={savingTracking === o.id}
                        onClick={() => saveTracking(o)}
                        className="flex items-center gap-1 rounded bg-orange-500/15 px-2 py-1 text-xs font-bold text-orange-400 disabled:opacity-50"
                      >
                        {savingTracking === o.id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                        저장
                      </button>
                    </div>
                  )}
                  {!isShipped && o.trackingNumber && (
                    <p className="mt-1 text-xs text-navy-400">송장: {o.trackingNumber}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    {next && (
                      <button
                        disabled={updating === o.id}
                        onClick={() => changeStatus(o.id, next.key)}
                        className="flex items-center gap-1 rounded-lg bg-orange-500/15 px-2.5 py-1.5 text-xs font-bold text-orange-400 disabled:opacity-50"
                      >
                        {updating === o.id ? <Loader2 size={11} className="animate-spin" /> : <Truck size={11} />}
                        {next.label}
                      </button>
                    )}
                    {o.status !== "cancelled" && o.status !== "delivered" && (
                      <button
                        disabled={updating === o.id}
                        onClick={() => cancelOrder(o.id)}
                        className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-400 disabled:opacity-50"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
