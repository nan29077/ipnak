import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getBalance, pointsEnabled } from "@/lib/points";
import { PageHeader } from "@/components/ui";
import { ChargePanel } from "@/components/ChargePanel";

export const dynamic = "force-dynamic";

export default async function ChargePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [enabled, balance] = await Promise.all([pointsEnabled(), getBalance(user.id)]);

  return (
    <div className="pb-10">
      <PageHeader title="포인트 충전" back />
      <div className="px-4">
        {/* 현재 보유 */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/[0.12] to-[#161616] px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-[#161616] shadow-soft"><Coins size={19} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-navy-400">현재 보유 포인트</p>
            <p className="text-[20px] font-extrabold tabular-nums text-amber-300">{balance.toLocaleString()}<span className="text-[13px] text-amber-300/70">P</span></p>
          </div>
        </div>

        {!enabled && (
          <div className="mt-3 rounded-xl bg-amber-400/10 px-4 py-2.5 text-[12px] font-semibold text-amber-300 ring-1 ring-amber-400/20">
            포인트 기능이 비활성화되어 있어 지금은 충전할 수 없습니다.
          </div>
        )}

        <div className="mt-4">
          {enabled ? <ChargePanel redirectToManage /> : null}
        </div>
      </div>
    </div>
  );
}
