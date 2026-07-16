import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPost } from "@/lib/queries";
import { FeedCard } from "@/components/FeedCard";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const post = await getPost(params.id, user?.id);
  if (!post) notFound();
  return (
    <div className="pb-10">
      <PageHeader title="게시글" back />
      <div className="mx-auto max-w-[640px] md:p-4">
        <FeedCard post={post} currentUserId={user?.id} />
      </div>
    </div>
  );
}
