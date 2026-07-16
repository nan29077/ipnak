import Link from "next/link";
import { Users, UserPlus, FileImage, MapPin, Trophy, CalendarDays, Flag, ShoppingBag, ClipboardCheck, Store, MessageCircle, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Card, StatusBadge } from "@/components/admin/ui";
import { timeAgo, kstFormat } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const [
    members, todaySignups, posts, todayPosts, points, comments, tournaments, bookings,
    reports, products, marketListings, pendingEntries, pendingBookings,
    recentReports, recentBookings, recentMembers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.post.count(),
    prisma.post.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.fishingPoint.count(),
    prisma.comment.count(),
    prisma.tournament.count(),
    prisma.booking.count(),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.product.count(),
    prisma.marketListing.count(),
    prisma.tournamentEntry.count({ where: { status: "REVIEW" } }),
    prisma.booking.count({ where: { status: "REQUESTED" } }),
    prisma.report.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { reporter: { select: { nickname: true } } } }),
    prisma.booking.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { listing: { select: { name: true } }, user: { select: { nickname: true } } } }),
    prisma.user.findMany({ take: 5, orderBy: { createdAt: "desc" }, select: { id: true, nickname: true, avatarUrl: true, role: true, createdAt: true } }),
  ]);

  const cards = [
    { label: "총 회원 수", value: members, icon: Users, href: "/admin/members", sub: `오늘 +${todaySignups}` },
    { label: "게시글 수", value: posts, icon: FileImage, href: "/admin/posts", sub: `오늘 +${todayPosts}` },
    { label: "댓글 수", value: comments, icon: MessageCircle, href: "/admin/comments" },
    { label: "피싱 포인트", value: points, icon: MapPin, href: "/admin/posts" },
    { label: "대회 수", value: tournaments, icon: Trophy, href: "/admin/tournaments" },
    { label: "예약 수", value: bookings, icon: CalendarDays, href: "/admin/bookings" },
    { label: "쇼핑 상품", value: products, icon: ShoppingBag, href: "/admin/products" },
    { label: "중고 판매글", value: marketListings, icon: Store, href: "/admin/members" },
  ];

  const todos = [
    { label: "미처리 신고", value: reports, icon: Flag, href: "/admin/reports" },
    { label: "대회 심사 대기", value: pendingEntries, icon: ClipboardCheck, href: "/admin/reviews" },
    { label: "예약요청 대기", value: pendingBookings, icon: CalendarDays, href: "/admin/bookings" },
  ];
  const totalTodo = reports + pendingEntries + pendingBookings;

  return (
    <div>
      <AdminTitle title="대시보드" desc="입낚 운영 현황 한눈에 보기" />

      {/* 처리 대기 작업 요약 */}
      <Card className={`mb-4 p-4 ${totalTodo > 0 ? "ring-1 ring-orange-500/30" : ""}`}>
        <div className="mb-3 flex items-center gap-1.5">
          <AlertTriangle size={16} className={totalTodo > 0 ? "text-orange-500" : "text-navy-300"} />
          <h2 className="text-sm font-bold text-navy-800">처리 대기 작업</h2>
          {totalTodo > 0 && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">{totalTodo}</span>}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {todos.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.label} href={t.href} className="btn-press flex items-center gap-2.5 rounded-xl bg-navy-50/60 p-3 transition-colors hover:bg-navy-100/60">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.value > 0 ? "bg-red-50 text-red-600" : "bg-aqua-50 text-aqua-600"}`}><Icon size={17} /></span>
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold leading-tight text-navy-800">{t.value}</span>
                  <span className="block truncate text-[12px] text-navy-400">{t.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="btn-press">
              <Card className="p-4 transition-shadow hover:shadow-cardhover">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-aqua-50 text-aqua-600">
                    <Icon size={18} />
                  </span>
                  {c.sub && <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-500">{c.sub}</span>}
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

        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-navy-800"><UserPlus size={16} /> 최근 가입 회원</h2>
            <Link href="/admin/members" className="text-xs font-semibold text-navy-400">전체보기</Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentMembers.length === 0 && <p className="py-4 text-center text-sm text-navy-300">회원 없음</p>}
            {recentMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-xl bg-navy-50/60 px-3 py-2">
                <img src={m.avatarUrl || ""} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-navy-800">{m.nickname}</p>
                  <p className="text-[11px] text-navy-400">{kstFormat(m.createdAt, "MM.dd")} 가입</p>
                </div>
                <span className="ml-auto"><StatusBadge status={m.role} /></span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
