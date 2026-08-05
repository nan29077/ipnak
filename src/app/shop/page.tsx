import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBoolSetting } from "@/lib/settings";
import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { MarketTabs } from "@/components/market/MarketTabs";
import { MarketIntroBanner } from "@/components/market/MarketIntroBanner";
import { BassOnlyBanner } from "@/components/BassOnlyBanner";
import { ShopSectionPicker } from "@/components/shop/ShopSectionPicker";

export const dynamic = "force-dynamic";

type Section = { key: string; label: string; color: string };
const SECTIONS: Section[] = [
  { key: "TODAY", label: "오늘의 추천상품", color: "orange" },
  { key: "WEEKLY", label: "이번주 추천상품", color: "aqua" },
  { key: "MONTHLY", label: "이번달 추천상품", color: "amber" },
  { key: "BEST", label: "베스트 추천상품", color: "rose" },
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
      SELECT * FROM \`FeaturedProduct\` ORDER BY section, \`order\`
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

  const sectionData = SECTIONS.map((section) => ({
    ...section,
    products: featured
      .filter((item) => item.section === section.key)
      .slice(0, 10)
      .map(({ product }) => product),
  }));

  return (
    <div className="pb-28">
      <PageHeader title="마켓" />
      <MarketTabs />
      <MarketIntroBanner variant="shopping" />
      <BassOnlyBanner
        text="배스낚시 전용 모드 — 배스 장비 위주로 둘러보세요"
        className="mx-4 mb-4"
      />

      {featured.length === 0 ? (
        <EmptyState
          title="등록된 상품이 없습니다"
          desc="관리자가 추천 상품을 등록하면 여기에 표시됩니다."
          action={<LinkButton href="/">홈으로 돌아가기</LinkButton>}
        />
      ) : (
        <ShopSectionPicker sections={sectionData} />
      )}

      <p className="mt-6 px-4 pb-4 text-center text-[11px] text-navy-400">
        상품을 선택하면 구매 페이지로 이동합니다.
      </p>
    </div>
  );
}
