import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { AdminTitle, StatusBadge, Table } from "@/components/admin/ui";
import { BallPriceForm, BallStatusActions, BallOptionPriceForm } from "@/components/admin/IpnakBallAdminActions";
import { IpnakSaleToggle } from "@/components/admin/IpnakBallToggle";
import { IpnakBallProductForm, IpnakBallProductToggle, IpnakBallProductDelete, IpnakBallProductEditModal } from "@/components/admin/IpnakBallProductForm";
import { IpnakBallRegistryTab } from "@/components/admin/IpnakBallRegistryTab";
import {
  IPNAK_ENABLED_KEY,
  IPNAK_PRODUCT_TYPES,
  IPNAK_TYPE_LABEL,
  IpnakProductType,
  ensureIpnakRawColumns,
  normalizeProductType,
} from "@/lib/ipnakProduct";
import { cn, kstFormat } from "@/lib/utils";
export const dynamic = "force-dynamic";

const tabs = [
  { key: "requests", label: "구매 요청" },
  { key: "orders", label: "주문 관리" },
  { key: "payments", label: "결제 관리" },
  { key: "shipping", label: "배송 관리" },
  { key: "products", label: "상품 관리" },
  { key: "price", label: "가격 설정" },
  { key: "registry", label: "볼 ID 관리" },
];

/* imageUrl은 단일 URL 또는 JSON 배열 문자열 — 목록에서는 첫 장만 썸네일로 사용 */
function parseFirstImage(raw?: string | null): string | null {
  if (!raw) return null;
  try { const p = JSON.parse(raw); if (Array.isArray(p) && p[0]) return p[0]; } catch {}
  return raw;
}

function imageCount(raw?: string | null): number {
  if (!raw) return 0;
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.filter(Boolean).length; } catch {}
  return 1;
}

