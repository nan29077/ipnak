import { getCurrentUser } from "@/lib/auth";
import { getWalkingFeedPostsPage } from "@/lib/queries";
import { WalkingFeedPage } from "@/components/WalkingFeedPage";

export const dynamic = "force-dynamic";

export default async function WalkingPage() {
  const user = await getCurrentUser();
  const { posts, nextCursor } = await getWalkingFeedPostsPage(user?.id);
  return <WalkingFeedPage posts={posts} nextCursor={nextCursor} currentUserId={user?.id} />;
}
