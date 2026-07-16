import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { FeedList } from "@/components/FeedList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const posts = await getFeedPosts(user?.id);
  const banners = await prisma.banner.findMany({ where: { active: true }, orderBy: { order: "asc" } });
  return <FeedList posts={posts} currentUserId={user?.id} banners={banners.map((b) => ({ title: b.title, imageUrl: b.imageUrl }))} />;
}
