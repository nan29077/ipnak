import { getCurrentUser } from "@/lib/auth";
import { getWalkingFeedPosts } from "@/lib/queries";
import { WalkingFeedPage } from "@/components/WalkingFeedPage";

export const dynamic = "force-dynamic";

export default async function WalkingPage() {
  const user = await getCurrentUser();
  const posts = await getWalkingFeedPosts(user?.id);
  return <WalkingFeedPage posts={posts} currentUserId={user?.id} />;
}
