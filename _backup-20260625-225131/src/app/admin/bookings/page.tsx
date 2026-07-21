import { prisma } from "@/lib/prisma";
import { AdminTitle, Table, StatusBadge } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { won } from "@/lib/utils";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminBookings() {
  const bookings = await prisma.booking.findMany({
    include: { listing: { select: { name: true } }, user: { select: { nickname: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return (
    <div>
      <AdminTitle title="예약 내역 관리" desc={`총 ${bookings.length}건`} />
      <Table head={["예약자", "상품", "날짜", "인원", "금액", "상태", "관리"]}>
        {bookings.length === 0 && (
          <tr><td colSpan={7} className="p-0"><EmptyState title="예약 내역이 없습니다" /></td></tr>
        )}
        {bookings.map((b) => (
          <tr key={b.id}>
            <td className="px-4 py-3 font-semibold text-navy-800">{b.user.nickname}</td>
            <td className="max-w-[180px] truncate px-4 py-3 text-navy-500">{b.listing.name}</td>
            <td className="px-4 py-3 text-navy-400">{format(b.date, "MM.dd")}</td>
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
  );
}
