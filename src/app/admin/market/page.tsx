import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { SearchBox } from "@/components/admin/SearchBox";
import { ActionButton } from "@/components/admin/ActionButton";
import { MarketSeedButton } from "@/components/admin/MarketSeedButton";
import { Badge, EmptyState } from "@/components/ui";
import { won, kstFormat } from "@/lib/utils";
import { marketCategoryLabel, marketConditionLabel, marketStatusLabel } from "@/lib/taxonomy";
import { getAvatarUrl } from "@/lib/avatarUtils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "aqua" | "amber" | "gray"> = {
  SELLING: "aqua", RESERVED: "amber", SOLD: "gray",
};

const STATUS_OPTS = [
  { value: "SELLING", label: "판매중" },
  { value: "RESERVED", label: "예약중" },
  { value: "SOLD", label: "판매완료" },
];

export default async function AdminMarketPage({ searchParams }: { searchParams: { q?: string; status?: string; category?: string } }) {
  const q = searchParams.q?.trim();
  const statusFilter = searchParams.status;
  const categoryFilter = searchParams.category;

  const listings = await prisma.marketListing.findMany({
    where: {
      ...(q ? {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { region: { contains: q } },
          { seller: { nickname: { contains: q } } },
        ],
      } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(categoryFilter ? { category: categoryFilter } : {}),
    },
    include: {
      seller: { select: { id: true, nickname: true, avatarUrl: true } },
      images: { take: 1, orderBy: { order: "asc" } },
      _count: { select: { favorites: true, chats: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const total = await prisma.marketListing.count();
  const selling = await prisma.marketListing.count({ where: { status: "SELLING" } });
  const reserved = await prisma.marketListing.count({ where: { status: "RESERVED" } });
  const sold = await prisma.marketListing.count({ where: { status: "SOLD" } });

  return (
    <div>
      <AdminTitle
        title="중고피싱 관리"
        desc={`전체 ${total}개 · 판매중 ${selling} · 예약중 ${reserved} · 완료 ${sold}`}
        right={
          <div className="flex items-center gap-2">
            <MarketSeedButton />
            <SearchBox placeholder="제목/판매자/지역 검색" />
          </div>
        }
      />

      {/* 요약 카드 */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "전체", value: total, tone: "navy" as const, href: "/admin/market" },
          { label: "판매중", value: selling, tone: "aqua" as const, href: "/admin/market?status=SELLING" },
          { label: "예약중", value: reserved, tone: "amber" as const, href: "/admin/market?status=RESERVED" },
          { label: "판매완료", value: sold, tone: "gray" as const, href: "/admin/market?status=SOLD" },
        ].map((s) => (
          <Link key={s.label} href={s.href}
            className="flex flex-col gap-1 rounded-2xl border border-navy-100/20 bg-[#162538] p-4 transition-colors hover:bg-[#1c2c3e]">
            <p className="text-[12px] text-navy-400">{s.label}</p>
            <p className="text-[24px] font-extrabold text-navy-900">{s.value}</p>
          </Link>
        ))}
      </div>

      {/* 필터 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "SELLING", "RESERVED", "SOLD"].map((s) => (
          <Link key={s || "ALL"} href={s ? `/admin/market?status=${s}` : "/admin/market"}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              statusFilter === s || (!statusFilter && !s)
                ? "bg-orange-500 text-white"
                : "bg-navy-50/10 text-navy-400 hover:bg-navy-50/20"
            }`}>
            {s ? marketStatusLabel(s) : "전체"}
          </Link>
        ))}
      </div>

      {/* PC 테이블 */}
      <div className="hidden md:block">
        <Table head={["사진", "판매자", "제목", "카테고리", "상태", "가격", "찜/채팅", "등록일", "관리"]}>
          {listings.length === 0 && (
            <tr><td colSpan={9} className="p-0"><EmptyState title="판매글이 없습니다" desc={q ? "검색 결과가 없습니다." : undefined} /></td></tr>
          )}
          {listings.map((l) => (
            <tr key={l.id} className={l.status === "SOLD" ? "opacity-50" : ""}>
              <td className="px-4 py-3">
                <div className="h-10 w-10 overflow-hidden rounded-lg bg-navy-50/20">
                  {l.images[0] && <img src={l.images[0].url} alt="" className="h-full w-full object-cover" />}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <img src={getAvatarUrl(l.seller.id, l.seller.avatarUrl)} alt="" className="h-7 w-7 rounded-full object-cover" />
                  <span className="text-[13px] font-semibold text-navy-800">{l.seller.nickname}</span>
                </div>
              </td>
              <td className="max-w-[180px] px-4 py-3">
                <Link href={`/market/${l.id}`} target="_blank" className="line-clamp-2 text-[13px] text-navy-700 hover:text-orange-400">
                  {l.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-[12px] text-navy-400">{marketCategoryLabel(l.category)}</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[l.status]}>{marketStatusLabel(l.status)}</Badge>
              </td>
              <td className="px-4 py-3 text-[13px] font-bold text-navy-800">{won(l.price)}</td>
              <td className="px-4 py-3 text-[12px] text-navy-400">
                찜 {l._count.favorites} / 채팅 {l._count.chats}
              </td>
              <td className="px-4 py-3 text-[12px] text-navy-400">{kstFormat(l.createdAt, "MM.dd")}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <Link href={`/market/${l.id}`} target="_blank"
                    className="rounded-lg bg-navy-50/10 px-2.5 py-1.5 text-[12px] font-semibold text-navy-700 hover:bg-navy-50/20">
                    보기
                  </Link>
                  {l.status !== "SELLING" && (
                    <ActionButton payload={{ type: "MARKET_STATUS", id: l.id, status: "SELLING" }} label="판매중" successMsg="상태 변경됨" />
                  )}
                  {l.status !== "RESERVED" && (
                    <ActionButton payload={{ type: "MARKET_STATUS", id: l.id, status: "RESERVED" }} label="예약중" successMsg="상태 변경됨" />
                  )}
                  {l.status !== "SOLD" && (
                    <ActionButton payload={{ type: "MARKET_STATUS", id: l.id, status: "SOLD" }} label="완료" successMsg="상태 변경됨" />
                  )}
                  <ActionButton
                    payload={{ type: "MARKET_DELETE", id: l.id }}
                    label="삭제"
                    variant="danger"
                    confirm="이 판매글을 삭제하시겠습니까? 되돌릴 수 없습니다."
                    successMsg="삭제되었습니다"
                  />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* 모바일 카드 */}
      <div className="space-y-3 md:hidden">
        {listings.length === 0 && <EmptyState title="판매글이 없습니다" desc={q ? "검색 결과가 없습니다." : undefined} />}
        {listings.map((l) => (
          <div key={l.id} className={`rounded-2xl border border-navy-100/20 bg-[#162538] p-3.5 ${l.status === "SOLD" ? "opacity-50" : ""}`}>
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-navy-50/20">
                {l.images[0] && <img src={l.images[0].url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge tone={STATUS_TONE[l.status]}>{marketStatusLabel(l.status)}</Badge>
                  <span className="text-[11px] text-navy-400">{marketCategoryLabel(l.category)}</span>
                </div>
                <p className="line-clamp-2 text-[13px] font-semibold text-navy-800">{l.title}</p>
                <p className="mt-0.5 text-[13px] font-bold text-navy-900">{won(l.price)}</p>
                <p className="mt-0.5 text-[11px] text-navy-400">
                  {l.seller.nickname} · {l.region} · {kstFormat(l.createdAt, "MM.dd")}
                </p>
                <p className="mt-0.5 text-[11px] text-navy-400">찜 {l._count.favorites} · 채팅 {l._count.chats}</p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-navy-100/10 pt-2.5">
              <Link href={`/market/${l.id}`} target="_blank"
                className="rounded-lg bg-navy-50/10 px-2.5 py-1.5 text-[12px] font-semibold text-navy-700">보기</Link>
              {l.status !== "SELLING" && (
                <ActionButton payload={{ type: "MARKET_STATUS", id: l.id, status: "SELLING" }} label="판매중" successMsg="상태 변경됨" />
              )}
              {l.status !== "RESERVED" && (
                <ActionButton payload={{ type: "MARKET_STATUS", id: l.id, status: "RESERVED" }} label="예약중" successMsg="상태 변경됨" />
              )}
              {l.status !== "SOLD" && (
                <ActionButton payload={{ type: "MARKET_STATUS", id: l.id, status: "SOLD" }} label="완료" successMsg="상태 변경됨" />
              )}
              <ActionButton
                payload={{ type: "MARKET_DELETE", id: l.id }}
                label="삭제"
                variant="danger"
                confirm="이 판매글을 삭제하시겠습니까?"
                successMsg="삭제되었습니다"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
