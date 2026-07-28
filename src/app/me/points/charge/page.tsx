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
  const enabled = await pointsEnabled();

  // 포인트 제도 비활성화 시: 서비스 준비 중 페이지 (SUPER_ADMIN은 미리보기 허용)
  if (!enabled && user.role !== "SUPER_ADMIN") {
    return (
      <div className="pb-10">
        <PageHeader title="포인트 충전" back />
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-50">
            <Coins size={40} className="text-navy-300" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-lg font-bold text-navy-700">서비스 준비 중입니다.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-navy-400">
              포인트 서비스를 준비하고 있습니다.
              <br />
              조금만 기다려 주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const balance = await getBalance(user.id);

  return (
    <div className="pb-10">
      <PageHeader title="포인트 충전" back />
      <div className="px-4">
        {/* 현재 보유 */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/[0.12] to-[#0d1b2a] px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-[#0d1b2a] shadow-soft"><Coins size={19} /></span>
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
