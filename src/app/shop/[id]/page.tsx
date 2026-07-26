import { notFound } from "next/navigation";
import Link from "next/link";
import { Tag, ChevronRight, Truck, RotateCcw, ChevronDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, SectionTitle } from "@/components/ui";
import { won } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { ProductImageSlider } from "@/components/shop/ProductImageSlider";
import { ProductPurchaseBar } from "@/components/shop/ProductPurchaseBar";

export const dynamic = "force-dynamic";

const DEFAULT_REFUND_POLICY = "상품 수령 후 7일 이내 환불 가능합니다. 단, 사용/훼손된 상품은 환불이 불가합니다.";
const DEFAULT_SHIPPING_GUIDE = "주문 후 1-3일 내 발송됩니다. 도서산간 지역은 추가 배송비가 발생할 수 있습니다.";

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
  const [p, shopTagEnabled, refundPolicy, shippingGuide] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.id }, include: { seller: { select: { id: true, nickname: true, avatarUrl: true } } } }),
    getBoolSetting("shop_tag_enabled"),
    getSetting("refund_policy"),
    getSetting("shipping_guide"),
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

  const refundText = refundPolicy || DEFAULT_REFUND_POLICY;
  const shippingText = shippingGuide || DEFAULT_SHIPPING_GUIDE;

  return (
    <div className="pb-0">
      <PageHeader title="상품" back />

      {/* 이미지 슬라이더 */}
      <ProductImageSlider images={allImages} />

      <div className="space-y-3 p-4">
        {/* 상품 정보 섹션 */}
        <div>
          <Badge tone="aqua"><Tag size={12} /> {productCategoryLabel(p.category)}</Badge>
          <h1 className="mt-2 text-xl font-bold leading-snug text-navy-800">{p.name}</h1>
          {p.brand && <p className="mt-0.5 text-sm text-navy-400">{p.brand}</p>}

          {/* 가격 + 버튼 같은 row */}
          <div className="mt-2 flex items-center gap-3">
            <p className="text-2xl font-extrabold text-navy-800">{won(p.price)}</p>
            <div className="ml-auto">
              <ProductPurchaseBar product={productForClient} shopTagEnabled={shopTagEnabled} />
            </div>
          </div>

          {/* 배송비 안내 */}
          {shippingFee === 0
            ? <p className="mt-0.5 text-sm text-green-400">무료배송</p>
            : freeShippingThreshold > 0
              ? <p className="mt-0.5 text-sm text-navy-400">
                  <span className="text-green-400">{won(freeShippingThreshold)} 이상 무료배송</span>
                  {" / "}기본 {won(shippingFee)}
                </p>
              : <p className="mt-0.5 text-sm text-navy-400">배송비 {won(shippingFee)}</p>}
        </div>

        {/* 상품 설명 */}
        {p.description && (
          <div className="rounded-2xl border border-navy-100 bg-[#162538] p-4 shadow-card">
            <SectionTitle className="mb-1.5">상품 설명</SectionTitle>
            <p className="text-sm leading-relaxed text-navy-600">{p.description}</p>
          </div>
        )}

        {/* 판매자 정보 */}
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

        {/* 주문/배송 안내 accordion */}
        <details className="group rounded-2xl border border-navy-100 bg-[#162538]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
            <Truck size={15} className="shrink-0 text-navy-400" />
            <span className="text-[13px] font-semibold text-navy-700">주문/배송 안내</span>
            <ChevronDown size={14} className="ml-auto text-navy-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-navy-100/20 px-4 py-3">
            <p className="text-[13px] leading-relaxed text-navy-500">{shippingText}</p>
          </div>
        </details>

        {/* 환불 정책 accordion */}
        <details className="group rounded-2xl border border-navy-100 bg-[#162538]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
            <RotateCcw size={15} className="shrink-0 text-navy-400" />
            <span className="text-[13px] font-semibold text-navy-700">환불 정책</span>
            <ChevronDown size={14} className="ml-auto text-navy-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-navy-100/20 px-4 py-3">
            <p className="text-[13px] leading-relaxed text-navy-500">{refundText}</p>
          </div>
        </details>
      </div>

      {/* 하단 내비바(~56px) + safe area만큼 spacer */}
      <div className="h-14 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
    </div>
  );
}
