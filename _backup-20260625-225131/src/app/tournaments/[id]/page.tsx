import { notFound } from "next/navigation";
import Link from "next/link";
import { Medal, MapPin, Ruler, Trophy } from "lucide-react";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import { TournamentSubmit } from "@/components/TournamentSubmit";
import { TOURNAMENT_TYPES } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANK_COLOR = ["text-amber-500", "text-navy-400", "text-amber-700"];

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const t = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: { entries: { include: { user: { select: { id: true, nickname: true, avatarUrl: true } } } } },
  });
  if (!t) notFound();

  const approved = t.entries
    .filter((e) => e.status === "APPROVED")
    .sort((a, b) => b.sizeCm - a.sizeCm || a.createdAt.getTime() - b.createdAt.getTime());
  const myEntries = user ? t.entries.filter((e) => e.user.id === user.id) : [];
  const typeLabel = TOURNAMENT_TYPES.find((x) => x.key === t.type)?.label;

  return (
    <div className="pb-10">
      <PageHeader title={t.title} back />
      <div className="p-4">
        {/* 그라데이션 헤더 카드 */}
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-navy-700 to-aqua-500 p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <span className="mb-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {typeLabel ?? (t.status === "ONGOING" ? "진행중" : t.status === "UPCOMING" ? "예정" : "종료")}
                </span>
                <h1 className="text-[16px] font-bold text-white">{t.title}</h1>
                <p className="mt-1 text-[12px] text-white/60">
                  {format(t.startAt, "M월 d일")} ~ {format(t.endAt, "M월 d일")}
                </p>
              </div>
              <Trophy size={20} className="shrink-0 text-white" />
            </div>
          </div>
          <div className="flex gap-4 p-3.5">
            <div>
              <p className="text-[11px] text-navy-300">기준어종</p>
              <p className="text-[14px] font-bold text-navy-900">{t.speciesName ?? "전어종"}</p>
            </div>
            <div>
              <p className="text-[11px] text-navy-300">참가인원</p>
              <p className="text-[14px] font-bold text-navy-900">{t.entries.length}명</p>
            </div>
            <div>
              <p className="text-[11px] text-navy-300">상태</p>
              <p className="text-[14px] font-bold text-aqua-500">
                {t.status === "ONGOING" ? "진행중" : t.status === "UPCOMING" ? "예정" : "종료"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-5 px-4 pb-4">
        {t.description && <p className="text-sm leading-relaxed text-navy-600">{t.description}</p>}

        <section>
          <SectionTitle className="mb-2">대회 규칙</SectionTitle>
          <Card className="text-sm leading-relaxed text-navy-600">{t.rules}</Card>
          <p className="mt-2 text-xs text-navy-400">순위 기준: 길이(cm) 내림차순, 동점 시 먼저 등록한 순</p>
        </section>

        {/* 내 제출 상태 */}
        {myEntries.length > 0 && (
          <section>
            <SectionTitle className="mb-2">내 제출 기록</SectionTitle>
            <div className="space-y-2">
              {myEntries.map((e) => (
                <Card key={e.id} className="flex items-center gap-3 p-2.5">
                  <Ruler size={16} className="text-navy-400" />
                  <span className="text-sm font-semibold text-navy-800">{e.speciesName} {e.sizeCm}cm</span>
                  <Badge tone={e.status === "APPROVED" ? "aqua" : e.status === "REJECTED" ? "red" : "amber"} className="ml-auto">
                    {e.status === "APPROVED" ? "승인" : e.status === "REJECTED" ? "반려" : "심사중"}
                  </Badge>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* 리더보드 */}
        <section>
          <SectionTitle className="mb-2 flex items-center gap-1.5"><Medal size={14} /> 리더보드</SectionTitle>
          {approved.length === 0 ? (
            <Card className="py-6 text-center text-sm text-navy-300">승인된 기록이 아직 없습니다</Card>
          ) : (
            <Card className="divide-y divide-navy-50 overflow-hidden p-0">
              {approved.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className={cn("w-6 text-center text-base font-extrabold", i < 3 ? RANK_COLOR[i] : "text-navy-300")}>{i + 1}</span>
                  <Link href={`/profile/${e.user.id}`}><img src={e.user.avatarUrl || ""} alt="" className="h-9 w-9 rounded-full object-cover" /></Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-800">{e.user.nickname}</p>
                    {e.region && <p className="text-[11px] text-navy-400"><MapPin size={10} className="mr-0.5 inline" />{e.region}</p>}
                  </div>
                  <span className="text-base font-extrabold text-navy-800">{e.sizeCm}<span className="text-xs">cm</span></span>
                </div>
              ))}
            </Card>
          )}
        </section>

        {t.status !== "ENDED" && <TournamentSubmit tournamentId={t.id} species={t.speciesName} loggedIn={!!user} />}
      </div>
    </div>
  );
}
