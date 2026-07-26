import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { productCategoryLabel } from "@/lib/taxonomy";
import { won, cn } from "@/lib/utils";
import { FeaturedProductPanel } from "@/components/admin/FeaturedProductPanel";
import { getBoolSetting } from "@/lib/settings";
import { ProductCreateForm } from "@/components/admin/ProductCreateForm";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "products", label: "상품 목록" },
  { key: "featured", label: "쇼핑 추천 상품" },
];

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab === "featured" ? "featured" : "products";

  const shopTagEnabled = await getBoolSetting("shop_tag_enabled");

  const products = await prisma.product.findMany({
    include: {
      seller: { select: { nickname: true } },
      _count: { select: { postTags: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // prisma generate 전에도 동작하도록 raw SQL 사용
  type RawFeatured = { id: string; productId: string; section: string; order: number; createdAt: string };
  let featured: Array<RawFeatured & { product: typeof products[0] }> = [];
  try {
    const rawFeatured = await prisma.$queryRaw<RawFeatured[]>`SELECT * FROM "FeaturedProduct" ORDER BY section, "order"`;
    featured = rawFeatured
      .map((f) => ({ ...f, product: products.find((p) => p.id === f.productId)! }))
      .filter((f) => f.product);
  } catch {
    // FeaturedProduct 테이블이 아직 없는 경우 빈 배열 유지
  }

  return (
    <div>
      <AdminTitle title="상품 관리" desc="피싱 태그 상품 목록 및 쇼핑 메뉴 추천 상품 설정" />

      {/* 탭 */}
      <div className="mb-5 flex gap-1.5 border-b border-navy-100">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/products?tab=${t.key}`}
            className={cn(
              "border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors",
              tab === t.key
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-navy-400 hover:text-navy-700"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "products" ? (
        <>
          <div className="mb-4">
            <ProductCreateForm shopTagEnabled={shopTagEnabled} />
          </div>

          {/* PC 테이블 */}
          <div className="hidden md:block">
            <Table head={["이미지", "상품명", "브랜드", "카테고리", "가격", "수수료", "태그수", "관리"]}>
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState title="상품이 없습니다" desc="위 버튼으로 상품을 등록해 보세요." />
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <img src={p.imageUrl || ""} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-800">{p.name}</td>
                  <td className="px-4 py-3 text-navy-500">{p.brand}</td>
                  <td className="px-4 py-3 text-navy-500">{productCategoryLabel(p.category)}</td>
                  <td className="px-4 py-3 text-navy-600">{won(p.price)}</td>
                  <td className="px-4 py-3 text-navy-400">{p.feeRate}%</td>
                  <td className="px-4 py-3 text-navy-500">{p._count.postTags}</td>
                  <td className="px-4 py-3">
                    <ActionButton
                      payload={{ type: "PRODUCT_DELETE", id: p.id }}
                      label="삭제"
                      variant="danger"
                      confirm="이 상품을 삭제할까요?"
                      successMsg="삭제되었습니다"
                    />
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          {/* 모바일 카드 */}
          <div className="space-y-3 md:hidden">
            {products.length === 0 && (
              <EmptyState title="상품이 없습니다" desc="위 버튼으로 상품을 등록해 보세요." />
            )}
            {products.map((p) => (
              <div key={p.id} className="rounded-2xl border border-navy-100 bg-white px-3 py-3 shadow-card">
                <div className="flex items-start gap-3">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy-800">{p.name}</p>
                    <p className="mt-0.5 text-[12px] text-navy-500">
                      {p.brand} · {productCategoryLabel(p.category)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-[12px]">
                      <span className="font-semibold text-navy-700">{won(p.price)}</span>
                      <span className="text-navy-400">수수료 {p.feeRate}%</span>
                      <span className="text-navy-400">태그 {p._count.postTags}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <ActionButton
                    payload={{ type: "PRODUCT_DELETE", id: p.id }}
                    label="삭제"
                    variant="danger"
                    confirm="이 상품을 삭제할까요?"
                    successMsg="삭제되었습니다"
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <FeaturedProductPanel products={products} featured={featured} />
      )}
    </div>
  );
}
