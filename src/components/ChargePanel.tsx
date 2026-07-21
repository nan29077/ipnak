"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Coins } from "lucide-react";
import { useToast } from "@/components/Toast";
import { MockPayModal } from "@/components/MockPayModal";
import { notifyPointsChanged } from "@/components/PointsBadge";
import { cn } from "@/lib/utils";

// 충전 금액 선택 UI (1원 = 1P). 마이페이지 포인트 관리 · 충전 페이지 공용.
const PRESETS = [1000, 5000, 10000, 30000, 50000, 100000];

export function ChargePanel({
  onCharged, redirectToManage = false,
}: {
  // 충전 성공 시 부모에 새 잔액 전달(모달/인라인 사용처). 없으면 페이지 단독 사용으로 간주.
  onCharged?: (balance: number) => void;
  // 페이지 단독 사용 시 성공 후 포인트 관리로 이동
  redirectToManage?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState<number>(10000);
  const [payOpen, setPayOpen] = useState(false);

  function proceed() {
    if (!amount || amount < 100) { toast("최소 100원부터 충전할 수 있어요", "error"); return; }
    setPayOpen(true);
  }

  function done(balance: number) {
    setPayOpen(false);
    toast(`${amount.toLocaleString()}P를 충전했어요`, "success");
    notifyPointsChanged();
    onCharged?.(balance);
    router.refresh();
    if (redirectToManage) router.push("/me/points");
  }

  return (
    <div>
      <p className="text-[12px] text-navy-400">충전할 금액을 선택하세요. <b className="text-navy-600">10,000원 = 10,000P</b> (1원 = 1P)</p>

      {/* 금액 선택 버튼 */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PRESETS.map((v) => {
          const on = amount === v;
          return (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl border py-3 transition-all",
                on ? "border-amber-400 bg-amber-400/10" : "border-navy-100/20 bg-navy-50/10 hover:border-navy-100/40",
              )}
            >
              <span className={cn("text-[15px] font-extrabold", on ? "text-amber-300" : "text-navy-700")}>{v.toLocaleString()}P</span>
              <span className="text-[11px] font-medium text-navy-300">₩{v.toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      {/* 직접 입력 */}
      <label className="mt-4 block text-[12px] font-semibold text-navy-400">직접 입력 (원)</label>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number" min={0} step={1000} value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="w-full rounded-xl border border-navy-100/20 bg-navy-50/10 px-4 py-2.5 pr-10 text-[15px] font-bold text-navy-800 outline-none focus:border-amber-400/50"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-navy-300">원</span>
        </div>
        <span className="shrink-0 rounded-xl bg-amber-400/10 px-3 py-2.5 text-[14px] font-extrabold text-amber-300">= {amount.toLocaleString()}P</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-navy-50/10 px-3 py-2 text-[11px] text-navy-400">
        <CreditCard size={13} /> 신용카드 등 결제(PG) 연동은 준비 중이며, 현재는 테스트 결제로 즉시 충전됩니다.
      </div>

      <button
        onClick={proceed}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-extrabold text-white shadow-soft transition-colors hover:bg-orange-600"
      >
        <Coins size={17} /> {amount.toLocaleString()}P 충전하기
      </button>

      <MockPayModal open={payOpen} amount={amount} onClose={() => setPayOpen(false)} onSuccess={done} />
    </div>
  );
}
