import { PageHeader, Badge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { won, kstFormat } from "@/lib/utils";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ORDER_STATUS: Record<string, { label: string; tone: "navy" | "aqua" | "amber" | "red" | "green" | "gray" }> = {
  PAID: { label: "결제완료", tone: "aqua" },
  SHIPPED: { label: "배송중", tone: "amber" },
  DELIVERED: { label: "배송완료", tone: "green" },
  CANCELLED: { label: "취소", tone: "red" },
};

async function getOrders(userId: string) {
  try {
    // 백틱 식별자 + VARCHAR 타입 — SQLite/MariaDB 양쪽에서 동작 (api/me/orders/route.ts와 동일 DDL)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Order\` (
        \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
        \`userId\` VARCHAR(191) NOT NULL,
        \`productId\` VARCHAR(191) NOT NULL,
        \`productName\` VARCHAR(255) NOT NULL,
        \`price\` INTEGER NOT NULL DEFAULT 0,
        \`quantity\` INTEGER NOT NULL DEFAULT 1,
        \`shippingFee\` INTEGER NOT NULL DEFAULT 0,
        \`totalAmount\` INTEGER NOT NULL DEFAULT 0,
        \`pointsUsed\` INTEGER NOT NULL DEFAULT 0,
        \`shippingAddressId\` VARCHAR(191),
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'PAID',
        \`paymentMethod\` VARCHAR(32) NOT NULL DEFAULT 'CARD',
        \`createdAt\` VARCHAR(64) NOT NULL
      )
    `);
    return await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM \`Order\` WHERE \`userId\` = ? ORDER BY \`createdAt\` DESC`,
      userId,
    );
  } catch {
    return [];
  }
}

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orders = await getOrders(user.id);

  return (
    <div className="pb-10">
      <PageHeader title="구매내역" back />

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#162538]">
            <ShoppingBag size={28} className="text-navy-300" />
          </div>
          <p className="text-navy-400 text-[14px]">구매내역이 없습니다</p>
          <Link href="/shop" className="rounded-xl bg-orange-500 px-5 py-2.5 text-[14px] font-semibold text-gray-900 hover:bg-orange-600">
            쇼핑하러 가기
          </Link>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {orders.map((order: any) => {
            const st = ORDER_STATUS[order.status] ?? { label: order.status, tone: "gray" as const };
            return (
              <div key={order.id} className="rounded-2xl border border-navy-100/20 bg-[#162538] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-navy-800">{order.productName}</p>
                    <p className="mt-0.5 text-[12px] text-navy-400">
                      {order.quantity}개 · {won(order.totalAmount)}
                    </p>
                    {Number(order.pointsUsed) > 0 && (
                      <p className="mt-0.5 text-[11px] text-orange-400">
                        포인트 {Number(order.pointsUsed).toLocaleString()}P 사용 · 실결제 {won(order.totalAmount - Number(order.pointsUsed))}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-navy-300">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : ""}
                    </p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
