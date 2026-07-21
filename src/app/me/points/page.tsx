import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalance, pointsEnabled } from "@/lib/points";
import { PageHeader } from "@/components/ui";
import { PointsManager, type PointTx } from "@/components/PointsManager";

export const dynamic = "force-dynamic";

export default async function MyPointsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [enabled, balance] = await Promise.all([pointsEnabled(), getBalance(user.id)]);
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
      <PointsManager initialBalance={balance} enabled={enabled} initialTx={transactions} />
    </div>
  );
}
