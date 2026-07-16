import { prisma } from "@/lib/prisma";
import { AdminTitle, Table, StatusBadge } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { kstFormat } from "@/lib/utils";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

function ConfidenceBadge({ value }: { value: number | null }) {
  const cls =
    value == null ? "bg-rose-50 text-rose-600"
    : value >= 85 ? "bg-aqua-50 text-aqua-700"
    : value >= 70 ? "bg-amber-50 text-amber-600"
    : "bg-rose-50 text-rose-600";
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-bold ${cls}`}>
      {value == null ? "없음" : `${Math.round(value)}%`}
    </span>
  );
}

export default async function AdminReviews() {
  const entries = await prisma.tournamentEntry.findMany({
    include: { user: { select: { nickname: true } }, tournament: { select: { title: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 150,
  });
  const pending = entries.filter((e) => e.status === "REVIEW").length;
  return (
    <div>
      <AdminTitle title="대회 제출 심사" desc={`총 ${entries.length}건 · 심사 대기 ${pending}건`} />

      {/* PC 테이블 */}
      <div className="hidden md:block">
        <Table head={["사진", "참가자", "대회", "어종", "길이", "검증 데이터", "지역", "상태", "제출일", "심사"]}>
          {entries.length === 0 && (
            <tr><td colSpan={10} className="p-0"><EmptyState title="제출된 기록이 없습니다" desc="심사 대기 중인 대회 제출이 여기에 표시됩니다." /></td></tr>
          )}
          {entries.map((e) => {
            const hasRuler = e.measuredLengthCm != null || e.calibrationLengthCm != null;
            return (
            <tr key={e.id}>
              <td className="px-4 py-3"><img src={e.measuredImageUrl || e.photoUrl || ""} alt="" className="h-10 w-10 rounded-lg object-cover" /></td>
              <td className="px-4 py-3 font-semibold text-navy-800">{e.user.nickname}</td>
              <td className="max-w-[160px] truncate px-4 py-3 text-navy-500">{e.tournament.title}</td>
              <td className="px-4 py-3 text-navy-500">{e.speciesName}</td>
              <td className="px-4 py-3 font-bold text-navy-800">
                {e.sizeCm}cm
                {e.measuredLengthCm != null && (
                  <span className="ml-1 text-xs font-normal text-navy-400">계측 {e.measuredLengthCm}cm</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {hasRuler ? (
                    <ShieldCheck size={16} className="shrink-0 text-aqua-600" />
                  ) : (
                    <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                  )}
                  <ConfidenceBadge value={e.confidence ?? null} />
                </div>
                {e.calibrationLengthCm != null && (
                  <div className="mt-0.5 text-xs text-navy-400">기준 {e.calibrationLengthCm}cm</div>
                )}
              </td>
              <td className="px-4 py-3 text-navy-400">{e.region}</td>
              <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
              <td className="px-4 py-3 text-navy-400">{kstFormat(e.createdAt, "MM.dd")}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  {e.status !== "APPROVED" && <ActionButton payload={{ type: "ENTRY_REVIEW", id: e.id, status: "APPROVED" }} label="승인" variant="primary" successMsg="승인되었습니다" />}
                  {e.status !== "REJECTED" && <ActionButton payload={{ type: "ENTRY_REVIEW", id: e.id, status: "REJECTED" }} label="반려" variant="danger" successMsg="반려되었습니다" />}
                </div>
              </td>
            </tr>
            );
          })}
        </Table>
      </div>

      {/* 모바일 카드 목록 */}
      <div className="space-y-3 md:hidden">
        {entries.length === 0 && <EmptyState title="제출된 기록이 없습니다" desc="심사 대기 중인 대회 제출이 여기에 표시됩니다." />}
        {entries.map((e) => {
          const hasRuler = e.measuredLengthCm != null || e.calibrationLengthCm != null;
          return (
            <div key={e.id} className="rounded-2xl border border-navy-100 bg-white px-3 py-3 shadow-card">
              <div className="flex items-start gap-3">
                {(e.measuredImageUrl || e.photoUrl) && (
                  <img src={e.measuredImageUrl || e.photoUrl || ""} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-navy-800">{e.user.nickname}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-navy-500">{e.tournament.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px]">
                    <span className="font-bold text-navy-800">{e.speciesName} {e.sizeCm}cm</span>
                    {e.measuredLengthCm != null && <span className="text-navy-400">계측 {e.measuredLengthCm}cm</span>}
                    <span className="flex items-center gap-0.5">
                      {hasRuler ? <ShieldCheck size={13} className="text-aqua-600" /> : <ShieldAlert size={13} className="text-rose-400" />}
                      <ConfidenceBadge value={e.confidence ?? null} />
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-navy-300">{e.region} · {kstFormat(e.createdAt, "MM.dd")}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.status !== "APPROVED" && <ActionButton payload={{ type: "ENTRY_REVIEW", id: e.id, status: "APPROVED" }} label="승인" variant="primary" successMsg="승인되었습니다" />}
                {e.status !== "REJECTED" && <ActionButton payload={{ type: "ENTRY_REVIEW", id: e.id, status: "REJECTED" }} label="반려" variant="danger" successMsg="반려되었습니다" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
