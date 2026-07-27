import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { AdminTitle, StatusBadge, Table } from "@/components/admin/ui";
import { BallPriceForm, BallStatusActions } from "@/components/admin/IpnakBallAdminActions";
import { IpnakBallProductForm, IpnakBallProductToggle } from "@/components/admin/IpnakBallProductForm";
import { cn, kstFormat } from "@/lib/utils";
export const dynamic = "force-dynamic";

const tabs = [
  { key: "requests", label: "구매 요청" },
  { key: "orders", label: "주문 관리" },
  { key: "payments", label: "결제 관리" },
  { key: "shipping", label: "배송 관리" },
  { key: "products", label: "상품 관리" },
  { key: "price", label: "가격 설정" },
];

export default async function BallAdmin({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = tabs.some(t => t.key === searchParams.tab) ? searchParams.tab! : "requests";
  const price = Number(await getSetting("ipnak_ball_price"));
  const where = tab === "requests" ? { status: { in: ["REQUESTED", "PAID"] } } : tab === "payments" ? { paymentStatus: { in: ["READY", "PAID", "CANCELLED", "REFUNDED"] } } : tab === "shipping" ? { status: { in: ["PREPARING", "SHIPPED", "DELIVERED"] } } : {};
  const orders = (tab === "price" || tab === "products") ? [] : await prisma.ballOrder.findMany({ where, include: { user: { select: { nickname: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  const products = tab === "products" ? await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "IpnakBallProduct" ORDER BY "createdAt" DESC`) : [];

  return (
    <div>
      <AdminTitle title="입낚볼 관리" desc="구매 요청부터 결제 승인, 주문 처리, 배송 완료까지 통합 관리합니다." />
      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-navy-100">
        {tabs.map(t => (
          <Link key={t.key} href={`/admin/ipnak-ball?tab=${t.key}`} className={cn("border-b-2 px-3 py-2.5 text-[13px] font-semibold", tab === t.key ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400")}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "price" && <BallPriceForm initial={price} />}

      {tab === "products" && (
        <div className="space-y-5">
          {products.length === 0 ? (
            <IpnakBallProductForm />
          ) : (
            <div className="rounded-xl border border-orange-400/30 bg-orange-500/5 px-4 py-3 text-sm text-orange-400">
              상품이 이미 1개 등록되어 있습니다. 입낚볼 상품은 1개만 유지할 수 있습니다. 기존 상품을 수정하거나 비활성화 후 삭제하세요.
            </div>
          )}
          <div>
            <p className="mb-3 text-sm font-bold text-navy-600">등록된 상품 ({products.length}개)</p>
            {products.length === 0 ? (
              <p className="py-8 text-center text-navy-400">등록된 상품이 없습니다.</p>
            ) : (
              <Table head={["상품명", "가격", "재고", "이미지", "상태", "등록일", "관리"]}>
                {products.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-navy-800">{p.name}</p>
                      {p.description && <p className="text-xs text-navy-400 mt-0.5">{p.description}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-navy-800">{Number(p.price).toLocaleString()}원</td>
                    <td className="px-4 py-3 text-navy-700">{p.stock}개</td>
                    <td className="px-4 py-3">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="h-12 w-12 rounded-lg object-cover border border-navy-100" />
                        : <span className="text-xs text-navy-300">없음</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-navy-400">{String(p.createdAt).slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <IpnakBallProductToggle id={p.id} isActive={Boolean(p.isActive)} stock={p.stock} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      )}

      {tab !== "price" && tab !== "products" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Summary label="조회 주문" value={`${orders.length}건`} />
            <Summary label="결제 금액" value={`${orders.filter(o => o.paymentStatus === "PAID").reduce((s, o) => s + o.totalPrice, 0).toLocaleString()}원`} />
            <Summary label="배송 준비" value={`${orders.filter(o => o.status === "PREPARING").length}건`} />
            <Summary label="배송 중" value={`${orders.filter(o => o.status === "SHIPPED").length}건`} />
          </div>
          <Table head={["주문번호·일시", "구매자", "배송지", "상품금액", "결제", "주문/배송", "관리"]}>
            {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-navy-400">해당 내역이 없습니다.</td></tr>}
            {orders.map(o => (
              <tr key={o.id}>
                <td className="whitespace-nowrap px-4 py-3"><p className="font-semibold text-navy-800">{o.orderNo}</p><p className="text-xs text-navy-400">{kstFormat(o.createdAt, "yyyy.MM.dd HH:mm")}</p></td>
                <td className="px-4 py-3"><p>{o.buyerName} · {o.buyerPhone}</p><p className="text-xs text-navy-400">{o.user.nickname} ({o.user.email})</p></td>
                <td className="max-w-[260px] px-4 py-3 text-xs"><p>{o.recipientName} · {o.recipientPhone}</p><p className="mt-0.5 text-navy-400">({o.postalCode}) {o.address} {o.addressDetail}</p>{o.trackingNumber && <p className="mt-1 text-aqua-400">{o.carrier} {o.trackingNumber}</p>}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold">{o.totalPrice.toLocaleString()}원<p className="text-xs font-normal text-navy-400">{o.quantity}개 × {o.unitPrice.toLocaleString()}</p></td>
                <td className="px-4 py-3"><StatusBadge status={o.paymentStatus} /><p className="mt-1 text-xs text-navy-400">{o.paymentMethod || "-"}</p></td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3"><BallStatusActions id={o.id} status={o.status} /></td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><p className="text-xs text-navy-400">{label}</p><p className="mt-1 text-xl font-extrabold text-navy-800">{value}</p></div>;
}
