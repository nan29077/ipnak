import { prisma } from "./prisma";

// 신규 모델(ReferralEvent)은 prisma generate 이후 타입에 반영된다.
// 빌드 전 타입 일치를 위해 접근 경계에서만 캐스팅한다.
const db = prisma as any;

const DEFAULT_FEE_RATE = 10;
// 데모(MOCK) 전환 확률: 클릭의 일부가 구매로 이어지는 것을 시뮬레이션
const MOCK_CONVERSION_RATE = 0.35;

/** 실 제휴 API 키가 설정되어 있으면 LIVE, 아니면 MOCK */
export function affiliateEnabled() {
  return !!(process.env.COMMERCE_AFFILIATE_KEY && process.env.COMMERCE_AFFILIATE_KEY.trim());
}

export type ClickResult = { ok: boolean; source: "MOCK" | "LIVE"; converted: boolean; reward: number; amount: number };

/**
 * 피싱태그 클릭/전환 기록.
 * - 항상 CLICK 이벤트를 남긴다.
 * - MOCK 모드: 일정 확률로 CONVERSION(구매) 이벤트를 생성해 작성자에게 리퍼럴 수익을 적립(시뮬레이션).
 * - LIVE 모드: 클릭만 기록하고, 전환은 제휴사 웹훅으로 별도 적립(연동 자리).
 */
export async function recordReferralClick(opts: {
  postId: string; productId: string; earnerId: string; visitorId?: string | null;
}): Promise<ClickResult> {
  const source: "MOCK" | "LIVE" = affiliateEnabled() ? "LIVE" : "MOCK";
  const selfTraffic = !!opts.visitorId && opts.visitorId === opts.earnerId;
  try {
    await db.referralEvent.create({
      data: { postId: opts.postId, productId: opts.productId, earnerId: opts.earnerId, visitorId: opts.visitorId ?? null, type: "CLICK", source },
    });

    let converted = false, reward = 0, amount = 0;
    if (source === "MOCK" && !selfTraffic && Math.random() < MOCK_CONVERSION_RATE) {
      const product = await db.product.findUnique({ where: { id: opts.productId } });
      amount = product?.price ?? 0;
      const rate = product?.feeRate ?? DEFAULT_FEE_RATE;
      reward = Math.round((amount * rate) / 100);
      await db.referralEvent.create({
        data: { postId: opts.postId, productId: opts.productId, earnerId: opts.earnerId, visitorId: opts.visitorId ?? null, type: "CONVERSION", source, amount, reward, externalId: `mock_${Date.now()}` },
      });
      converted = true;
    }
    return { ok: true, source, converted, reward, amount };
  } catch {
    // prisma db push 전: ReferralEvent 테이블/모델 미존재 → 추적 생략(이동은 정상 진행)
    return { ok: false, source, converted: false, reward: 0, amount: 0 };
  }
}

export type ReferralEarnings = {
  enabled: boolean; source: "MOCK" | "LIVE";
  totalReward: number; totalSales: number; clickCount: number; conversionCount: number;
  events: {
    id: string; type: string; amount: number; reward: number; createdAt: string;
    product: { name: string; imageUrl: string | null; category: string } | null;
    post: { id: string; kind: string; title: string | null; caption: string | null } | null;
  }[];
};

const EMPTY_EARNINGS = (): ReferralEarnings => ({
  enabled: affiliateEnabled(), source: affiliateEnabled() ? "LIVE" : "MOCK",
  totalReward: 0, totalSales: 0, clickCount: 0, conversionCount: 0, events: [],
});

export async function getReferralEarnings(userId: string): Promise<ReferralEarnings> {
  try {
    return await loadReferralEarnings(userId);
  } catch {
    // prisma db push 전: ReferralEvent 미존재 → 빈 수익 내역
    return EMPTY_EARNINGS();
  }
}

async function loadReferralEarnings(userId: string): Promise<ReferralEarnings> {
  const events = await db.referralEvent.findMany({
    where: { earnerId: userId },
    include: {
      product: { select: { name: true, imageUrl: true, category: true } },
      post: { select: { id: true, kind: true, title: true, caption: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  const conv = (events as any[]).filter((e) => e.type === "CONVERSION");
  return {
    enabled: affiliateEnabled(),
    source: affiliateEnabled() ? "LIVE" : "MOCK",
    totalReward: conv.reduce((s, e) => s + (e.reward || 0), 0),
    totalSales: conv.reduce((s, e) => s + (e.amount || 0), 0),
    clickCount: (events as any[]).filter((e) => e.type === "CLICK").length,
    conversionCount: conv.length,
    events: (events as any[]).map((e) => ({
      id: e.id, type: e.type, amount: e.amount || 0, reward: e.reward || 0, createdAt: e.createdAt.toISOString(),
      product: e.product ? { name: e.product.name, imageUrl: e.product.imageUrl, category: e.product.category } : null,
      post: e.post ? { id: e.post.id, kind: e.post.kind, title: e.post.title, caption: e.post.caption } : null,
    })),
  };
}
