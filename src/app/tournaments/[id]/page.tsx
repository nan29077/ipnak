import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Award, Medal, MapPin, Ruler, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Card, Badge, SectionTitle } from "@/components/ui";
import { TournamentSubmit } from "@/components/TournamentSubmit";
import { TOURNAMENT_TYPES } from "@/lib/taxonomy";
import { cn, kstFormat } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { tournamentBannerSrc } from "@/lib/tournamentBanner";
import { effectiveStatus, syncTournamentStatuses } from "@/lib/tournamentStatus";

export const dynamic = "force-dynamic";

const RANK_COLOR = ["text-amber-500", "text-navy-400", "text-amber-700"];

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  await syncTournamentStatuses();
  const t = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: { entries: { include: { user: { select: { id: true, nickname: true, avatarUrl: true } } } } },
  });
  if (!t) notFound();

  // 리더보드는 1인 1기록(본인 최고 기록)만 노출한다.
  // 그렇지 않으면 여러 건 제출한 참가자가 상위 순위를 독식한다.
  const bestByUser = new Map<string, (typeof t.entries)[number]>();
  for (const e of t.entries) {
    if (e.status !== "APPROVED") continue;
    const prev = bestByUser.get(e.user.id);
    if (!prev || e.sizeCm > prev.sizeCm || (e.sizeCm === prev.sizeCm && e.createdAt < prev.createdAt)) {
      bestByUser.set(e.user.id, e);
    }
  }
  const approved = [...bestByUser.values()]
    .sort((a, b) => b.sizeCm - a.sizeCm || a.createdAt.getTime() - b.createdAt.getTime());
  const myEntries = user ? t.entries.filter((e) => e.user.id === user.id) : [];
  const participantCount = new Set(t.entries.map((e) => e.user.id)).size;
  const status = effectiveStatus(t);
  const statusLabel = status === "ONGOING" ? "진행중" : status === "UPCOMING" ? "예정" : "종료";
  const typeLabel = TOURNAMENT_TYPES.find((x) => x.key === t.type)?.label;
  const entryFee = t.entryFee ?? 0;
  const rewards = [t.reward1st, t.reward2nd, t.reward3rd];
  const hasReward = rewards.some((r) => r && r > 0);
  // 관리자 업로드 배너 우선, 없으면 어종별 불곰 마스코트 배너 (목록 카드와 동일한 규칙)
  const banner = t.bannerImage || tournamentBannerSrc(t.speciesName, t.bannerUrl);
  // base64 data URI 는 next/image 최적화 대상이 아니라 <img> 로 그린다
  const isDataUri = banner.startsWith("data:");

  return (
    <div className="pb-10">
      <PageHeader title={t.title} back />
      <div className="p-4">
        {/* 어종별 불곰 마스코트 헤더 카드 */}
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-[12/5] min-h-[148px] overflow-hidden">
            {isDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={banner}
                alt={`${t.title} 대회 배너`}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <Image
                src={banner}
                alt={`${t.speciesName ?? "낚시"} 낚시를 하는 입낚 불곰`}
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                priority
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#071522]/90 via-[#071522]/60 to-black/5" aria-hidden />
            <div className="relative flex h-full min-h-[148px] items-start justify-between p-4">
              <div className="min-w-0 max-w-[62%]">
                <span className="mb-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {typeLabel ?? statusLabel}
                </span>
                <h1 className="text-[16px] font-bold leading-snug text-white drop-shadow-md">{t.title}</h1>
                <p className="mt-1 text-[12px] text-white/75 drop-shadow">
                  {kstFormat(t.startAt, "M월 d일")} ~ {kstFormat(t.endAt, "M월 d일")}
                </p>
              </div>
              <Trophy size={20} className="shrink-0 text-white drop-shadow-md" />
            </div>
          </div>
          <div className="flex gap-4 p-3.5">
            <div>
              <p className="text-[11px] text-navy-300">기준어종</p>
              <p className="text-[14px] font-bold text-navy-900">{t.speciesName ?? "전어종"}</p>
            </div>
            <div>
              <p className="text-[11px] text-navy-300">참가인원</p>
              <p className="text-[14px] font-bold text-navy-900">{participantCount}명</p>
            </div>
            <div>
              <p className="text-[11px] text-navy-300">상태</p>
              <p className="text-[14px] font-bold text-aqua-500">{statusLabel}</p>
            </div>
            <div>
              <p className="text-[11px] text-navy-300">참가비</p>
              <p className={cn("text-[14px] font-bold", entryFee > 0 ? "text-orange-500" : "text-navy-900")}>
                {entryFee > 0 ? `${entryFee.toLocaleString()}P` : "무료"}
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

        {/* 순위 보상 — 설정된 순위만 표시 */}
        {hasReward && (
          <section>
            <SectionTitle className="mb-2 flex items-center gap-1.5"><Award size={14} /> 순위 보상</SectionTitle>
            <Card className="divide-y divide-navy-50 p-0">
              {rewards.map((r, i) =>
                r && r > 0 ? (
                  <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
                    <span className={cn("text-sm font-bold", i < 3 ? RANK_COLOR[i] : "text-navy-500")}>{i + 1}위</span>
                    <span className="text-sm font-extrabold text-orange-500">{r.toLocaleString()}P</span>
                  </div>
                ) : null,
              )}
            </Card>
            <p className="mt-2 text-xs text-navy-400">보상은 대회 종료 후 승인된 기록을 기준으로 지급됩니다</p>
          </section>
        )}

        {entryFee > 0 && (
          <p className="text-xs text-navy-400">
            참가비 {entryFee.toLocaleString()}P는 이 대회에 처음 기록을 제출할 때 1회만 차감됩니다
          </p>
        )}

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
          <SectionTitle className="mb-2 flex items-center gap-1.5"><Medal size={14} /> 랭킹 순위</SectionTitle>
          {approved.length === 0 ? (
            <Card className="py-6 text-center text-sm text-navy-300">승인된 기록이 아직 없습니다</Card>
          ) : (
            <Card className="divide-y divide-navy-50 overflow-hidden p-0">
              {approved.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className={cn("w-6 text-center text-base font-extrabold", i < 3 ? RANK_COLOR[i] : "text-navy-300")}>{i + 1}</span>
                  <Link href={`/profile/${e.user.id}`}><img src={getAvatarUrl(e.user.id, e.user.avatarUrl)} alt="" loading="lazy" decoding="async" className="h-9 w-9 rounded-full object-cover" /></Link>
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

        {/* 제출은 진행중일 때만 — 시작 전/종료 후에는 API 도 거부한다 */}
        {status === "ONGOING" ? (
          <TournamentSubmit tournamentId={t.id} species={t.speciesName} loggedIn={!!user} entryFee={t.entryFee} />
        ) : (
          <Card className="py-4 text-center text-sm text-navy-300">
            {status === "UPCOMING"
              ? `${kstFormat(t.startAt, "M월 d일")}부터 기록을 제출할 수 있습니다`
              : "종료된 대회입니다"}
          </Card>
        )}
      </div>
    </div>
  );
}
