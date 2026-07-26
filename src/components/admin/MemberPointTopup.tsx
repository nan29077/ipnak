"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Coins, Loader2, X, Plus, Minus, PenLine } from "lucide-react";
import { useToast } from "@/components/Toast";

const PRESETS = [1000, 5000, 10000, 50000];
const DEDUCT_PRESETS = [-1000, -5000, -10000];

type Tx = { id: string; type: string; amount: number; balanceAfter: number; description: string; createdAt: string };

const TYPE_LABEL: Record<string, string> = {
  EARN: "적립", CHARGE: "충전", GIFT_RECEIVED: "선물받음", REFUND: "환불", ADMIN: "관리자지급",
  SPEND: "사용", GIFT_SENT: "선물보냄",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 관리자: 특정 회원 포인트 지급/차감 + 충전·차감 내역 조회
export function MemberPointTopup({ userId, nickname, points }: { userId: string; nickname: string; points: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(1000);
  const [customInput, setCustomInput] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(points);

  const [txs, setTxs] = useState<Tx[]>([]);
  const [filter, setFilter] = useState<"all" | "earn" | "spend">("all");
  const [txLoading, setTxLoading] = useState(false);
  const [totalCharged, setTotalCharged] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  async function loadHistory(f: "all" | "earn" | "spend" = filter) {
    setFilter(f);
    setTxLoading(true);
    try {
      const res = await fetch(`/api/admin/points/history?userId=${userId}&filter=${f}`, { cache: "no-store" });
      const data = await res.json();
      setTxs(data.transactions || []);
      if (data.user) setBalance(data.user.points);
      if (typeof data.totalCharged === "number") setTotalCharged(data.totalCharged);
      if (typeof data.totalSpent === "number") setTotalSpent(data.totalSpent);
    } finally { setTxLoading(false); }
  }

  function openModal() {
    setOpen(true);
    loadHistory("all");
  }

  function applyCustomInput() {
    const v = Math.floor(Number(customInput) || 0);
    if (v !== 0) setAmount(v);
    setCustomInput("");
  }

  async function submit() {
    const finalAmount = customInput.trim() !== "" ? Math.floor(Number(customInput) || 0) : amount;
    if (!finalAmount) { toast("지급할 포인트를 입력하세요", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/points/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: finalAmount, memo }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "처리 실패", "error"); return; }
      toast(`${nickname}님에게 ${finalAmount.toLocaleString()}P ${finalAmount < 0 ? "차감" : "지급"}`, "success");
      setMemo(""); setAmount(1000); setCustomInput("");
      await loadHistory(filter);
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[12px] font-bold text-amber-600 ring-1 ring-amber-400/30 transition-colors hover:bg-amber-400/25"
      >
        <Coins size={13} /> 포인트
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="admin-content fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6" onClick={() => setOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
              <p className="text-[15px] font-bold text-navy-800">{nickname} · 포인트 관리</p>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 text-navy-400 hover:bg-navy-50"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto p-4">
              {/* 잔액 + 누적 요약 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold text-amber-600/70">현재 잔액</p>
                  <p className="text-[15px] font-extrabold text-amber-600">{balance.toLocaleString()}P</p>
                </div>
                <div className="rounded-xl bg-navy-50/60 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold text-navy-400">누적 충전·적립</p>
                  <p className="text-[15px] font-extrabold text-green-600">+{totalCharged.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-navy-50/60 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold text-navy-400">누적 사용</p>
                  <p className="text-[15px] font-extrabold text-navy-500">-{totalSpent.toLocaleString()}</p>
                </div>
              </div>

              {/* 지급/차감 폼 */}
              <div className="mt-4 rounded-xl border border-navy-100 p-3 space-y-3">
                <p className="text-[12px] font-bold text-navy-700">포인트 지급 · 차감</p>

                {/* 빠른 지급 프리셋 */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold text-green-600 uppercase tracking-wide">빠른 지급</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESETS.map((v) => (
                      <button key={v} onClick={() => { setAmount(v); setCustomInput(""); }}
                        className={`rounded-lg border py-2 text-[12px] font-bold transition-all ${amount === v && customInput === "" ? "border-amber-400 bg-amber-50 text-amber-600" : "border-navy-100 bg-navy-50/40 text-navy-500 hover:border-amber-300"}`}>
                        +{v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 빠른 차감 프리셋 */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold text-red-400 uppercase tracking-wide">빠른 차감</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DEDUCT_PRESETS.map((v) => (
                      <button key={v} onClick={() => { setAmount(v); setCustomInput(""); }}
                        className={`rounded-lg border py-2 text-[12px] font-bold transition-all ${amount === v && customInput === "" ? "border-red-400 bg-red-50 text-red-500" : "border-navy-100 bg-navy-50/40 text-navy-500 hover:border-red-300"}`}>
                        {v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 직접 입력 */}
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <PenLine size={12} className="text-amber-500" />
                    <p className="text-[11px] font-bold text-amber-600">직접 입력 (양수=지급, 음수=차감)</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step={100}
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyCustomInput()}
                      placeholder="예: 3000 또는 -2000"
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-[14px] font-bold text-navy-800 outline-none focus:border-amber-400 placeholder:font-normal placeholder:text-navy-300"
                    />
                    <button
                      onClick={applyCustomInput}
                      className="shrink-0 rounded-lg bg-amber-400 px-3 py-2 text-[12px] font-bold text-white hover:bg-amber-500"
                    >
                      적용
                    </button>
                  </div>
                  {customInput.trim() !== "" && Number(customInput) !== 0 && (
                    <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
                      → {Number(customInput) > 0 ? "+" : ""}{Math.floor(Number(customInput) || 0).toLocaleString()}P {Number(customInput) < 0 ? "차감" : "지급"} 예정
                    </p>
                  )}
                </div>

                {/* 현재 선택된 금액 표시 */}
                <div className="rounded-lg bg-navy-50/60 px-3 py-2 flex items-center justify-between">
                  <span className="text-[12px] text-navy-500">최종 지급/차감 금액</span>
                  <span className={`text-[15px] font-extrabold ${
                    (customInput.trim() !== "" ? Number(customInput) : amount) < 0 ? "text-red-500" : "text-amber-600"
                  }`}>
                    {(customInput.trim() !== "" ? Number(customInput) > 0 : amount > 0) ? "+" : ""}
                    {Math.floor(customInput.trim() !== "" ? Number(customInput) || 0 : amount).toLocaleString()}P
                  </span>
                </div>

                <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모(선택)"
                  className="w-full rounded-lg border border-navy-100 bg-white px-3 py-2 text-[13px] text-navy-800 placeholder:text-navy-300 outline-none focus:border-amber-400" />
                <button onClick={submit} disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-[14px] font-extrabold text-[#0d1b2a] disabled:opacity-60 hover:bg-amber-500">
                  {loading
                    ? <Loader2 size={15} className="animate-spin" />
                    : <><Coins size={14} />
                      {Math.floor(customInput.trim() !== "" ? Number(customInput) || 0 : amount).toLocaleString()}P&nbsp;
                      {(customInput.trim() !== "" ? Number(customInput) : amount) < 0 ? "차감" : "지급"}
                      하기
                    </>
                  }
                </button>
              </div>

              {/* 내역 */}
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-1.5">
                  {([["all", "전체"], ["earn", "충전·적립"], ["spend", "사용·차감"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => loadHistory(k)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${filter === k ? "bg-orange-500 text-white" : "bg-navy-50/60 text-navy-400"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {txLoading ? (
                  <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-amber-500" /></div>
                ) : txs.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-navy-300">내역이 없습니다</p>
                ) : (
                  <ul className="divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100">
                    {txs.map((t) => {
                      const pos = t.amount >= 0;
                      return (
                        <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${pos ? "bg-amber-100 text-amber-600" : "bg-navy-50 text-navy-400"}`}>
                            {pos ? <Plus size={12} strokeWidth={2.6} /> : <Minus size={12} strokeWidth={2.6} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-navy-700">{t.description}</span>
                            <span className="text-[10px] text-navy-300">{TYPE_LABEL[t.type] ?? t.type} · {fmt(t.createdAt)}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className={`block text-[12px] font-extrabold ${pos ? "text-amber-600" : "text-navy-500"}`}>{pos ? "+" : ""}{t.amount.toLocaleString()}</span>
                            <span className="block text-[9px] text-navy-300">잔액 {t.balanceAfter.toLocaleString()}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
