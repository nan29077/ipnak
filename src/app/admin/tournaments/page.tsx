import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { CreateForm } from "@/components/admin/CreateForm";
import { PayRewardsButton } from "@/components/admin/PayRewardsButton";
import { Badge, EmptyState } from "@/components/ui";
import { TOURNAMENT_TYPES, ALL_SPECIES } from "@/lib/taxonomy";
import { kstFormat } from "@/lib/utils";
import { effectiveStatus, syncTournamentStatuses } from "@/lib/tournamentStatus";

export const dynamic = "force-dynamic";

const STATUS_KO: Record<string, string> = { UPCOMING: "예정", ONGOING: "진행중", ENDED: "종료" };
const STATUS_TONE: Record<string, "amber" | "green" | "gray"> = { UPCOMING: "amber", ONGOING: "green", ENDED: "gray" };

const feeLabel = (fee: number | null) => (fee && fee > 0 ? `참가비 ${fee.toLocaleString()}P` : "무료");
const rewardLabel = (rewards: (number | null)[]) => {
  const s = rewards
    .map((r, i) => (r && r > 0 ? `${i + 1}위 ${r.toLocaleString()}P` : null))
    .filter(Boolean)
    .join(" · ");
  return s || "보상 없음";
};
const hasReward = (rewards: (number | null)[]) => rewards.some((r) => r && r > 0);

export default async function AdminTournaments() {
  await syncTournamentStatuses();
  const tournaments = await prisma.tournament.findMany({
    include: { _count: { select: { entries: true } } }, orderBy: { startAt: "desc" },
  });
  return (
    <div>
      <AdminTitle title="낚시 대회 관리" desc={`총 ${tournaments.length}개`} />

      <div className="mb-4">
        <CreateForm actionType="TOURNAMENT_CREATE" title="대회 생성" fields={[
          // 배너 이미지는 선택 항목 — 없으면 어종별 불곰 마스코트 배너가 쓰인다
          { name: "bannerImage", label: "배너 이미지", type: "image", uploadUrl: "/api/upload/tournament-banner" },
          { name: "title", label: "대회명", required: true },
          { name: "tType", label: "타입", type: "select", options: TOURNAMENT_TYPES.map((t) => ({ value: t.key, label: t.label })) },
          { name: "speciesName", label: "대상 어종", type: "select", options: ALL_SPECIES.map((s) => ({ value: s, label: s })) },
          // 상태는 기간(시작일~종료일)에서 자동 계산된다 — 수동 선택 항목을 두면 곧바로 어긋난다
          { name: "startAt", label: "시작일", type: "date", required: true },
          { name: "endAt", label: "종료일 (당일 23:59까지)", type: "date", required: true },
          // 참가비·보상은 선택 항목 — 비워두면 무료 대회 / 보상 없음으로 저장된다
          { name: "entryFee", label: "참가비 (P)", type: "number", placeholder: "없음 (비워두세요)" },
          { name: "reward1st", label: "1위 보상 (P)", type: "number", placeholder: "없음 (비워두세요)" },
          { name: "reward2nd", label: "2위 보상 (P)", type: "number", placeholder: "없음 (비워두세요)" },
          { name: "reward3rd", label: "3위 보상 (P)", type: "number", placeholder: "없음 (비워두세요)" },
        ]} />
      </div>

      {/* PC 테이블 */}
      <div className="hidden md:block">
        <Table head={["대회명", "타입", "대상어", "상태", "기간", "참가", "참가비 · 보상", "관리"]}>
          {tournaments.length === 0 && (
            <tr><td colSpan={8} className="p-0"><EmptyState title="대회가 없습니다" desc="위 버튼으로 새 대회를 만들어 보세요." /></td></tr>
          )}
          {tournaments.map((t) => {
            const rewards = [t.reward1st, t.reward2nd, t.reward3rd];
            const payable = effectiveStatus(t) === "ENDED" && hasReward(rewards) && !t.rewardPaid;
            return (
            <tr key={t.id}>
              <td className="px-4 py-3 font-semibold text-navy-800">{t.title}</td>
              <td className="px-4 py-3 text-navy-500">{TOURNAMENT_TYPES.find((x) => x.key === t.type)?.label}</td>
              <td className="px-4 py-3 text-navy-500">{t.speciesName}</td>
              <td className="px-4 py-3"><Badge tone={STATUS_TONE[t.status] ?? "gray"}>{STATUS_KO[t.status] ?? t.status}</Badge></td>
              <td className="px-4 py-3 text-navy-400">{kstFormat(t.startAt, "MM.dd")}~{kstFormat(t.endAt, "MM.dd")}</td>
              <td className="px-4 py-3 text-navy-500">{t._count.entries}건</td>
              <td className="px-4 py-3 text-[12px] text-navy-500">
                <p>{feeLabel(t.entryFee)}</p>
                <p className="text-navy-400">{rewardLabel(rewards)}</p>
                {t.rewardPaid && <p className="mt-0.5 text-[11px] font-semibold text-aqua-500">보상 지급 완료</p>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {payable && <PayRewardsButton tournamentId={t.id} title={t.title} rewards={rewards} />}
                  <ActionButton payload={{ type: "TOURNAMENT_DELETE", id: t.id }} label="삭제" variant="danger" confirm="이 대회를 삭제할까요? 참가 기록도 함께 삭제됩니다." successMsg="삭제되었습니다" />
                </div>
              </td>
            </tr>
            );
          })}
        </Table>
      </div>

      {/* 모바일 카드 목록 */}
      <div className="space-y-3 md:hidden">
        {tournaments.length === 0 && <EmptyState title="대회가 없습니다" desc="위 버튼으로 새 대회를 만들어 보세요." />}
        {tournaments.map((t) => {
          const rewards = [t.reward1st, t.reward2nd, t.reward3rd];
          const payable = effectiveStatus(t) === "ENDED" && hasReward(rewards) && !t.rewardPaid;
          return (
          <div key={t.id} className="rounded-2xl border border-navy-100 bg-white px-3 py-3 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-800">{t.title}</p>
                <p className="mt-0.5 text-[12px] text-navy-500">
                  {TOURNAMENT_TYPES.find((x) => x.key === t.type)?.label} · {t.speciesName}
                </p>
                <p className="mt-0.5 text-[11px] text-navy-400">
                  {kstFormat(t.startAt, "MM.dd")}~{kstFormat(t.endAt, "MM.dd")} · 제출 {t._count.entries}건
                </p>
                <p className="mt-0.5 text-[11px] text-navy-400">
                  {feeLabel(t.entryFee)} · {rewardLabel(rewards)}
                  {t.rewardPaid && <span className="ml-1 font-semibold text-aqua-500">지급 완료</span>}
                </p>
              </div>
              <Badge tone={STATUS_TONE[t.status] ?? "gray"}>{STATUS_KO[t.status] ?? t.status}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {payable && <PayRewardsButton tournamentId={t.id} title={t.title} rewards={rewards} />}
              <ActionButton payload={{ type: "TOURNAMENT_DELETE", id: t.id }} label="삭제" variant="danger" confirm="이 대회를 삭제할까요? 참가 기록도 함께 삭제됩니다." successMsg="삭제되었습니다" />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
