import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalance, pointsEnabled, remainingPostRewards, POINT_RULES } from "@/lib/points";
import { PageHeader } from "@/components/ui";
import { PointsManager, type PointTx } from "@/components/PointsManager";

export const dynamic = "force-dynamic";

export default async function MyPointsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const enabled = await pointsEnabled();

  // 포인트 제도 비활성화 시: 서비스 준비 중 페이지 (SUPER_ADMIN은 미리보기 허용)
  if (!enabled && user.role !== "SUPER_ADMIN") {
    return (
      <div className="pb-10">
        <PageHeader title="포인트 관리" back />
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

  const [balance, remainingRewards] = await Promise.all([
    getBalance(user.id),
    remainingPostRewards(user.id),
  ]);
  const rows = await prisma.pointTransaction
    .findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 })
    .catch(() => [] as any[]);

  const transactions: PointTx[] = rows.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="pb-10">
      <PageHeader title="포인트 관리" back />
      <PointsManager
        initialBalance={balance}
        enabled={enabled}
        initialTx={transactions}
        remainingRewards={remainingRewards}
        dailyRewardLimit={POINT_RULES.POST_DAILY_LIMIT}
      />
    </div>
  );
}
