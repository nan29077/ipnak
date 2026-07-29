import { getCurrentUser } from "@/lib/auth";
import { getLogPostsPage, getLogCategoryCounts } from "@/lib/queries";
import { LogBoard } from "@/components/LogBoard";

export const dynamic = "force-dynamic";

export default async function LogListPage() {
  const user = await getCurrentUser();
  const [{ posts, nextCursor }, counts] = await Promise.all([getLogPostsPage(), getLogCategoryCounts()]);
  return <LogBoard posts={posts} nextCursor={nextCursor} counts={counts} currentUserId={user?.id} />;
}
