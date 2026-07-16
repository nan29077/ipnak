import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { Badge, EmptyState } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminComments() {
  const comments = await prisma.comment.findMany({
    include: { author: { select: { nickname: true } }, post: { select: { id: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return (
    <div>
      <AdminTitle title="댓글 관리" desc={`총 ${comments.length}개`} />
      <Table head={["작성자", "내용", "대댓글", "상태", "작성일", "관리"]}>
        {comments.length === 0 && (
          <tr><td colSpan={6} className="p-0"><EmptyState title="댓글이 없습니다" /></td></tr>
        )}
        {comments.map((c) => (
          <tr key={c.id} className={c.hidden ? "opacity-50" : ""}>
            <td className="px-4 py-3 font-semibold text-navy-800">{c.author.nickname}</td>
            <td className="max-w-[320px] truncate px-4 py-3 text-navy-600">{c.body}</td>
            <td className="px-4 py-3 text-navy-400">{c.parentId ? "답글" : "-"}</td>
            <td className="px-4 py-3">{c.hidden ? <Badge tone="red">숨김</Badge> : <Badge tone="aqua">공개</Badge>}</td>
            <td className="px-4 py-3 text-navy-400">{format(c.createdAt, "MM.dd HH:mm")}</td>
            <td className="px-4 py-3">
              {c.hidden
                ? <ActionButton payload={{ type: "COMMENT_HIDE", id: c.id, hidden: false }} label="공개" successMsg="공개 처리됨" />
                : <ActionButton payload={{ type: "COMMENT_HIDE", id: c.id, hidden: true }} label="숨김" variant="danger" successMsg="숨김 처리됨" />}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
