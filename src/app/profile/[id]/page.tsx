import { notFound } from "next/navigation";
import { MapPin, Fish, Ruler } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getProfileData } from "@/lib/profile";
import { ProfileView } from "@/components/ProfileView";
import { FollowButton } from "@/components/FollowButton";
import { PageHeader, Card, Badge, Chip, Button } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/taxonomy";
import { getAvatarUrl } from "@/lib/avatarUtils";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const viewer = await getCurrentUser();
  const data = await getProfileData(params.id, viewer?.id);
  if (!data) notFound();
  const { user, stats } = data;
  const isMe = viewer?.id === user.id;

  return (
    <div className="pb-6">
      <PageHeader title={user.nickname} back sub={ROLE_LABELS[user.role]} />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <img src={getAvatarUrl(user.id, user.avatarUrl)} alt={user.nickname} className="h-20 w-20 rounded-full border border-navy-100 object-cover shadow-soft" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-bold text-navy-800">{user.nickname}</p>
              <Badge tone="navy">{ROLE_LABELS[user.role]}</Badge>
            </div>
            {user.region && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-navy-400">
                <MapPin size={13} />{user.region}
              </p>
            )}
          </div>
        </div>

        <Card className="grid grid-cols-3 divide-x divide-navy-100 p-0">
          <Stat n={stats.postCount} label="게시글" />
          <Stat n={stats.followerCount} label="팔로워" />
          <Stat n={stats.followingCount} label="팔로잉" />
        </Card>

        {user.bio && <p className="text-sm leading-relaxed text-navy-600">{user.bio}</p>}

        {(stats.topSpecies || stats.maxSize) && (
          <div className="flex flex-wrap gap-1.5">
            {stats.topSpecies && <Badge tone="aqua"><Fish size={12} className="mr-0.5" />대표어종 {stats.topSpecies}</Badge>}
            {stats.maxSize && <Badge tone="amber"><Ruler size={12} className="mr-0.5" />최대 {stats.maxSize}cm</Badge>}
          </div>
        )}

        {user.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {user.interests.map((i) => <Chip key={i} as="span" size="sm">#{i}</Chip>)}
          </div>
        )}

        <div>
          {isMe ? (
            <a href="/me"><Button variant="outline" full>내 프로필 관리</Button></a>
          ) : (
            <FollowButton userId={user.id} initial={data.isFollowing} />
          )}
        </div>
      </div>

      <ProfileView posts={data.posts} points={data.points} entries={data.entries} />
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="px-2 py-3 text-center">
      <p className="text-lg font-bold text-navy-800">{n}</p>
      <p className="text-xs text-navy-400">{label}</p>
    </div>
  );
}