export default async function BallAdmin({ searchParams }: { searchParams: { tab?: string; kind?: string } }) {
  const tab = tabs.some(t => t.key === searchParams.tab) ? searchParams.tab! : "requests";
  const kind: IpnakProductType = normalizeProductType(searchParams.kind);
  await ensureIpnakRawColumns();
  const settings = await getSettings(IPNAK_PRODUCT_TYPES.map(t => IPNAK_ENABLED_KEY[t]));
  const where = tab === "requests" ? { status: { in: ["REQUESTED", "PAID"] } } : tab === "payments" ? { paymentStatus: { in: ["READY", "PAID", "CANCELLED", "REFUNDED"] } } : tab === "shipping" ? { status: { in: ["PREPARING", "SHIPPED", "DELIVERED"] } } : {};
  // productType은 Prisma가 모르는 raw 컬럼이라, 해당 타입의 주문 id를 먼저 뽑아 필터로 넘긴다.
  let orders: any[] = [];
  if (tab !== "price" && tab !== "products" && tab !== "registry") {
    const idRows = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT \`id\` FROM \`BallOrder\` WHERE \`productType\` = ?`, kind);
    const ids = idRows.map(r => r.id);
    orders = ids.length === 0 ? [] : await prisma.ballOrder.findMany({
      where: { ...where, id: { in: ids } },
      include: { user: { select: { nickname: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  const products = (tab === "products" || tab === "price")
    ? await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM \`IpnakBallProduct\` WHERE \`type\` = ? ORDER BY \`createdAt\` DESC`, kind)
    : [];
  const label = IPNAK_TYPE_LABEL[kind];

  // 볼 ID 레지스트리 (registry 탭)
  type RegistryRow = { id: string; ballId: string; memo: string | null; isActive: number; createdAt: string };
  let registryItems: RegistryRow[] = [];
  let registryTotal = 0;
  if (tab === "registry") {
    const [rows, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<RegistryRow[]>(
        `SELECT id, ballId, memo, isActive, createdAt FROM IpnakBallRegistry ORDER BY createdAt DESC LIMIT 50`
      ),
      prisma.$queryRawUnsafe<{ cnt: number | bigint }[]>(
        `SELECT COUNT(*) as cnt FROM IpnakBallRegistry`
      ),
    ]);
    registryItems = rows;
    registryTotal = Number(countRows[0]?.cnt ?? 0);
  }

  return (
    <div>
      <AdminTitle title="입낚볼 관리" desc="입낚볼·입낚키링의 상품 등록부터 결제 승인, 주문 처리, 배송 완료까지 통합 관리합니다." />

      {/* 상품 종류 탭 — registry 탭에서는 숨김 */}
      {tab !== "registry" && (
        <div className="mb-4 flex gap-2">
          {IPNAK_PRODUCT_TYPES.map(t => (
            <Link
              key={t}
              href={`/admin/ipnak-ball?tab=${tab}&kind=${t}`}
              className={cn(
                "flex-1 rounded-xl border px-4 py-2.5 text-center text-sm font-bold transition-colors",
                kind === t ? "border-orange-500 bg-orange-500 text-gray-900" : "border-navy-100 text-navy-400 hover:border-orange-400/60 hover:text-orange-400"
              )}
            >
              {IPNAK_TYPE_LABEL[t]}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-navy-100">
        {tabs.map(t => (
          <Link key={t.key} href={`/admin/ipnak-ball?tab=${t.key}&kind=${kind}`} className={cn("border-b-2 px-3 py-2.5 text-[13px] font-semibold", tab === t.key ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400")}>
            {t.label}
          </Link>
        ))}
      </div>

      {/* key={kind} — 상품 탭을 바꿀 때 클라이언트 컴포넌트를 새로 마운트해
          이전 상품의 입력값이 그대로 남는 것을 막는다. */}
      {tab === "price" && (
        <BallPriceForm
          key={kind}
          initial={Number(products[0]?.price ?? 0)}
          productId={products[0]?.id ?? null}
          label={label}
        />
      )}

      {tab === "products" && (
        <div className="space-y-5">
          {/* 판매 스위치 — 켜면 구매 바텀시트에 해당 탭이 노출된다 */}
          <IpnakSaleToggle
            key={kind}
            settingKey={IPNAK_ENABLED_KEY[kind]}
            label={IPNAK_TYPE_LABEL[kind]}
            initial={settings[IPNAK_ENABLED_KEY[kind]] === "true"}
          />

          {products.length === 0 ? (
            <IpnakBallProductForm key={kind} type={kind} label={IPNAK_TYPE_LABEL[kind]} />
          ) : (
            <div className="rounded-xl border border-orange-400/30 bg-orange-500/5 px-4 py-3 text-sm text-orange-400">
              {IPNAK_TYPE_LABEL[kind]} 상품이 이미 1개 등록되어 있습니다. 수정하거나 삭제 후 새로 등록하세요.
            </div>
          )}
          {/* 옵션 가격 빠른 설정 — 상품이 있을 때만 표시 */}
          {products.length > 0 && (
            <BallOptionPriceForm
              key={kind}
              productId={products[0]?.id ?? null}
              label={IPNAK_TYPE_LABEL[kind]}
              initialOnePrice={products[0]?.optionOnePrice ?? null}
              initialTwoPrice={products[0]?.optionTwoPrice ?? null}
            />
          )}

          <div>
            <p className="mb-3 text-sm font-bold text-navy-600">등록된 {IPNAK_TYPE_LABEL[kind]} 상품 ({products.length}개)</p>
            {products.length === 0 ? (
              <p className="py-8 text-center text-navy-400">등록된 상품이 없습니다.</p>
            ) : (
              <>
                {/* PC 테이블 */}
                <div className="hidden md:block">
                  <Table head={["상품명", "가격", "재고", "이미지", "상태", "등록일", "관리"]}>
                    {products.map((p: any) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-navy-800">{p.name}</p>
                          {p.description && <p className="text-xs text-navy-400 mt-0.5">{p.description}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-navy-800">{Number(p.price).toLocaleString()}원</td>
                        <td className="px-4 py-3 text-navy-700">{p.stock}개</td>
                        <td className="px-4 py-3">
                          {parseFirstImage(p.imageUrl)
                            ? <div className="relative h-12 w-12">
                                <img src={parseFirstImage(p.imageUrl)!} alt={p.name} className="h-12 w-12 rounded-lg object-contain bg-[#0d1b2a] border border-navy-100" />
                                {imageCount(p.imageUrl) > 1 && (
                                  <span className="absolute -right-1 -top-1 rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-gray-900">{imageCount(p.imageUrl)}</span>
                                )}
                              </div>
                            : <span className="text-xs text-navy-300">없음</span>
                          }
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-navy-400">{String(p.createdAt).slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <IpnakBallProductToggle id={p.id} isActive={Boolean(p.isActive)} stock={p.stock} />
                            <IpnakBallProductEditModal product={{ ...p, isActive: Boolean(p.isActive), optionEnabled: Boolean(p.optionEnabled) }} />
                            <IpnakBallProductDelete id={p.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </div>

                {/* 모바일 카드 */}
                <div className="space-y-4 md:hidden">
                  {products.map((p: any) => (
                    <div key={p.id} className="rounded-2xl border border-navy-100 bg-[#162538] overflow-hidden">
                      {/* 이미지 + 기본 정보 */}
                      <div className="flex items-start gap-3 p-3.5">
                        <div className="relative h-20 w-20 shrink-0 rounded-xl bg-[#0d1b2a] border border-navy-100/30">
                          {parseFirstImage(p.imageUrl)
                            ? <>
                                <img src={parseFirstImage(p.imageUrl)!} alt={p.name} className="h-full w-full rounded-xl object-contain" />
                                {imageCount(p.imageUrl) > 1 && (
                                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-gray-900">{imageCount(p.imageUrl)}</span>
                                )}
                              </>
                            : <span className="flex h-full w-full items-center justify-center text-[10px] text-navy-400">없음</span>
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-bold text-navy-800 truncate">{p.name}</p>
                            <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} />
                          </div>
                          {p.description && <p className="mt-0.5 text-[11px] text-navy-400 line-clamp-2">{p.description}</p>}
                          <p className="mt-1.5 text-[16px] font-extrabold text-orange-400">{Number(p.price).toLocaleString()}원</p>
                          <div className="mt-1 flex gap-3 text-[11px] text-navy-400">
                            <span>재고 {p.stock}개</span>
                            <span>{String(p.createdAt).slice(0, 10)} 등록</span>
                          </div>
                          {Boolean(p.optionEnabled) && (
                            <p className="mt-1 text-[11px] text-aqua-400">
                              옵션: {p.optionOneLabel ?? "1개입"} / {p.optionTwoLabel ?? "2개입"}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* 버튼 영역 */}
                      <div className="flex gap-2 border-t border-navy-100/20 px-3.5 py-2.5">
                        <IpnakBallProductToggle id={p.id} isActive={Boolean(p.isActive)} stock={p.stock} />
                        <IpnakBallProductEditModal product={{ ...p, isActive: Boolean(p.isActive), optionEnabled: Boolean(p.optionEnabled) }} />
                        <div className="ml-auto">
                          <IpnakBallProductDelete id={p.id} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 볼 ID 레지스트리 탭 */}
      {tab === "registry" && (
        <IpnakBallRegistryTab
          initialItems={registryItems.map(r => ({ ...r, isActive: Boolean(r.isActive) }))}
          initialTotal={Number(registryTotal)}
        />
      )}

      {tab !== "price" && tab !== "products" && tab !== "registry" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Summary label="조회 주문" value={`${orders.length}건`} />
            <Summary label="결제 금액" value={`${orders.filter(o => o.paymentStatus === "PAID").reduce((s, o) => s + o.totalPrice, 0).toLocaleString()}원`} />
            <Summary label="배송 준비" value={`${orders.filter(o => o.status === "PREPARING").length}건`} />
            <Summary label="배송 중" value={`${orders.filter(o => o.status === "SHIPPED").length}건`} />
          </div>
          <Table head={["주문번호·일시", "구매자", "배송지", "상품금액", "결제", "주문/배송", "관리"]}>
            {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-navy-400">{label} 주문 내역이 없습니다.</td></tr>}
            {orders.map(o => (
              <tr key={o.id}>
                <td className="whitespace-nowrap px-4 py-3"><p className="font-semibold text-navy-800">{o.orderNo}</p><p className="text-xs text-navy-400">{kstFormat(o.createdAt, "yyyy.MM.dd HH:mm")}</p></td>
                <td className="px-4 py-3"><p>{o.buyerName} · {o.buyerPhone}</p><p className="text-xs text-navy-400">{o.user.nickname} ({o.user.email})</p></td>
                <td className="max-w-[260px] px-4 py-3 text-xs"><p>{o.recipientName} · {o.recipientPhone}</p><p className="mt-0.5 text-navy-400">({o.postalCode}) {o.address} {o.addressDetail}</p>{o.trackingNumber && <p className="mt-1 text-aqua-400">{o.carrier} {o.trackingNumber}</p>}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold">{o.totalPrice.toLocaleString()}원<p className="text-xs font-normal text-navy-400">{o.quantity}개 × {o.unitPrice.toLocaleString()}</p></td>
                <td className="px-4 py-3"><StatusBadge status={o.paymentStatus} /><p className="mt-1 text-xs text-navy-400">{o.paymentMethod || "-"}</p></td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3"><BallStatusActions id={o.id} status={o.status} /></td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><p className="text-xs text-navy-400">{label}</p><p className="mt-1 text-xl font-extrabold text-navy-800">{value}</p></div>;
}
