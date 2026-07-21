import { notFound } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, ExternalLink, Tag, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, SectionTitle } from "@/components/ui";
import { won } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";
import { getAvatarUrl } from "@/lib/avatarUtils";

export const dynamic = "force-dynamic";

export default async function ShopProductPage({ params }: { params: { id: string } }) {
  const p = await prisma.product.findUnique({ where: { id: params.id }, include: { seller: { select: { id: true, nickname: true, avatarUrl: true } } } });
  if (!p) notFound();
  return (
    <div className="pb-28">
      <PageHeader title="상품" back />
      <div className="aspect-square w-full bg-navy-50">
        <img src={p.imageUrl || ""} alt={p.name} decoding="async" className="h-full w-full object-cover" />
      </div>
      <div className="space-y-4 p-4">
        <div>
          <Badge tone="aqua"><Tag size={12} /> {productCategoryLabel(p.category)}</Badge>
          <h1 className="mt-2 text-xl font-bold leading-snug text-navy-800">{p.name}</h1>
          {p.brand && <p className="mt-0.5 text-sm text-navy-400">{p.brand}</p>}
          <p className="mt-2 text-2xl font-extrabold text-navy-800">{won(p.price)}</p>
        </div>

        {p.description && (
          <div className="rounded-2xl border border-navy-100 bg-[#1e1e1e] p-4 shadow-card">
            <SectionTitle className="mb-1.5">상품 설명</SectionTitle>
            <p className="text-sm leading-relaxed text-navy-600">{p.description}</p>
          </div>
        )}

        {p.seller && (
          <Link href={`/profile/${p.seller.id}`} className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-[#1e1e1e] p-3 shadow-card transition-shadow hover:shadow-cardhover">
            <img src={getAvatarUrl(p.seller.id, p.seller.avatarUrl)} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-navy-100" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-navy-400">판매자</p>
              <p className="truncate text-sm font-semibold text-navy-800">{p.seller.nickname}</p>
            </div>
            <ChevronRight size={18} className="text-navy-300" />
          </Link>
        )}
        <p className="text-xs text-navy-300">※ 판매수수료 {p.feeRate}% · 결제는 추후 커머스/제휴 API 연동 예정입니다.</p>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-[#161616]/90 p-3 backdrop-blur-md md:relative md:border-0 md:bg-[#1e1e1e]">
        <div className="mx-auto flex max-w-[640px] gap-2">
          <a href={p.buyUrl && p.buyUrl !== "#" ? p.buyUrl : undefined} target="_blank" rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-[15px] font-semibold text-white shadow-soft btn-press transition-colors outline-none hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-aqua-300 focus-visible:ring-offset-1">
            <ShoppingBag size={18} /> 구매하기 <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
 