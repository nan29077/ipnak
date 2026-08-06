import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { TournamentList } from "@/components/TournamentList";
import { effectiveStatus, syncTournamentStatuses } from "@/lib/tournamentStatus";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

// 진행중 → 예정 → 종료 순으로 보여준다.
// status 를 그대로 정렬하면 알파벳순(ENDED < ONGOING < UPCOMING)이라 종료 대회가 맨 위로 올라온다.
const STATUS_ORDER: Record<string, number> = { ONGOING: 0, UPCOMING: 1, ENDED: 2 };

export default async function TournamentsPage() {
  await syncTournamentStatuses();
  const rows = await prisma.tournament.findMany({
    include: { _count: { select: { entries: true } } },
    orderBy: { startAt: "desc" },
  });
  // status 컬럼은 syncTournamentStatuses 의 30초 스로틀 때문에 잠시 어긋날 수 있다.
  // 배지·필터·정렬은 상세 페이지와 같이 기간 기준 실제 상태를 쓴다.
  const tournaments = rows.map((t) => ({ ...t, status: effectiveStatus(t) }));
  tournaments.sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
      || b.startAt.getTime() - a.startAt.getTime(),
  );
  const data = tournaments.map((t) => ({
    id: t.id, title: t.title, type: t.type, speciesName: t.speciesName, status: t.status,
    startAt: t.startAt.toISOString(), endAt: t.endAt.toISOString(), bannerUrl: t.bannerUrl,
    bannerImage: t.bannerImage,
    entryCount: t._count.entries,
    entryFee: t.entryFee, reward1st: t.reward1st, reward2nd: t.reward2nd, reward3rd: t.reward3rd,
  }));
  return (
    <div>
      <PageHeader title="온라인 낚시 대회" sub="주간 · 월간 · 왕중왕전" />
      <TournamentList tournaments={data} />
      <SiteFooter pageKey="tournaments" />
    </div>
  );
}
