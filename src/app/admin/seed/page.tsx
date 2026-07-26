import { prisma } from "@/lib/prisma";
import { AdminTitle } from "@/components/admin/ui";
import { SeedPanel } from "@/components/admin/SeedPanel";

export const dynamic = "force-dynamic";

export default async function AdminSeedPage() {
  const [anglerCount, postCount, logCount, marketCount, feedFishingCount, walkingFeedCount, generalFeedCount, productCount] = await Promise.all([
    prisma.user.count({ where: { role: "ANGLER" } }),
    prisma.post.count(),
    prisma.post.count({ where: { kind: "LOG" } }),
    prisma.marketListing.count(),
    // 피싱 피드: kind=FEED, speciesName 있는 것
    prisma.post.count({ where: { kind: "FEED", NOT: { speciesName: null } } }),
    // 워킹 피드
    prisma.post.count({ where: { kind: "WALKING" } }),
    // 일반 피드: kind=FEED, speciesName 없는 것
    prisma.post.count({ where: { kind: "FEED", speciesName: null } }),
    // 쇼핑 상품 (더미)
    prisma.product.count({ where: { affiliateCode: "DUMMY_SEED" } }),
  ]);

  return (
    <div>
      <AdminTitle
        title="더미 데이터 관리"
        desc="테스트용 더미 데이터를 기능별로 추가하거나 삭제할 수 있습니다"
      />
      <SeedPanel
        stats={{
          anglerCount,
          postCount,
          logCount,
          marketCount,
          feedCount: feedFishingCount,
          walkingFeedCount,
          generalFeedCount,
          productCount,
        }}
      />
    </div>
  );
}
