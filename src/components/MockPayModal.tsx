"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Landmark, Smartphone, Loader2, ShieldCheck, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type PayMethod = "card" | "transfer" | "phone";
const METHODS: { key: PayMethod; label: string; icon: any }[] = [
  { key: "card", label: "신용·체크카드", icon: CreditCard },
  { key: "transfer", label: "계좌이체", icon: Landmark },
  { key: "phone", label: "휴대폰 결제", icon: Smartphone },
];

// PG 결제창 mock — 실제 PG(토스페이먼츠 등) 연동은 추후. 지금은 테스트 승인으로 즉시 충전.
// 특정 결제사 브랜드를 모사하지 않는 일반 결제 시트 형태이며, 실제 청구가 발생하지 않는다.
export function MockPayModal({
  open, amount, onClose, onSuccess,
}: { open: boolean; amount: number; onClose: () => void; onSuccess: (balance: number) => void }) {
  const toast = useToast();
  const [method, setMethod] = useState<PayMethod>("card");
  const [loading, setLoading] = useState(false);

  if (!open || typeof document === "undefined") return null;

  async function pay() {
    setLoading(true);
    try {
      // TODO: 실제 PG 결제 승인 연동 지점 — 승인 성공 시에만 /api/points/charge 호출
      const res = await fetch("/api/points/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "결제에 실패했습니다", "error"); return; }
      onSuccess(data.balance);
    } catch {
      toast("결제에 실패했습니다", "error");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 px-0 backdrop-blur-[3px] sm:items-center sm:px-5">
      <div
        className="w-full max-w-[400px] overflow-hidden rounded-t-[24px] shadow-2xl ring-1 ring-aqua-500/20 sm:rounded-[24px]"
        style={{ background: "linear-gradient(160deg,#0c1e2e 0%,#141b22 100%)" }}
      >
        {/* 상단 바 */}
        <div className="h-[3px] w-full bg-gradient-to-r from-aqua-700/40 via-aqua-400 to-orange-400/60" />
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="flex items-center gap-1.5 text-[14px] font-bold text-white">
            <ShieldCheck size={16} className="text-aqua-400" /> 포인트 결제
          </p>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* 결제 금액 */}
        <div className="px-5 pb-1 pt-4 text-center">
          <p className="text-[12px] text-white/45">결제 금액</p>
          <p className="mt-1 text-[30px] font-extrabold leading-none text-white">
            ₩{amount.toLocaleString()}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-amber-300">{amount.toLocaleString()}P 충전</p>
        </div>

        {/* 결제 수단 */}
        <div className="px-5 pt-4">
          <p className="mb-2 text-[12px] font-semibold text-white/50">결제 수단</p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => {
              const on = method === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[11px] font-semibold transition-all",
                    on ? "border-aqua-400 bg-aqua-500/10 text-aqua-300" : "border-white/10 bg-white/[0.03] text-white/50",
                  )}
                >
                  <Icon size={19} strokeWidth={1.8} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 테스트 안내 */}
        <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 text-[11px] leading-relaxed text-white/55">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-aqua-400" />
          <span>PG 결제 연동 준비 중인 <b className="text-white/80">테스트 결제</b>입니다. 실제 청구·결제가 발생하지 않으며, 즉시 포인트로 충전됩니다.</span>
        </div>

        {/* 버튼 */}
        <div className="p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button
            onClick={pay}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-extrabold text-white shadow-soft transition-colors hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <><CreditCard size={17} /> ₩{amount.toLocaleString()} 결제하기</>}
          </button>
          <button onClick={onClose} className="mt-2 w-full rounded-2xl py-2.5 text-[13px] font-semibold text-white/45 transition-colors hover:text-white/70">
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
