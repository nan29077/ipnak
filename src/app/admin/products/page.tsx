import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { CreateForm } from "@/components/admin/CreateForm";
import { EmptyState } from "@/components/ui";
import { PRODUCT_CATEGORIES, productCategoryLabel } from "@/lib/taxonomy";
import { won } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const products = await prisma.product.findMany({
    include: { seller: { select: { nickname: true } }, _count: { select: { postTags: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <AdminTitle title="피싱태그 / 상품 관리" desc={`총 ${products.length}개`} />
      <div className="mb-4">
        <CreateForm actionType="PRODUCT_CREATE" title="상품 등록" fields={[
          { name: "name", label: "상품명", required: true },
          { name: "brand", label: "브랜드" },
          { name: "category", label: "카테고리", type: "select", options: PRODUCT_CATEGORIES.map((c) => ({ value: c.key, label: c.label })) },
          { name: "price", label: "가격(원)", type: "number" },
          { name: "buyUrl", label: "구매 링크" },
          { name: "feeRate", label: "수수료(%)", type: "number" },
        ]} />
      </div>

      {/* PC 테이블 */}
      <div className="hidden md:block">
        <Table head={["이미지", "상품명", "브랜드", "카테고리", "가격", "수수료", "태그수", "관리"]}>
          {products.length === 0 && (
            <tr><td colSpan={8} className="p-0"><EmptyState title="상품이 없습니다" desc="위 버튼으로 상품을 등록해 보세요." /></td></tr>
          )}
          {products.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3"><img src={p.imageUrl || ""} alt="" className="h-10 w-10 rounded-lg object-cover" /></td>
              <td className="px-4 py-3 font-semibold text-navy-800">{p.name}</td>
              <td className="px-4 py-3 text-navy-500">{p.brand}</td>
              <td className="px-4 py-3 text-navy-500">{productCategoryLabel(p.category)}</td>
              <td className="px-4 py-3 text-navy-600">{won(p.price)}</td>
              <td className="px-4 py-3 text-navy-400">{p.feeRate}%</td>
              <td className="px-4 py-3 text-navy-500">{p._count.postTags}</td>
              <td className="px-4 py-3">
                <ActionButton payload={{ type: "PRODUCT_DELETE", id: p.id }} label="삭제" variant="danger" confirm="이 상품을 삭제할까요?" successMsg="삭제되었습니다" />
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* 모바일 카드 목록 */}
      <div className="space-y-3 md:hidden">
        {products.length === 0 && <EmptyState title="상품이 없습니다" desc="위 버튼으로 상품을 등록해 보세요." />}
        {products.map((p) => (
          <div key={p.id} className="rounded-2xl border border-navy-100 bg-white px-3 py-3 shadow-card">
            <div className="flex items-start gap-3">
              {p.imageUrl && <img src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-800">{p.name}</p>
                <p className="mt-0.5 text-[12px] text-navy-500">{p.brand} · {productCategoryLabel(p.category)}</p>
                <div className="mt-0.5 flex items-center gap-3 text-[12px]">
                  <span className="font-semibold text-navy-700">{won(p.price)}</span>
                  <span className="text-navy-400">수수료 {p.feeRate}%</span>
                  <span className="text-navy-400">태그 {p._count.postTags}</span>
                </div>
              </div>
            </div>
            <div className="mt-2">
              <ActionButton payload={{ type: "PRODUCT_DELETE", id: p.id }} label="삭제" variant="danger" confirm="이 상품을 삭제할까요?" successMsg="삭제되었습니다" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
