import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Card } from "@/components/admin/ui";
import { kstFormat } from "@/lib/utils";
import { Users, Fish, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  const groups = await prisma.$queryRawUnsafe<any[]>(
    `SELECT g.*, u."nickname" as "leaderNickname",
            COUNT(m."id") as "memberCount"
     FROM "Group" g
     LEFT JOIN "User" u ON u."id" = g."leaderId"
     LEFT JOIN "GroupMember" m ON m."groupId" = g."id" AND m."role" IN ('leader','member')
     GROUP BY g."id"
     ORDER BY g."createdAt" DESC
     LIMIT 100`
  );

  const totalGroups = groups.length;
  const totalMembers = groups.reduce((s: number, g: any) => s + Number(g.memberCount || 0), 0);

  return (
    <div>
      <AdminTitle title="낚시단 관리" desc="전체 낚시단 목록 및 현황" />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-2xl font-extrabold text-navy-800">{totalGroups}</p>
          <p className="text-[13px] text-navy-400">전체 낚시단</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-extrabold text-navy-800">{totalMembers}</p>
          <p className="text-[13px] text-navy-400">총 가입 회원 수</p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-navy-100 px-4 py-3">
          <h2 className="text-sm font-bold text-navy-800">낚시단 전체 목록</h2>
        </div>
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-navy-300">낚시단이 없습니다</p>
        ) : (
          <div className="divide-y divide-navy-100/60">
            {groups.map((g: any) => (
              <Link key={g.id} href={`/groups/${g.id}`} target="_blank"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-navy-50/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-aqua-500/20">
                  <Fish size={16} className="text-orange-400" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold text-navy-800">{g.name}</p>
                    <span className="shrink-0 rounded-full bg-navy-50/60 px-1.5 py-0.5 text-[10px] text-navy-400">{g.category}</span>
                    {g.isPublic === 0 && (
                      <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-500">비공개</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-navy-400">
                    <span>리더: {g.leaderNickname}</span>
                    <span className="inline-flex items-center gap-0.5"><Users size={10} /> {Number(g.memberCount)}명</span>
                    {g.region && <span className="inline-flex items-center gap-0.5"><MapPin size={10} /> {g.region}</span>}
                    {g.fishSpecies && <span className="inline-flex items-center gap-0.5"><Fish size={10} /> {g.fishSpecies}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-navy-300">{kstFormat(g.createdAt, "yy.MM.dd")}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
