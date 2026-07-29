import { getCurrentUser } from "@/lib/auth";
import { getFeedPostsPage } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { getBoolSetting } from "@/lib/settings";
import { isBassOnlyPost } from "@/lib/taxonomy";
import { FeedList } from "@/components/FeedList";

export const dynamic = "force-dynamic";

// 피싱 피드 전용 목록 — 메인 큐레이션 "피싱 피드" 섹션의 더보기 대상.
export default async function FeedPage() {
  const user = await getCurrentUser();
  const [feedResult, banners, bassOnlyMode] = await Promise.all([
    getFeedPostsPage(user?.id, { kind: "FEED" }),
    prisma.banner.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    getBoolSetting("bass_only_mode"),
  ]);
  // 배스 전용 모드: 홈 "피싱 피드" 레일과 동일한 기준으로 배스 관련 글만 노출
  const visiblePosts = bassOnlyMode ? feedResult.posts.filter(isBassOnlyPost) : feedResult.posts;
  return (
    <FeedList
      posts={visiblePosts}
      nextCursor={feedResult.nextCursor}
      feedKind="FEED"
      currentUserId={user?.id}
      banners={banners.map((b) => ({ title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl }))}
    />
  );
}
