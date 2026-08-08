import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { FollowButton } from "@/components/FollowButton";
import { getAvatarUrl } from "@/lib/avatarUtils";

type Person = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  region: string | null;
  isFollowing: boolean;
  isSelf: boolean;
};

export function FollowListView({
  title, ownerNickname, people, viewerId, emptyText,
}: {
  title: string;
  ownerNickname: string;
  people: Person[];
  viewerId?: string;
  emptyText: string;
}) {
  return (
    <div className="pb-10">
      <PageHeader title={title} back sub={`${ownerNickname}님`} />
      {people.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <ul>
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-navy-100 px-4 py-3">
              <Link href={`/profile/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 transition-colors active:opacity-70">
                <img
                  src={getAvatarUrl(p.id, p.avatarUrl)}
                  alt={p.nickname}
                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-navy-100"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-navy-900">{p.nickname}</p>
                  {p.bio ? (
                    <p className="truncate text-[12px] text-navy-300">{p.bio}</p>
                  ) : p.region ? (
                    <p className="flex items-center gap-1 truncate text-[12px] text-navy-300"><MapPin size={11} />{p.region}</p>
                  ) : null}
                </div>
              </Link>
              {viewerId && !p.isSelf && (
                <div className="w-[84px] shrink-0">
                  <FollowButton userId={p.id} initial={p.isFollowing} size="sm" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
