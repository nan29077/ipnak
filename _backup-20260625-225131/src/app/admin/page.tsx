import Link from "next/link";
import { Users, UserPlus, FileImage, MapPin, Trophy, CalendarDays, Flag, ShoppingBag, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Card, StatusBadge } from "@/components/admin/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const [members, todaySignups, posts, points, tournaments, bookings, reports, products, pendingEntries, recentReports, recentBookings] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.post.count(),
    prisma.fishingPoint.count(),
    prisma.tournament.count(),
    prisma.booking.count(),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.product.count(),
    prisma.tournamentEntry.count({ where: { status: "REVIEW" } }),
    prisma.report.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { reporter: { select: { nickname: true } } } }),
    prisma.booking.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { listing: { select: { name: true } }, user: { select: { nickname: true } } } }),
  ]);

  const cards = [
    { label: "총 회원 수", value: members, icon: Users, href: "/admin/members" },
    { label: "오늘 가입자", value: todaySignups, icon: UserPlus, href: "/admin/members" },
    { label: "게시글 수", value: posts, icon: FileImage, href: "/admin/posts" },
    { label: "피싱 포인트 수", value: points, icon: MapPin, href: "/admin/posts" },
    { label: "대회 수", value: tournaments, icon: Trophy, href: "/admin/tournaments" },
    { label: "예약 수", value: bookings, icon: CalendarDays, href: "/admin/bookings" },
    { label: "미처리 신고", value: reports, icon: Flag, href: "/admin/reports", alert: reports > 0 },
    { label: "심사 대기", value: pendingEntries, icon: ClipboardCheck, href: "/admin/reviews", alert: pendingEntries > 0 },
  ];

  return (
    <div>
      <AdminTitle title="대시보드" desc="입낚 운영 현황 한눈에 보기" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="btn-press">
              <Card className="p-4 transition-shadow hover:shadow-cardhover">
                <div className="flex items-center justify-between">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.alert ? "bg-red-50 text-red-600" : "bg-aqua-50 text-aqua-600"}`}>
                    <Icon size={18} />
                  </span>
                  {c.alert && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />}
                </div>
                <p className="mt-3 text-2xl font-extrabold tracking-tight text-navy-800">{c.value.toLocaleString()}</p>
                <p className="text-[13px] text-navy-400">{c.label}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-navy-800"><Flag size={16} /> 최근 신고</h2>
            <Link href="/admin/reports" className="text-xs font-semibold text-navy-400">전체보기</Link>
          </div>
          <div className="space-y-2">
            {recentReports.length === 0 && <p className="py-4 text-center text-sm text-navy-300">신고 없음</p>}
            {recentReports.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <StatusBadge status={r.status} />
                <span className="truncate text-navy-700">{r.reason}</span>
                <span className="ml-auto shrink-0 text-[11px] text-navy-300">{timeAgo(r.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-navy-800"><CalendarDays size={16} /> 최근 예약</h2>
            <Link href="/admin/bookings" className="text-xs font-semibold text-navy-400">전체보기</Link>
          </div>
          <div className="space-y-2">
            {recentBookings.length === 0 && <p className="py-4 text-center text-sm text-navy-300">예약 없음</p>}
            {recentBookings.map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-sm">
                <StatusBadge status={b.status} />
                <span className="truncate text-navy-700">{b.listing.name}</span>
                <span className="ml-auto shrink-0 text-[11px] text-navy-300">{b.user.nickname}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
