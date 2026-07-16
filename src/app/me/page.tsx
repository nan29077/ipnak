import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, CalendarDays, Tag, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getProfileData } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/ProfileView";
import { MeActions } from "@/components/MeActions";
import { PageHeader, Card, Badge, Button, SectionTitle } from "@/components/ui";
import { ROLE_LABELS, reservationCategoryLabel } from "@/lib/taxonomy";
import { won, kstFormat } from "@/lib/utils";

export const dynamic = "force-dynamic";

type BadgeTone = "navy" | "aqua" | "amber" | "red" | "green" | "gray";

const BOOKING_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  REQUESTED: { label: "예약요청", tone: "amber" },
  CONFIRMED: { label: "확정", tone: "aqua" },
  CANCELLED: { label: "취소", tone: "red" },
  DONE: { label: "이용완료", tone: "gray" },
};

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const data = await getProfileData(user.id, user.id);
  if (!data) redirect("/login");
  const { stats } = data;

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id }, include: { listing: true }, orderBy: { createdAt: "desc" }, take: 10,
  });

  return (
    <div className="pb-10">
      <PageHeader title="마이" sub={ROLE_LABELS[user.role]} />

      {/* 프로필 헤더 */}
      <div className="flex items-center gap-4 px-5 py-6">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.nickname} className="h-[72px] w-[72px] rounded-full object-cover shadow-aqua" />
        ) : (
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-aqua-500 text-[28px] font-extrabold text-white shadow-aqua">
            {user.nickname.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[18px] font-bold text-navy-900">{user.nickname}</p>
            <Badge tone="navy">{ROLE_LABELS[user.role]}</Badge>
          </div>
          {data.user.region && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-navy-300">
              <MapPin size={13} />{data.user.region}
            </p>
          )}
          <div className="mt-2 flex gap-4">
            <HeaderStat n={stats.postCount} label="게시글" />
            <HeaderStat n={stats.followerCount} label="팔로워" />
            <HeaderStat n={stats.followingCount} label="팔로잉" accent />
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-2.5 px-3.5">
        <Card className="p-3.5">
          <p className="mb-1 text-[11px] text-navy-300">최대 어획</p>
          <p className="text-[22px] font-extrabold text-aqua-500">
            {stats.maxSize ?? "-"}<span className="ml-0.5 text-[13px] font-semibold text-navy-300">cm</span>
          </p>
          <p className="text-[11px] text-navy-300">{stats.topSpecies ?? "기록 없음"}</p>
        </Card>
        <Card className="p-3.5">
          <p className="mb-1 text-[11px] text-navy-300">총 낚시 횟수</p>
          <p className="text-[22px] font-extrabold text-navy-700">
            {stats.postCount}<span className="ml-0.5 text-[13px] font-semibold text-navy-300">회</span>
          </p>
          <p className="text-[11px] text-navy-300">피싱포인트 {stats.pointCount}곳</p>
        </Card>
      </div>

      <div className="space-y-4 p-4">
        {data.user.bio && <p className="text-sm leading-relaxed text-navy-600">{data.user.bio}</p>}

        <div className="grid grid-cols-2 gap-2">
          <Link href="/trip"><Button variant="outline" full>내 낚시 기록</Button></Link>
          <Link href={`/profile/${user.id}`}><Button variant="outline" full>공개 프로필 보기</Button></Link>
        </div>

        <Link href="/referral" className="flex items-center gap-3 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 to-[#161616] px-4 py-3.5 transition-colors hover:from-orange-500/25">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-soft"><Tag size={19} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold text-navy-900">피싱태그 수익</span>
            <span className="block truncate text-[12px] text-navy-400">내 글의 피싱태그로 적립된 리퍼럴 수익 보기</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-orange-400" />
        </Link>
      </div>

      {/* 내 예약 */}
      <section className="px-4 pb-4">
        <SectionTitle className="mb-2 flex items-center gap-1.5 text-[13px] text-navy-800"><CalendarDays size={16} /> 내 예약</SectionTitle>
        {bookings.length === 0 ? (
          <Card className="py-6 text-center text-sm text-navy-300">예약 내역이 없습니다</Card>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => {
              const st = BOOKING_STATUS[b.status];
              return (
                <Card key={b.id} as="article" className="flex items-center gap-3 p-2.5" onClick={undefined}>
                  <Link href={`/reservations/${b.listingId}`} className="flex flex-1 items-center gap-3">
                    <img src={b.listing.imageUrl || ""} alt={b.listing.name} className="h-12 w-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy-800">{b.listing.name}</p>
                      <p className="mt-0.5 text-xs text-navy-400">{reservationCategoryLabel(b.listing.category)} · {kstFormat(b.date, "M월 d일")} · {b.people}명 · {won(b.totalPrice)}</p>
                    </div>
                    {st && <Badge tone={st.tone}>{st.label}</Badge>}
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="border-t border-navy-100 pt-2">
        <ProfileView posts={data.posts} points={data.points} entries={data.entries} />
      </div>

      <div className="mt-4 border-t border-navy-100 pt-3">
        <MeActions isAdmin={user.role === "SUPER_ADMIN"} />
      </div>
    </div>
  );
}

function HeaderStat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={accent ? "text-[16px] font-bold text-aqua-500" : "text-[16px] font-bold text-navy-900"}>{n}</p>
      <p className="text-[10px] text-navy-300">{label}</p>
    </div>
  );
}
