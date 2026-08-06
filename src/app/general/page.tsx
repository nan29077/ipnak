import { getCurrentUser } from "@/lib/auth";
import { getFeedPostsPage } from "@/lib/queries";
import { FeedList } from "@/components/FeedList";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

// 일반 피드 — 피싱 사진 위주가 아닌 자유 게시글 목록
export default async function GeneralFeedPage() {
  const user = await getCurrentUser();
  const { posts, nextCursor } = await getFeedPostsPage(user?.id, { kind: "GENERAL" });
  return (
    <>
      <FeedList
        posts={posts}
        nextCursor={nextCursor}
        feedKind="GENERAL"
        currentUserId={user?.id}
      />
      <SiteFooter pageKey="general" />
    </>
  );
}
