import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getReferralEarnings } from "@/lib/referral";
import { PageHeader, EmptyState, LinkButton, Card, Badge } from "@/components/ui";
import { won, timeAgo } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";
import { Tag, MousePointerClick, ShoppingCart, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReferralPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div>
        <PageHeader title="피싱태그 수익" back />
        <EmptyState title="로그인이 필요합니다" desc="내 피싱태그 리퍼럴 수익을 확인하려면 로그인하세요." action={<LinkButton href="/login">로그인</LinkButton>} />
      </div>
    );
  }
  const data = await getReferralEarnings(user.id);

  return (
    <div className="pb-10">
      <PageHeader title="피싱태그 수익" back sub={data.source === "LIVE" ? "실 제휴 연동(LIVE)" : "데모 시뮬레이션(MOCK)"} />
      <div className="space-y-4 p-4">
        {/* 적립 요약 */}
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-orange-500/25 to-[#161616] px-5 py-5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-orange-300"><Wallet size={14} /> 총 적립 리퍼럴 수익</p>
            <p className="mt-1 text-[30px] font-extrabold tracking-tight text-navy-900">{won(data.totalReward)}</p>
            <p className="mt-0.5 text-[12px] text-navy-400">전환 매출 {won(data.totalSales)} 기준</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-navy-100 border-t border-navy-100">
            <Stat icon={<MousePointerClick size={15} />} label="클릭" value={`${data.clickCount}`} />
            <Stat icon={<ShoppingCart size={15} />} label="구매 전환" value={`${data.conversionCount}`} />
            <Stat icon={<Tag size={15} />} label="전환율" value={`${data.clickCount ? Math.round((data.conversionCount / data.clickCount) * 100) : 0}%`} />
          </div>
        </Card>

        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3.5 py-3 text-[12px] leading-relaxed text-navy-400">
          <Tag size={14} className="shrink-0 text-orange-400" />
          내 글에 단 피싱태그 상품을 다른 사람이 구매하면 수수료의 일부가 적립됩니다.
          {data.source === "MOCK" && " 현재는 제휴 API 키가 없어 클릭·전환·수익을 시뮬레이션으로 보여줍니다."}
        </div>

        {/* 내역 */}
        <div>
          <h2 className="mb-2 px-1 text-[14px] font-bold text-navy-900">적립 내역</h2>
          {data.events.length === 0 ? (
            <EmptyState title="아직 내역이 없어요" desc="글에 피싱태그를 달고 공유하면 클릭·전환 내역이 쌓여요." />
          ) : (
            <ul className="space-y-2">
              {data.events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-[#1e1e1e] p-2.5">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-navy-50">
                    {e.product?.imageUrl && <img src={e.product.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-navy-900">{e.product?.name ?? "상품"}</p>
                    <p className="truncate text-[11px] text-navy-400">
                      {e.product ? productCategoryLabel(e.product.category) : ""}
                      {e.post && <> · <Link href={e.post.kind === "LOG" ? `/log/${e.post.id}` : `/post/${e.post.id}`} className="text-aqua-300 hover:underline">{e.post.title || e.post.caption || "내 글"}</Link></>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {e.type === "CONVERSION" ? (
                      <>
                        <Badge tone="green">+{won(e.reward)}</Badge>
                        <p className="mt-0.5 text-[10px] text-navy-300">{timeAgo(e.createdAt)}</p>
                      </>
                    ) : (
                      <>
                        <Badge tone="gray">클릭</Badge>
                        <p className="mt-0.5 text-[10px] text-navy-300">{timeAgo(e.createdAt)}</p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-3">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-navy-400">{icon}{label}</span>
      <span className="text-[16px] font-extrabold text-navy-900">{value}</span>
    </div>
  );
}
