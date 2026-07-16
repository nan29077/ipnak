import { Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { TournamentList } from "@/components/TournamentList";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const tournaments = await prisma.tournament.findMany({
    include: { _count: { select: { entries: true } } },
    orderBy: [{ status: "asc" }, { startAt: "desc" }],
  });
  const data = tournaments.map((t) => ({
    id: t.id, title: t.title, type: t.type, speciesName: t.speciesName, status: t.status,
    startAt: t.startAt.toISOString(), endAt: t.endAt.toISOString(), bannerUrl: t.bannerUrl,
    entryCount: t._count.entries,
  }));
  return (
    <div>
      <PageHeader title="온라인 낚시 대회" sub="주간 · 월간 · 왕중왕전" />
      <TournamentList tournaments={data} />
    </div>
  );
}
