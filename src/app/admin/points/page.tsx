import Link from "next/link";
import { Coins, TrendingUp, TrendingDown, Users, ArrowLeft, Wallet } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBoolSetting } from "@/lib/settings";
import { AdminTitle, Table } from "@/components/admin/ui";
import { SearchBox } from "@/components/admin/SearchBox";
import { Pagination } from "@/components/admin/Pagination";
import { MemberPointTopup } from "@/components/admin/MemberPointTopup";
import { EmptyState } from "@/components/ui";
import { kstFormat } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// 포인트 거래 유형 라벨/부호
const TYPE_LABEL: Record<string, string> = {
  EARN: "적립", CHARGE: "충전", GIFT_RECEIVED: "선물받음", REFUND: "환불", ADMIN: "관리자지급",
  SPEND: "사용", GIFT_SENT: "선물보냄",
};

function kstDayStart(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600 * 1000);
}

function AmountCell({ amount }: { amount: number }) {
  const pos = amount >= 0;
  return (
    <span className={pos ? "font-bold text-amber-600" : "font-bold text-navy-500"}>
      {pos ? "+" : ""}{amount.toLocaleString()}P
    </span>
  );
}

export default async function AdminPoints({
  searchParams,
}: { searchParams: { q?: string; page?: string; userId?: string } }) {
  const q = searchParams.q?.trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const detailUserId = searchParams.userId;

  const pointsEnabled = await getBoolSetting("points_enabled");

  // ===== 요약 통계 =====
  const [circulating, holders, totalTx, todayTx] = await Promise.all([
    prisma.user.aggregate({ _sum: { points: true } }),
    prisma.user.count({ where: { points: { gt: 0 } } }),
    prisma.pointTransaction.count().catch(() => 0),
    prisma.pointTransaction.count({ where: { createdAt: { gte: kstDayStart() } } }).catch(() => 0),
  ]);

  // ===== 선택 회원 상세 =====
  let detail: null | {
    user: { id: string; nickname: string; email: string; avatarUrl: string | null; points: number };
    charged: number; spent: number;
    txs: { id: string; type: string; amount: number; balanceAfter: number; description: string; createdAt: Date }[];
  } = null;
  if (detailUserId) {
    const u = await prisma.user.findUnique({ where: { id: detailUserId }, select: { id: true, nickname: true, email: true, avatarUrl: true, points: true } });
    if (u) {
      const [txs, chargedSum, spentSum] = await Promise.all([
        prisma.pointTransaction.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 200 }),
        prisma.pointTransaction.aggregate({ where: { userId: u.id, amount: { gt: 0 } }, _sum: { amount: true } }),
        prisma.pointTransaction.aggregate({ where: { userId: u.id, amount: { lt: 0 } }, _sum: { amount: true } }),
      ]);
      detail = { user: u, charged: chargedSum._sum.amount ?? 0, spent: Math.abs(spentSum._sum.amount ?? 0), txs };
    }
  }

  // ===== 전체 회원 포인트 현황 (잔액 높은 순) =====
  const memberWhere: Prisma.UserWhereInput = q
    ? { OR: [{ nickname: { contains: q } }, { email: { contains: q } }] }
    : {};
  const [memberTotal, members] = await Promise.all([
    prisma.user.count({ where: memberWhere }),
    prisma.user.findMany({
      where: memberWhere,
      select: { id: true, nickname: true, email: true, avatarUrl: true, points: true, role: true },
      orderBy: [{ points: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(memberTotal / PAGE_SIZE));

  // ===== 전체 거래 내역 (최신순) =====
  const recentTx = await prisma.pointTransaction
    .findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { id: true, nickname: true } } } })
    .catch(() => [] as any[]);

  return (
    <div>
      <AdminTitle
        title="포인트 관리"
        desc="회원 포인트 현황·거래 내역 조회 및 직접 충전·차감"
        right={<SearchBox placeholder="회원 닉네임/이메일 검색" />}
      />

      {!pointsEnabled && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-400/10 px-4 py-2.5 text-[13px] font-semibold text-amber-600 ring-1 ring-amber-400/20">
          <Coins size={15} /> 포인트 기능이 비활성화 상태입니다. (사이트 관리 → 앱 기능 설정에서 켤 수 있습니다) — 관리자 조회·지급은 가능합니다.
        </div>
      )}

      {/* 요약 카드 */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<Wallet size={16} className="text-amber-500" />} label="총 유통 포인트" value={`${(circulating._sum.points ?? 0).toLocaleString()}P`} />
        <SummaryCard icon={<Users size={16} className="text-aqua-500" />} label="포인트 보유 회원" value={`${holders.toLocaleString()}명`} />
        <SummaryCard icon={<TrendingUp size={16} className="text-green-500" />} label="총 거래 건수" value={`${totalTx.toLocaleString()}건`} />
        <SummaryCard icon={<TrendingDown size={16} className="text-orange-500" />} label="오늘 거래" value={`${todayTx.toLocaleString()}건`} />
      </div>

      {/* 선택 회원 상세 내역 */}
      {detail && (
        <div className="card mb-6 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={getAvatarUrl(detail.user.id, detail.user.avatarUrl)} alt="" className="h-11 w-11 rounded-full object-cover" />
              <div>
                <p className="text-[15px] font-bold text-navy-800">{detail.user.nickname}</p>
                <p className="text-[12px] text-navy-400">{detail.user.email}</p>
              </div>
            </div>
            <Link href="/admin/points" className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-500 hover:bg-navy-100">
              <ArrowLeft size={13} /> 목록
            </Link>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <MiniStat label="현재 잔액" value={`${detail.user.points.toLocaleString()}P`} tone="amber" />
            <MiniStat label="누적 충전·적립" value={`+${detail.charged.toLocaleString()}`} tone="green" />
            <MiniStat label="누적 사용·차감" value={`-${detail.spent.toLocaleString()}`} tone="navy" />
          </div>

          <div className="mb-3">
            <MemberPointTopup userId={detail.user.id} nickname={detail.user.nickname} points={detail.user.points} />
          </div>

          <Table head={["유형", "내용", "변동", "거래 후 잔액", "일시"]}>
            {detail.txs.length === 0 && (
              <tr><td colSpan={5} className="p-0"><EmptyState title="포인트 내역이 없습니다" /></td></tr>
            )}
            {detail.txs.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 text-navy-500">{TYPE_LABEL[t.type] ?? t.type}</td>
                <td className="px-4 py-3 text-navy-700">{t.description}</td>
                <td className="px-4 py-3"><AmountCell amount={t.amount} /></td>
                <td className="px-4 py-3 text-navy-500">{t.balanceAfter.toLocaleString()}P</td>
                <td className="px-4 py-3 text-navy-400">{kstFormat(t.createdAt, "MM.dd HH:mm")}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {/* 전체 회원 포인트 현황 */}
      <h2 className="mb-2 text-[15px] font-bold text-navy-800">전체 회원 포인트 현황</h2>
      <Table head={["회원", "이메일", "잔액", "관리"]}>
        {members.length === 0 && (
          <tr><td colSpan={4} className="p-0"><EmptyState title="회원이 없습니다" desc={q ? "검색 결과가 없습니다." : undefined} /></td></tr>
        )}
        {members.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <img src={getAvatarUrl(u.id, u.avatarUrl)} alt="" className="h-7 w-7 rounded-full object-cover" />
                <span className="font-semibold text-navy-800">{u.nickname}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-navy-500">{u.email}</td>
            <td className="px-4 py-3 font-bold text-amber-600">{(u.points ?? 0).toLocaleString()}P</td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                <MemberPointTopup userId={u.id} nickname={u.nickname} points={u.points ?? 0} />
                <Link href={`/admin/points?userId=${u.id}`} className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-500 hover:bg-navy-100">
                  내역 보기
                </Link>
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} totalPages={totalPages} total={memberTotal} />

      {/* 전체 포인트 거래 내역 (최신순) */}
      <h2 className="mb-2 mt-8 text-[15px] font-bold text-navy-800">전체 포인트 거래 내역 <span className="text-[12px] font-normal text-navy-400">(최근 50건)</span></h2>
      <Table head={["회원", "유형", "내용", "변동", "거래 후", "일시"]}>
        {recentTx.length === 0 && (
          <tr><td colSpan={6} className="p-0"><EmptyState title="거래 내역이 없습니다" /></td></tr>
        )}
        {recentTx.map((t: any) => (
          <tr key={t.id}>
            <td className="px-4 py-3">
              <Link href={`/admin/points?userId=${t.user?.id}`} className="font-semibold text-navy-800 hover:text-orange-500">{t.user?.nickname ?? "-"}</Link>
            </td>
            <td className="px-4 py-3 text-navy-500">{TYPE_LABEL[t.type] ?? t.type}</td>
            <td className="max-w-[220px] truncate px-4 py-3 text-navy-700">{t.description}</td>
            <td className="px-4 py-3"><AmountCell amount={t.amount} /></td>
            <td className="px-4 py-3 text-navy-500">{t.balanceAfter.toLocaleString()}P</td>
            <td className="px-4 py-3 text-navy-400">{kstFormat(t.createdAt, "MM.dd HH:mm")}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-navy-400">{icon} {label}</div>
      <p className="mt-1 text-[20px] font-extrabold text-navy-800">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "amber" | "green" | "navy" }) {
  const color = tone === "amber" ? "text-amber-600" : tone === "green" ? "text-green-600" : "text-navy-500";
  return (
    <div className="rounded-xl bg-navy-50/60 px-3 py-2.5 text-center">
      <p className="text-[11px] font-semibold text-navy-400">{label}</p>
      <p className={`mt-0.5 text-[17px] font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
