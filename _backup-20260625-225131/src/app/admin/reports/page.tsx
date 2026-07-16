import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Table, StatusBadge } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminReports() {
  const reports = await prisma.report.findMany({
    include: { reporter: { select: { nickname: true } }, post: { select: { id: true, caption: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100,
  });
  return (
    <div>
      <AdminTitle title="신고 관리" desc={`총 ${reports.length}건`} />
      <Table head={["신고자", "유형", "사유", "대상", "상태", "신고일", "관리"]}>
        {reports.length === 0 && (
          <tr><td colSpan={7} className="p-0"><EmptyState title="신고 내역이 없습니다" desc="새로운 신고가 들어오면 여기에 표시됩니다." /></td></tr>
        )}
        {reports.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3 font-semibold text-navy-800">{r.reporter.nickname}</td>
            <td className="px-4 py-3 text-navy-500">{r.targetType}</td>
            <td className="px-4 py-3 text-navy-600">{r.reason}</td>
            <td className="max-w-[180px] truncate px-4 py-3 text-navy-400">
              {r.post ? <Link href={`/post/${r.post.id}`} className="text-navy-500 underline">{r.post.caption || "게시글"}</Link> : "-"}
            </td>
            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            <td className="px-4 py-3 text-navy-400">{format(r.createdAt, "MM.dd")}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1.5">
                {r.post && <ActionButton payload={{ type: "POST_HIDE", id: r.post.id, hidden: true }} label="게시글 숨김" variant="danger" />}
                {r.status === "PENDING" && <>
                  <ActionButton payload={{ type: "REPORT_STATUS", id: r.id, status: "RESOLVED" }} label="처리완료" variant="primary" successMsg="처리되었습니다" />
                  <ActionButton payload={{ type: "REPORT_STATUS", id: r.id, status: "REJECTED" }} label="반려" successMsg="반려되었습니다" />
                </>}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
