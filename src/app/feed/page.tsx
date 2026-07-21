import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { FeedList } from "@/components/FeedList";

export const dynamic = "force-dynamic";

// 피싱 피드 전용 목록 — 메인 큐레이션 "피싱 피드" 섹션의 더보기 대상.
export default async function FeedPage() {
  const user = await getCurrentUser();
  const posts = await getFeedPosts(user?.id, { kind: "FEED" });
  const banners = await prisma.banner.findMany({ where: { active: true }, orderBy: { order: "asc" } });
  return <FeedList posts={posts} currentUserId={user?.id} banners={banners.map((b) => ({ title: b.title, imageUrl: b.imageUrl }))} />;
}
