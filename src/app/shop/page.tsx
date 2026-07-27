import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag, Tag, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getBoolSetting } from "@/lib/settings";
import { PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { won } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";
import { MarketTabs } from "@/components/market/MarketTabs";
import { MarketIntroBanner } from "@/components/market/MarketIntroBanner";

export const dynamic = "force-dynamic";

type Section = { key: string; label: string; color: string };
const SECTIONS: Section[] = [
  { key: "TODAY", label: "오늘의 상품", color: "orange" },
  { key: "WEEKLY", label: "이번 주 추천", color: "aqua" },
  { key: "MONTHLY", label: "이번 달 추천", color: "amber" },
  { key: "BEST", label: "베스트 상품", color: "rose" },
];

type RawFeatured = {
  id: string;
  productId: string;
  section: string;
  order: number;
  createdAt: string;
};

type FeaturedWithProduct = RawFeatured & {
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    price: number;
    imageUrl: string | null;
    buyUrl: string | null;
  };
};

export default async function ShopPage() {
  // 쇼핑 메뉴 노출 OFF: 쇼핑 페이지를 완전히 숨기고 중고마켓으로 보낸다
  if (!(await getBoolSetting("shop_menu_enabled"))) redirect("/market");

  let featured: FeaturedWithProduct[] = [];

  try {
    const rawFeatured = await prisma.$queryRaw<RawFeatured[]>`
      SELECT * FROM "FeaturedProduct" ORDER BY section, "order"
    `;

    if (rawFeatured.length > 0) {
      const productIds = [...new Set(rawFeatured.map((item) => item.productId))];
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          brand: true,
          category: true,
          price: true,
          imageUrl: true,
          buyUrl: true,
        },
      });

      featured = rawFeatured
        .map((item) => ({
          ...item,
          product: products.find((product) => product.id === item.productId)!,
        }))
        .filter((item) => item.product) as FeaturedWithProduct[];
    }
  } catch {
    featured = [];
  }

  const bySection = (key: string) =>
    featured.filter((item) => item.section === key).slice(0, 5);

  return (
    <div className="pb-28">
      <PageHeader title="마켓" />
      <MarketTabs />
      <MarketIntroBanner variant="shopping" />

      {featured.length === 0 ? (
        <EmptyState
          title="등록된 상품이 없습니다"
          desc="관리자가 추천 상품을 등록하면 여기에 표시됩니다."
          action={<LinkButton href="/">홈으로 돌아가기</LinkButton>}
        />
      ) : (
        <div className="space-y-8 px-4">
          {SECTIONS.map((section) => {
            const items = bySection(section.key);
            if (items.length === 0) return null;

            return (
              <section key={section.key}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      section.color === "orange"
                        ? "bg-orange-500"
                        : section.color === "aqua"
                          ? "bg-aqua-400"
                          : section.color === "amber"
                            ? "bg-amber-400"
                            : "bg-rose-500"
                    }`}
                  />
                  <h2 className="text-[16px] font-extrabold text-navy-800">
                    {section.label}
                  </h2>
                  <span className="ml-auto text-[12px] text-navy-400">
                    {items.length}개
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map(({ product }) => (
                    <Link
                      key={product.id}
                      href={`/shop/${product.id}`}
                      className="group flex items-center gap-3 rounded-2xl border border-navy-100 bg-[#162538] p-3 shadow-card transition-all duration-150 hover:shadow-cardhover active:scale-[0.98]"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
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
                          <Tag size={9} /> {productCategoryLabel(product.category)}
                        </Badge>
                        <p className="line-clamp-1 text-sm font-semibold leading-snug text-navy-800">
                          {product.name}
                        </p>
                        {product.brand && (
                          <p className="text-xs text-navy-400">{product.brand}</p>
                        )}
                        <p className="mt-0.5 text-base font-extrabold text-orange-500">
                          {won(product.price)}
                        </p>
                      </div>
                      <ChevronRight
                        size={18}
                        className="shrink-0 text-navy-300 transition-colors group-hover:text-navy-600"
                      />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="px-4 py-4 text-center text-[11px] text-navy-300">
        상품을 선택하면 구매 페이지로 이동합니다.
      </p>
    </div>
  );
}
