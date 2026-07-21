import { prisma } from "@/lib/prisma";
import { AdminTitle, Table, StatusBadge } from "@/components/admin/ui";
import { SearchBox } from "@/components/admin/SearchBox";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminMembers({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ nickname: { contains: q } }, { email: { contains: q } }] } : undefined,
    include: { _count: { select: { posts: true, followedBy: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });

  return (
    <div>
      <AdminTitle title="회원 관리" desc={`총 ${users.length}명`} right={<SearchBox placeholder="닉네임/이메일 검색" />} />
      <Table head={["닉네임", "이메일", "역할", "게시글", "팔로워", "가입일", "관리"]}>
        {users.length === 0 && (
          <tr><td colSpan={7} className="p-0"><EmptyState title="회원이 없습니다" desc={q ? "검색 결과가 없습니다." : undefined} /></td></tr>
        )}
        {users.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <img src={u.avatarUrl || ""} alt="" className="h-7 w-7 rounded-full object-cover" />
                <span className="font-semibold text-navy-800">{u.nickname}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-navy-500">{u.email}</td>
            <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
            <td className="px-4 py-3 text-navy-500">{u._count.posts}</td>
            <td className="px-4 py-3 text-navy-500">{u._count.followedBy}</td>
            <td className="px-4 py-3 text-navy-400">{format(u.createdAt, "yyyy.MM.dd")}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1.5">
                {u.role !== "SUPER_ADMIN" && (
                  <>
                    {u.role !== "PARTNER" ? (
                      <ActionButton payload={{ type: "USER_ROLE", id: u.id, role: "PARTNER" }} label="파트너 지정" successMsg="역할이 변경되었습니다" />
                    ) : (
                      <ActionButton payload={{ type: "USER_ROLE", id: u.id, role: "ANGLER" }} label="낚시꾼으로" successMsg="역할이 변경되었습니다" />
                    )}
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
