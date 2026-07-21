import { getCurrentUser } from "@/lib/auth";
import { getLogPosts, getLogCategoryCounts } from "@/lib/queries";
import { LogBoard } from "@/components/LogBoard";

export const dynamic = "force-dynamic";

export default async function LogListPage() {
  const user = await getCurrentUser();
  const [posts, counts] = await Promise.all([getLogPosts(), getLogCategoryCounts()]);
  return <LogBoard posts={posts} counts={counts} currentUserId={user?.id} />;
}
