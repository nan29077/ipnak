import Link from "next/link";
import { Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { reservationCategoryLabel } from "@/lib/taxonomy";
import { won } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminListings() {
  const listings = await prisma.reservationListing.findMany({
    include: { _count: { select: { bookings: true } } }, orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <AdminTitle title="예약 상품 관리" desc={`총 ${listings.length}개`} />

      {/* PC 테이블 */}
      <div className="hidden md:block">
        <Table head={["사진", "상품명", "카테고리", "지역", "가격", "예약수", "평점", "관리"]}>
          {listings.length === 0 && (
            <tr><td colSpan={8} className="p-0"><EmptyState title="예약 상품이 없습니다" /></td></tr>
          )}
          {listings.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-3"><img src={l.imageUrl || ""} alt="" className="h-10 w-14 rounded-lg object-cover" /></td>
              <td className="px-4 py-3 font-semibold text-navy-800">{l.name}</td>
              <td className="px-4 py-3 text-navy-500">{reservationCategoryLabel(l.category)}</td>
              <td className="px-4 py-3 text-navy-500">{l.region}</td>
              <td className="px-4 py-3 text-navy-600">{won(l.price)}</td>
              <td className="px-4 py-3 text-navy-500">{l._count.bookings}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 text-navy-500">
                  <Star size={14} className="fill-amber-400 text-amber-400" /> {l.rating}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  <Link href={`/reservations/${l.id}`} className="rounded-lg bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-700">보기</Link>
                  <ActionButton payload={{ type: "LISTING_DELETE", id: l.id }} label="삭제" variant="danger" confirm="이 상품을 삭제할까요?" successMsg="삭제되었습니다" />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* 모바일 카드 목록 */}
      <div className="space-y-3 md:hidden">
        {listings.length === 0 && <EmptyState title="예약 상품이 없습니다" />}
        {listings.map((l) => (
          <div key={l.id} className="rounded-2xl border border-navy-100 bg-white px-3 py-3 shadow-card">
            <div className="flex items-start gap-3">
              {l.imageUrl && <img src={l.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-800">{l.name}</p>
                <p className="mt-0.5 text-[12px] text-navy-500">{reservationCategoryLabel(l.category)} · {l.region}</p>
                <div className="mt-0.5 flex items-center gap-3 text-[12px] text-navy-500">
                  <span className="font-semibold text-navy-700">{won(l.price)}</span>
                  <span>예약 {l._count.bookings}</span>
                  <span className="inline-flex items-center gap-0.5"><Star size={12} className="fill-amber-400 text-amber-400" /> {l.rating}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Link href={`/reservations/${l.id}`} className="rounded-lg bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-700">보기</Link>
              <ActionButton payload={{ type: "LISTING_DELETE", id: l.id }} label="삭제" variant="danger" confirm="이 상품을 삭제할까요?" successMsg="삭제되었습니다" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
