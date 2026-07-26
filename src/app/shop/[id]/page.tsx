import { notFound } from "next/navigation";
import Link from "next/link";
import { Tag, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, SectionTitle } from "@/components/ui";
import { won } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { getBoolSetting } from "@/lib/settings";
import { ProductImageSlider } from "@/components/shop/ProductImageSlider";
import { ProductPurchaseBar } from "@/components/shop/ProductPurchaseBar";

export const dynamic = "force-dynamic";

function parseProductOptions(optionsJson: string | null) {
  if (!optionsJson) return { extraImages: [] as string[] };
  try {
    const parsed = JSON.parse(optionsJson);
    if (Array.isArray(parsed)) return { extraImages: [] as string[] };
    return { extraImages: Array.isArray(parsed.extraImages) ? (parsed.extraImages as string[]) : [] as string[] };
  } catch {
    return { extraImages: [] as string[] };
  }
}

export default async function ShopProductPage({ params }: { params: { id: string } }) {
  const [p, shopTagEnabled] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.id }, include: { seller: { select: { id: true, nickname: true, avatarUrl: true } } } }),
    getBoolSetting("shop_tag_enabled"),
  ]);
  if (!p) notFound();

  // Prisma 클라이언트가 stale(재생성 전)할 수 있으므로 as any + ?? 기본값으로 안전하게 접근.
  // `prisma generate` 실행 후에는 일반 필드 접근으로 교체 가능.
  const shippingFee: number = (p as any).shippingFee ?? 0;
  const productOptions: string | null = (p as any).options ?? null;
  const freeShippingThreshold: number = (p as any).freeShippingThreshold ?? 0;

  const { extraImages } = parseProductOptions(productOptions);
  const allImages = [p.imageUrl, ...extraImages].filter(Boolean) as string[];

  // Serialize product for client component (Date → string)
  const productForClient = {
    id: p.id,
    name: p.name,
    price: p.price,
    options: productOptions,
    feeRate: p.feeRate,
    shippingFee,
    freeShippingThreshold,
    imageUrl: p.imageUrl ?? null,
  };

  return (
    <div className="pb-28">
      <PageHeader title="상품" back />

      {/* 이미지 슬라이더 */}
      <ProductImageSlider images={allImages} />

      <div className="space-y-4 p-4">
        <div>
          <Badge tone="aqua"><Tag size={12} /> {productCategoryLabel(p.category)}</Badge>
          <h1 className="mt-2 text-xl font-bold leading-snug text-navy-800">{p.name}</h1>
          {p.brand && <p className="mt-0.5 text-sm text-navy-400">{p.brand}</p>}
          <p className="mt-2 text-2xl font-extrabold text-navy-800">{won(p.price)}</p>
          {shippingFee === 0
            ? <p className="mt-0.5 text-sm text-green-400">무료배송</p>
            : freeShippingThreshold > 0
              ? <p className="mt-0.5 text-sm text-navy-400">
                  <span className="text-green-400">{won(freeShippingThreshold)} 이상 무료배송</span>
                  {" / "}기본 {won(shippingFee)}
                </p>
              : <p className="mt-0.5 text-sm text-navy-400">배송비 {won(shippingFee)}</p>}
        </div>

        {p.description && (
          <div className="rounded-2xl border border-navy-100 bg-[#162538] p-4 shadow-card">
            <SectionTitle className="mb-1.5">상품 설명</SectionTitle>
            <p className="text-sm leading-relaxed text-navy-600">{p.description}</p>
          </div>
        )}

        {p.seller && (
          <Link href={`/profile/${p.seller.id}`} className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-[#162538] p-3 shadow-card transition-shadow hover:shadow-cardhover">
            <img src={getAvatarUrl(p.seller.id, p.seller.avatarUrl)} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-navy-100" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-navy-400">판매자</p>
              <p className="truncate text-sm font-semibold text-navy-800">{p.seller.nickname}</p>
            </div>
            <ChevronRight size={18} className="text-navy-300" />
          </Link>
        )}
      </div>

      {/* 하단 구매 바 */}
      <ProductPurchaseBar product={productForClient} shopTagEnabled={shopTagEnabled} />
    </div>
  );
}
