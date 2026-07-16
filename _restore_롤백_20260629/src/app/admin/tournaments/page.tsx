import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { CreateForm } from "@/components/admin/CreateForm";
import { Badge, EmptyState } from "@/components/ui";
import { TOURNAMENT_TYPES, ALL_SPECIES } from "@/lib/taxonomy";
import { kstFormat } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_KO: Record<string, string> = { UPCOMING: "예정", ONGOING: "진행중", ENDED: "종료" };
const STATUS_TONE: Record<string, "amber" | "green" | "gray"> = { UPCOMING: "amber", ONGOING: "green", ENDED: "gray" };

export default async function AdminTournaments() {
  const tournaments = await prisma.tournament.findMany({
    include: { _count: { select: { entries: true } } }, orderBy: { startAt: "desc" },
  });
  return (
    <div>
      <AdminTitle title="대회 관리" desc={`총 ${tournaments.length}개`} />
      <div className="mb-4">
        <CreateForm actionType="TOURNAMENT_CREATE" title="대회 생성" fields={[
          { name: "title", label: "대회명", required: true },
          { name: "tType", label: "타입", type: "select", options: TOURNAMENT_TYPES.map((t) => ({ value: t.key, label: t.label })) },
          { name: "speciesName", label: "대상 어종", type: "select", options: ALL_SPECIES.map((s) => ({ value: s, label: s })) },
          { name: "status", label: "상태", type: "select", options: [{ value: "UPCOMING", label: "예정" }, { value: "ONGOING", label: "진행중" }, { value: "ENDED", label: "종료" }] },
          { name: "startAt", label: "시작일", type: "date" },
          { name: "endAt", label: "종료일", type: "date" },
        ]} />
      </div>
      <Table head={["대회명", "타입", "대상어", "상태", "기간", "참가", "관리"]}>
        {tournaments.length === 0 && (
          <tr><td colSpan={7} className="p-0"><EmptyState title="대회가 없습니다" desc="위 버튼으로 새 대회를 만들어 보세요." /></td></tr>
        )}
        {tournaments.map((t) => (
          <tr key={t.id}>
            <td className="px-4 py-3 font-semibold text-navy-800">{t.title}</td>
            <td className="px-4 py-3 text-navy-500">{TOURNAMENT_TYPES.find((x) => x.key === t.type)?.label}</td>
            <td className="px-4 py-3 text-navy-500">{t.speciesName}</td>
            <td className="px-4 py-3"><Badge tone={STATUS_TONE[t.status] ?? "gray"}>{STATUS_KO[t.status]}</Badge></td>
            <td className="px-4 py-3 text-navy-400">{kstFormat(t.startAt, "MM.dd")}~{kstFormat(t.endAt, "MM.dd")}</td>
            <td className="px-4 py-3 text-navy-500">{t._count.entries}명</td>
            <td className="px-4 py-3">
              <ActionButton payload={{ type: "TOURNAMENT_DELETE", id: t.id }} label="삭제" variant="danger" confirm="이 대회를 삭제할까요? 참가 기록도 함께 삭제됩니다." successMsg="삭제되었습니다" />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
