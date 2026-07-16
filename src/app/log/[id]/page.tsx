import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLogPost } from "@/lib/queries";
import { LogDetail } from "@/components/LogDetail";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LogDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const post = await getLogPost(params.id, user?.id);
  if (!post) notFound();
  return (
    <div>
      <PageHeader title="조행기" back />
      <LogDetail post={post} currentUserId={user?.id} />
    </div>
  );
}
