import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDbDate } from "@/lib/dbDate";

export const dynamic = "force-dynamic";

const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;

function genId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// 10개 상품 → 4개 섹션 자동 배분
// TODAY(0~2), WEEKLY(3~5), MONTHLY(6~7), BEST(8~9)
const SECTION_MAP: Record<number, string> = {
  0: "TODAY", 1: "TODAY", 2: "TODAY",
  3: "WEEKLY", 4: "WEEKLY", 5: "WEEKLY",
  6: "MONTHLY", 7: "MONTHLY",
  8: "BEST", 9: "BEST",
};

const DUMMY_PRODUCTS = [
  { name: "다이와 레브로스 LT2500 스피닝릴", brand: "다이와", category: "REEL", price: 89000, feeRate: 8, shippingFee: 0 },
  { name: "시마노 소아레 에깅 전용 로드 8.6ft", brand: "시마노", category: "ROD", price: 178000, feeRate: 8, shippingFee: 3000 },
  { name: "메이저크래프트 배스로드 크로스스테이지", brand: "메이저크래프트", category: "ROD", price: 145000, feeRate: 10, shippingFee: 0 },
  { name: "배스 루어 혼합 세트 20개입", brand: "입낚셀렉트", category: "LURE", price: 35000, feeRate: 12, shippingFee: 0 },
  { name: "PE 합사 1호 150m 4브레이드", brand: "선라인", category: "LINE", price: 22000, feeRate: 10, shippingFee: 0 },
  { name: "갯바위 네오프렌 웨이더 사이즈 270", brand: "맥스피싱", category: "WADER", price: 156000, feeRate: 8, shippingFee: 3500 },
  { name: "가성비 낚시 조끼 16포켓 베스트", brand: "피싱기어", category: "APPAREL", price: 48000, feeRate: 10, shippingFee: 0 },
  { name: "카본 접이식 뜰채 5m", brand: "다이치", category: "NET", price: 67000, feeRate: 8, shippingFee: 0 },
  { name: "방수 하드케이스 태클박스 3단 대형", brand: "플라노", category: "TACKLEBOX", price: 39000, feeRate: 12, shippingFee: 2500 },
  { name: "고감도 형광 찌 세트 10개 (0.5~3호)", brand: "어부", category: "FLOAT", price: 18000, feeRate: 12, shippingFee: 0 },
];

export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

    // FeaturedProduct 테이블이 없으면 먼저 생성 (백틱 식별자 — SQLite/MariaDB 공통)
    // 실서버(MariaDB)에서는 prisma db push로 이미 존재하므로 보통 no-op이다.
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS \`FeaturedProduct\` (
          \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
          \`productId\` VARCHAR(191) NOT NULL,
          \`section\` VARCHAR(32) NOT NULL,
          \`order\` INTEGER NOT NULL DEFAULT 0,
          \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`FeaturedProduct_productId_section_key\` UNIQUE (\`productId\`, \`section\`)
        )
      `;
    } catch {
      // 이미 존재하는 경우 무시
    }

    // 섹션별 현재 order 최댓값 조회
    type OrderRow = { section: string; maxOrder: number };
    let sectionOrders: Record<string, number> = { TODAY: 0, WEEKLY: 0, MONTHLY: 0, BEST: 0 };
    try {
      const rows = await prisma.$queryRaw<OrderRow[]>`
        SELECT section, MAX(\`order\`) as maxOrder FROM \`FeaturedProduct\` GROUP BY section
      `;
      for (const r of rows) {
        sectionOrders[r.section] = Number(r.maxOrder) + 1;
      }
    } catch {
      // FeaturedProduct 테이블이 없는 경우 무시
    }

    let created = 0;
    const productIds: string[] = [];

    for (let i = 0; i < DUMMY_PRODUCTS.length; i++) {
      const p = DUMMY_PRODUCTS[i];
      const productId = genId();
      const imageUrl = img(`prod-dummy-${i}`);
      const buyUrl = "https://shopping.example.com";
      const desc = `${p.name}\n\n테스트용 더미 상품입니다.\n낚시 장비 전문 판매처에서 구매하실 수 있습니다.`;
      const now = toDbDate();

      // shippingFee 컬럼은 prisma generate 전이므로 raw SQL 사용
      await prisma.$executeRaw`
        INSERT INTO \`Product\` (id, name, brand, category, price, \`feeRate\`, \`imageUrl\`, \`buyUrl\`, \`affiliateCode\`, description, \`shippingFee\`, \`createdAt\`)
        VALUES (${productId}, ${p.name}, ${p.brand}, ${p.category}, ${p.price}, ${p.feeRate}, ${imageUrl}, ${buyUrl}, ${"DUMMY_SEED"}, ${desc}, ${p.shippingFee}, ${now})
      `;

      productIds.push(productId);
      created++;
    }

    // FeaturedProduct 섹션에 자동 배분
    let featuredCreated = 0;
    for (let i = 0; i < productIds.length; i++) {
      const section = SECTION_MAP[i] ?? "BEST";
      const order = sectionOrders[section] ?? 0;
      sectionOrders[section] = order + 1;
      const fid = genId();
      const now = toDbDate();

      try {
        await prisma.$executeRaw`
          INSERT INTO \`FeaturedProduct\` (id, \`productId\`, section, \`order\`, \`createdAt\`)
          VALUES (${fid}, ${productIds[i]}, ${section}, ${order}, ${now})
        `;
        featuredCreated++;
      } catch {
        // unique 제약 위반 등 무시
      }
    }

    return NextResponse.json({
      message: `쇼핑 상품 더미 ${created}개 생성 + 추천 섹션 ${featuredCreated}개 자동 배분 완료`,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
