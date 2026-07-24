import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getFollowList } from "@/lib/profile";
import { FollowListView } from "@/components/FollowListView";

export const dynamic = "force-dynamic";

export default async function FollowingPage({ params }: { params: { id: string } }) {
  const viewer = await getCurrentUser();
  const data = await getFollowList(params.id, "following", viewer?.id);
  if (!data) notFound();

  return (
    <FollowListView
      title="팔로잉"
      ownerNickname={data.user.nickname}
      people={data.people}
      viewerId={viewer?.id}
      emptyText="아직 팔로잉한 회원이 없습니다"
    />
  );
}
