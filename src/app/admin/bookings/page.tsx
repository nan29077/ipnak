import { prisma } from "@/lib/prisma";
import { AdminTitle, Table, StatusBadge } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { won } from "@/lib/utils";
import { kstFormat } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminBookings() {
  const bookings = await prisma.booking.findMany({
    include: { listing: { select: { name: true } }, user: { select: { nickname: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return (
    <div>
      <AdminTitle title="예약 내역 관리" desc={`총 ${bookings.length}건`} />

      {/* PC 테이블 */}
      <div className="hidden md:block">
        <Table head={["예약자", "상품", "날짜", "인원", "금액", "상태", "관리"]}>
          {bookings.length === 0 && (
            <tr><td colSpan={7} className="p-0"><EmptyState title="예약 내역이 없습니다" /></td></tr>
          )}
          {bookings.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3 font-semibold text-navy-800">{b.user.nickname}</td>
              <td className="max-w-[180px] truncate px-4 py-3 text-navy-500">{b.listing.name}</td>
              <td className="px-4 py-3 text-navy-400">{kstFormat(b.date, "MM.dd")}</td>
              <td className="px-4 py-3 text-navy-500">{b.people}명</td>
              <td className="px-4 py-3 text-navy-600">{won(b.totalPrice)}</td>
              <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {b.status === "REQUESTED" && <ActionButton payload={{ type: "BOOKING_STATUS", id: b.id, status: "CONFIRMED" }} label="확정" variant="primary" successMsg="확정되었습니다" />}
                  {b.status !== "CANCELLED" && b.status !== "DONE" && <ActionButton payload={{ type: "BOOKING_STATUS", id: b.id, status: "CANCELLED" }} label="취소" variant="danger" successMsg="취소되었습니다" />}
                  {b.status === "CONFIRMED" && <ActionButton payload={{ type: "BOOKING_STATUS", id: b.id, status: "DONE" }} label="이용완료" successMsg="처리되었습니다" />}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* 모바일 카드 목록 */}
      <div className="space-y-3 md:hidden">
        {bookings.length === 0 && <EmptyState title="예약 내역이 없습니다" />}
        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl border border-navy-100 bg-white px-3 py-3 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy-800">{b.listing.name}</p>
                <p className="mt-0.5 text-[12px] text-navy-400">예약자: {b.user.nickname}</p>
              </div>
              <StatusBadge status={b.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-navy-500">
              <span>날짜: {kstFormat(b.date, "MM.dd")}</span>
              <span>{b.people}명</span>
              <span className="font-semibold text-navy-700">{won(b.totalPrice)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {b.status === "REQUESTED" && <ActionButton payload={{ type: "BOOKING_STATUS", id: b.id, status: "CONFIRMED" }} label="확정" variant="primary" successMsg="확정되었습니다" />}
              {b.status !== "CANCELLED" && b.status !== "DONE" && <ActionButton payload={{ type: "BOOKING_STATUS", id: b.id, status: "CANCELLED" }} label="취소" variant="danger" successMsg="취소되었습니다" />}
              {b.status === "CONFIRMED" && <ActionButton payload={{ type: "BOOKING_STATUS", id: b.id, status: "DONE" }} label="이용완료" successMsg="처리되었습니다" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
