import Link from "next/link";
import { Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { won } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="pb-24">
      <PageHeader title="쇼핑" />

      {products.length === 0 ? (
        <EmptyState
          title="등록된 상품이 없습니다"
          desc="새로운 낚시 장비가 곧 등록될 예정입니다."
          action={<LinkButton href="/">홈으로 돌아가기</LinkButton>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/shop/${p.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-[#1e1e1e] shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cardhover"
            >
              <div className="aspect-square w-full overflow-hidden bg-navy-50">
                <img
                  src={p.imageUrl || ""}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <Badge tone="aqua" className="w-fit"><Tag size={11} /> {productCategoryLabel(p.category)}</Badge>
                <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-navy-800">{p.name}</h3>
                {p.brand && <p className="text-xs text-navy-400">{p.brand}</p>}
                <p className="mt-auto pt-1 text-base font-extrabold text-navy-800">{won(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
        