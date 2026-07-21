"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, CreditCard, Gift, Plus, Minus, Loader2, Lock } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Sheet } from "@/components/ui";
import { notifyPointsChanged } from "@/components/PointsBadge";
import { ChargePanel } from "@/components/ChargePanel";
import { cn } from "@/lib/utils";

export type PointTx = {
  id: string; type: string; amount: number; balanceAfter: number; description: string; createdAt: string;
};

const TYPE_META: Record<string, { label: string; tone: "earn" | "spend" }> = {
  EARN: { label: "적립", tone: "earn" },
  CHARGE: { label: "충전", tone: "earn" },
  GIFT_RECEIVED: { label: "선물 받음", tone: "earn" },
  REFUND: { label: "환불", tone: "earn" },
  ADMIN: { label: "관리자 지급", tone: "earn" },
  SPEND: { label: "사용", tone: "spend" },
  GIFT_SENT: { label: "선물 보냄", tone: "spend" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PointsManager({
  initialBalance, enabled, initialTx,
}: { initialBalance: number; enabled: boolean; initialTx: PointTx[] }) {
  const router = useRouter();
  const toast = useToast();
  const [balance, setBalance] = useState(initialBalance);
  const [txs, setTxs] = useState<PointTx[]>(initialTx);
  const [filter, setFilter] = useState<"all" | "earn" | "spend">("all");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);

  async function reloadTx(f: "all" | "earn" | "spend") {
    setFilter(f);
    try {
      const res = await fetch(`/api/points/transactions?filter=${f}`, { cache: "no-store" });
      const data = await res.json();
      setTxs(data.transactions || []);
    } catch { /* noop */ }
  }

  function afterChange(newBalance?: number) {
    if (typeof newBalance === "number") setBalance(newBalance);
    notifyPointsChanged();
    reloadTx(filter);
    router.refresh();
  }

  return (
    <div className="px-4 pb-10">
      {/* 잔액 카드 */}
      <div className="mt-3 overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.12] via-[#1a1712] to-[#161616] p-5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-300/80">
          <Coins size={14} /> 보유 포인트
        </p>
        <p className="mt-1 flex items-end gap-1">
          <span className="text-[34px] font-extrabold leading-none tabular-nums text-amber-300">{balance.toLocaleString()}</span>
          <span className="pb-1 text-[15px] font-bold text-amber-300/70">P</span>
        </p>
        {!enabled && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-navy-300">
            <Lock size={11} /> 포인트 기능이 현재 비활성화되어 있습니다
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setChargeOpen(true)}
            disabled={!enabled}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-amber-400 py-3 text-[14px] font-extrabold text-[#161616] shadow-soft transition-transform active:scale-95 disabled:opacity-40"
          >
            <CreditCard size={16} strokeWidth={2.2} /> 충전하기
          </button>
          <button
            onClick={() => setGiftOpen(true)}
            disabled={!enabled}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] py-3 text-[14px] font-bold text-navy-800 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1] disabled:opacity-40"
          >
            <Gift size={16} strokeWidth={2} /> 친구에게 선물
          </button>
        </div>
      </div>

      {/* 적립/사용 안내 */}
      <div className="mt-4 rounded-2xl border border-navy-100/20 bg-[#1a1a1a] p-4">
        <p className="text-[13px] font-bold text-navy-800">포인트 적립·사용 안내</p>
        <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-navy-400">
          <li>• 신용카드 등으로 충전 (10,000원 = 10,000P)</li>
          <li>• 각종 피드 글 올리기 — 하루 최대 5회, 회당 100P</li>
          <li>• 내 워킹 피드를 다른 회원이 열람 시 100P 적립</li>
          <li>• 워킹 피드 열람 시 200P 사용</li>
          <li>• 낚시단 개설 10,000P · 가입 신청 1,000P (유료 개설 시)</li>
        </ul>
      </div>

      {/* 내역 */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-1.5">
          {([["all", "전체"], ["earn", "적립"], ["spend", "사용"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => reloadTx(k)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors",
                filter === k ? "bg-orange-500 text-white" : "bg-navy-50/10 text-navy-400 hover:bg-navy-50/20",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {txs.length === 0 ? (
          <div className="rounded-2xl border border-navy-100/20 bg-[#1a1a1a] py-10 text-center text-[13px] text-navy-300">
            포인트 내역이 없습니다
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-navy-100/20 bg-[#1a1a1a]">
            {txs.map((t) => {
              const meta = TYPE_META[t.type] ?? { label: t.type, tone: t.amount >= 0 ? "earn" : "spend" };
              const positive = t.amount >= 0;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", positive ? "bg-amber-400/12 text-amber-300" : "bg-navy-50/10 text-navy-400")}>
                    {positive ? <Plus size={16} strokeWidth={2.4} /> : <Minus size={16} strokeWidth={2.4} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-navy-800">{t.description}</p>
                    <p className="text-[11px] text-navy-300">{meta.label} · {fmtDate(t.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-[14px] font-extrabold tabular-nums", positive ? "text-amber-300" : "text-navy-500")}>
                      {positive ? "+" : ""}{t.amount.toLocaleString()}P
                    </p>
                    <p className="text-[10px] text-navy-300">잔액 {t.balanceAfter.toLocaleString()}P</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ChargeSheet open={chargeOpen} onClose={() => setChargeOpen(false)} onDone={afterChange} />
      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} balance={balance} onDone={afterChange} />
    </div>
  );
}

function ChargeSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (b?: number) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="포인트 충전">
      <ChargePanel onCharged={(bal) => { onDone(bal); onClose(); }} />
    </Sheet>
  );
}

function GiftSheet({ open, onClose, balance, onDone }: { open: boolean; onClose: () => void; balance: number; onDone: (b?: number) => void }) {
  const toast = useToast();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState<number>(1000);
  const [loading, setLoading] = useState(false);

  async function gift() {
    if (!to.trim()) { toast("선물할 친구의 아이디(닉네임/이메일)를 입력해주세요", "error"); return; }
    if (amount <= 0) { toast("선물할 포인트를 입력해주세요", "error"); return; }
    if (amount > balance) { toast("보유 포인트가 부족합니다", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/points/gift", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: to.trim(), amount }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "선물 실패", "error"); return; }
      toast(`${data.toNickname ?? to}님에게 ${amount.toLocaleString()}P를 선물했어요`, "success");
      setTo(""); setAmount(1000);
      onDone(data.balance);
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="친구에게 포인트 선물">
      <p className="text-[12px] text-navy-400">친구의 아이디(닉네임 또는 이메일)를 입력하고 선물할 포인트를 입력하세요.</p>
      <label className="mt-3 block text-[12px] font-semibold text-navy-400">친구 아이디</label>
      <input
        value={to} onChange={(e) => setTo(e.target.value)} placeholder="닉네임 또는 이메일"
        className="mt-1 w-full rounded-xl border border-navy-100/20 bg-navy-50/10 px-4 py-2.5 text-[14px] text-navy-800 placeholder:text-navy-300 outline-none focus:border-amber-400/50"
      />
      <label className="mt-3 block text-[12px] font-semibold text-navy-400">선물할 포인트</label>
      <input
        type="number" min={0} step={100} value={amount}
        onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="mt-1 w-full rounded-xl border border-navy-100/20 bg-navy-50/10 px-4 py-2.5 text-[14px] text-navy-800 outline-none focus:border-amber-400/50"
      />
      <p className="mt-1 text-[11px] text-navy-300">보유 {balance.toLocaleString()}P</p>
      <button
        onClick={gift}
        disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-extrabold text-white shadow-soft disabled:opacity-60"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <><Gift size={17} /> 선물하기</>}
      </button>
    </Sheet>
  );
}
