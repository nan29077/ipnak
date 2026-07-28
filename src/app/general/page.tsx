import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts } from "@/lib/queries";
import { FeedList } from "@/components/FeedList";

export const dynamic = "force-dynamic";

// 일반 피드 — 피싱 사진 위주가 아닌 자유 게시글 목록
export default async function GeneralFeedPage() {
  const user = await getCurrentUser();
  const posts = await getFeedPosts(user?.id, { kind: "FEED" });
  return <FeedList posts={posts} currentUserId={user?.id} />;
}
