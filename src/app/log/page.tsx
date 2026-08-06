import { getCurrentUser } from "@/lib/auth";
import { getLogPostsPage, getLogCategoryCounts } from "@/lib/queries";
import { LogBoard } from "@/components/LogBoard";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default async function LogListPage() {
  const user = await getCurrentUser();
  const [{ posts, nextCursor }, counts] = await Promise.all([getLogPostsPage(undefined, undefined, 20, user?.id), getLogCategoryCounts()]);
  return (
    <>
      <LogBoard posts={posts} nextCursor={nextCursor} counts={counts} currentUserId={user?.id} />
      <SiteFooter pageKey="log" />
    </>
  );
}
