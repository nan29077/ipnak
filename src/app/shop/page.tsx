import Link from "next/link";
import { ShoppingBag, Tag, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { won } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

type Section = { key: string; label: string; color: string };
const SECTIONS: Section[] = [
  { key: "TODAY",   label: "오늘의 상품",  color: "orange" },
  { key: "WEEKLY",  label: "이번 주 추천", color: "aqua"   },
  { key: "MONTHLY", label: "이번 달 추천", color: "amber"  },
  { key: "BEST",    label: "베스트 상품",  color: "rose"   },
];

type RawFeatured = { id: string; productId: string; section: string; order: number; createdAt: string };
type FeaturedWithProduct = RawFeatured & {
  product: { id: string; name: string; brand: string | null; category: string; price: number; imageUrl: string | null; buyUrl: string | null };
};

export default async function ShopPage() {
  let featured: FeaturedWithProduct[] = [];
  try {
    const rawFeatured = await prisma.$queryRaw<RawFeatured[]>`SELECT * FROM "FeaturedProduct" ORDER BY section, "order"`;
    if (rawFeatured.length > 0) {
      const productIds = [...new Set(rawFeatured.map((f) => f.productId))];
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, brand: true, category: true, price: true, imageUrl: true, buyUrl: true },
      });
      featured = rawFeatured
        .map((f) => ({ ...f, product: products.find((p) => p.id === f.productId)! }))
        .filter((f) => f.product) as FeaturedWithProduct[];
    }
  } catch {
    // 테이블 없는 경우 빈 배열
  }

  const bySection = (key: string) =>
    featured.filter((f: FeaturedWithProduct) => f.section === key).slice(0, 5);

  const totalCount = featured.length;

  return (
    <div className="pb-28">
      <PageHeader title="쇼핑" />

      {totalCount === 0 ? (
        <EmptyState
          title="등록된 상품이 없습니다"
          desc="관리자가 추천 상품을 등록하면 여기에 표시됩니다."
          action={<LinkButton href="/">홈으로 돌아가기</LinkButton>}
        />
      ) : (
        <div className="space-y-8 p-4">
          {SECTIONS.map((sec) => {
            const items = bySection(sec.key);
            if (items.length === 0) return null;
            return (
              <section key={sec.key}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    sec.color === "orange" ? "bg-orange-500" :
                    sec.color === "aqua"   ? "bg-aqua-400"   :
                    sec.color === "amber"  ? "bg-amber-400"  :
                                             "bg-rose-500"
                  }`} />
                  <h2 className="text-[16px] font-extrabold text-navy-800">{sec.label}</h2>
                  <span className="ml-auto text-[12px] text-navy-400">{items.length}개</span>
                </div>

                <div className="space-y-3">
                  {items.map(({ product: p }) => (
                    <Link
                      key={p.id}
                      href={`/shop/${p.id}`}
                      className="group flex items-center gap-3 rounded-2xl border border-navy-100 bg-[#162538] p-3 shadow-card transition-all duration-150 hover:shadow-cardhover active:scale-[0.98]"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ShoppingBag size={22} className="text-navy-300" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Badge tone="aqua" className="mb-1 w-fit text-[10px]">
                          <Tag size={9} /> {productCategoryLabel(p.category)}
                        </Badge>
                        <p className="line-clamp-1 text-sm font-semibold leading-snug text-navy-800">{p.name}</p>
                        {p.brand && <p className="text-xs text-navy-400">{p.brand}</p>}
                        <p className="mt-0.5 text-base font-extrabold text-orange-500">{won(p.price)}</p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-navy-300 transition-colors group-hover:text-navy-600" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="px-4 py-2 text-center text-[11px] text-navy-300">
        각 상품을 터치하면 구매 페이지로 이동합니다
      </p>
    </div>
  );
}
