import "server-only";
import { prisma } from "./prisma";
import { toDbDate } from "./dbDate";

/**
 * 입낚볼 / 입낚키링 공통 상품 타입.
 * 두 상품은 같은 테이블("IpnakBallProduct")에 type 컬럼으로 구분해 저장한다.
 */
export type IpnakProductType = "ball" | "keyring";

export const IPNAK_PRODUCT_TYPES: IpnakProductType[] = ["ball", "keyring"];

export const IPNAK_TYPE_LABEL: Record<IpnakProductType, string> = {
  ball: "입낚볼",
  keyring: "입낚키링",
};

export const IPNAK_ENABLED_KEY: Record<IpnakProductType, string> = {
  ball: "ipnak_ball_enabled",
  keyring: "ipnak_keyring_enabled",
};

/** 알 수 없는 값은 모두 기존 상품(입낚볼)으로 간주한다. */
export function normalizeProductType(value: unknown): IpnakProductType {
  return value === "keyring" ? "keyring" : "ball";
}

/**
 * 판매가의 단일 기준 = 해당 타입의 활성 상품 레코드의 price.
 * 예전에는 ipnak_ball_price / ipnak_keyring_price 설정값을 따로 관리했는데,
 * 상품의 price와 두 벌로 나뉘어 있어 서로 어긋나기 쉬웠다.
 * 상품이 없으면 0 — 판매 불가로 취급한다.
 */
export async function getIpnakProducts(): Promise<Partial<Record<IpnakProductType, any>>> {
  await ensureIpnakRawColumns();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM \`IpnakBallProduct\` WHERE \`isActive\` = 1 ORDER BY \`createdAt\` ASC`
  );
  const out: Partial<Record<IpnakProductType, any>> = {};
  for (const r of rows) {
    const t = normalizeProductType(r.type);
    if (!out[t]) out[t] = r;
  }
  return out;
}

export async function getIpnakPrices(): Promise<Record<IpnakProductType, number>> {
  const products = await getIpnakProducts();
  return {
    ball: Number(products.ball?.price) || 0,
    keyring: Number(products.keyring?.price) || 0,
  };
}

/**
 * Prisma 스키마에 없는 raw 전용 컬럼을 1회만 추가한다.
 * - IpnakBallProduct.type          : 'ball' | 'keyring'
 * - BallOrder.productType          : 주문이 어떤 상품인지 기록
 * - BallOrder.productId            : 차감한 상품 레코드의 id. 취소·환불 시 어느 상품의
 *   재고로 되돌릴지 확정하기 위해 필요하다. 이 컬럼이 생기기 전의 주문은 NULL이며,
 *   그 경우 재고 복원을 건너뛴다(어느 상품에서 차감됐는지 알 수 없으므로).
 * - IpnakBallOrder.trackingNumber  : 송장번호. /api/admin/ipnak-ball/orders 가
 *   처음부터 이 컬럼을 읽고 쓰도록 작성돼 있었으나 테이블에는 없어 항상 500이 났다.
 * - BallOrder.pointsUsed           : 결제에 사용한 포인트. 실제 카드 결제액은
 *   totalPrice - pointsUsed 이며, 주문 취소 시 이 금액만큼 포인트를 환불한다.
 *
 * 모두 raw SQL로만 읽고 쓴다(Prisma 클라이언트가 모르는 컬럼이므로 schema.prisma에
 * 추가하면 generate 이후 다른 SELECT가 깨질 수 있다).
 * SQLite는 ADD COLUMN IF NOT EXISTS를 지원하지 않으므로 중복 실행 오류는 무시한다.
 */
let ensurePromise: Promise<void> | null = null;
export function ensureIpnakRawColumns(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await prisma
        .$executeRawUnsafe(`ALTER TABLE \`IpnakBallProduct\` ADD COLUMN \`type\` TEXT NOT NULL DEFAULT 'ball'`)
        .catch(() => {});
      await prisma
        .$executeRawUnsafe(`ALTER TABLE \`BallOrder\` ADD COLUMN \`productType\` TEXT NOT NULL DEFAULT 'ball'`)
        .catch(() => {});
      await prisma
        .$executeRawUnsafe(`ALTER TABLE \`BallOrder\` ADD COLUMN \`productId\` TEXT`)
        .catch(() => {});
      await prisma
        .$executeRawUnsafe(`ALTER TABLE \`IpnakBallOrder\` ADD COLUMN \`trackingNumber\` TEXT`)
        .catch(() => {});
      await prisma
        .$executeRawUnsafe(`ALTER TABLE \`BallOrder\` ADD COLUMN \`pointsUsed\` INTEGER NOT NULL DEFAULT 0`)
        .catch(() => {});

      // ── 데이터 마이그레이션: 입낚볼 옵션 가격 초기값 설정 ──
      // optionOnePrice/optionTwoPrice가 null인 경우에만 적용 (한 번만 실행).
      // optionOnePrice = price(기본가), optionTwoPrice = 69900(2개입 특가)
      await prisma
        .$executeRawUnsafe(
          `UPDATE \`IpnakBallProduct\`
           SET \`optionOnePrice\` = \`price\`, \`optionTwoPrice\` = 69900, \`optionEnabled\` = 1, \`updatedAt\` = ?
           WHERE \`type\` = 'ball' AND \`optionTwoPrice\` IS NULL`,
          // MariaDB DATETIME 컬럼에는 ISO 문자열(…T…Z)을 바인딩할 수 없다 (Error 1292)
          toDbDate()
        )
        .catch(() => {});
    })();
  }
  return ensurePromise;
}
