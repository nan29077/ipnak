import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { CreateForm } from "@/components/admin/CreateForm";
import { Badge, EmptyState } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminBanners() {
  const banners = await prisma.banner.findMany({ orderBy: { order: "asc" } });
  return (
    <div>
      <AdminTitle title="배너 / 공지 관리" desc={`총 ${banners.length}개`} />
      <div className="mb-4">
        <CreateForm actionType="BANNER_CREATE" title="배너 추가" fields={[
          { name: "title", label: "제목", required: true },
          { name: "body", label: "내용" },
          { name: "imageUrl", label: "이미지 URL" },
        ]} />
      </div>
      <Table head={["이미지", "제목", "내용", "상태", "등록일", "관리"]}>
        {banners.length === 0 && (
          <tr><td colSpan={6} className="p-0"><EmptyState title="배너가 없습니다" desc="위 버튼으로 배너를 추가해 보세요." /></td></tr>
        )}
        {banners.map((b) => (
          <tr key={b.id} className={b.active ? "" : "opacity-50"}>
            <td className="px-4 py-3"><img src={b.imageUrl || ""} alt="" className="h-10 w-16 rounded-lg object-cover" /></td>
            <td className="px-4 py-3 font-semibold text-navy-800">{b.title}</td>
            <td className="max-w-[240px] truncate px-4 py-3 text-navy-500">{b.body}</td>
            <td className="px-4 py-3">{b.active ? <Badge tone="aqua">노출중</Badge> : <Badge tone="gray">숨김</Badge>}</td>
            <td className="px-4 py-3 text-navy-400">{format(b.createdAt, "MM.dd")}</td>
            <td className="px-4 py-3">
              <ActionButton payload={{ type: "BANNER_TOGGLE", id: b.id }} label={b.active ? "숨김" : "노출"} successMsg="변경되었습니다" />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
