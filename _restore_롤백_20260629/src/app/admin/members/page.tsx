import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Table, StatusBadge } from "@/components/admin/ui";
import { SearchBox } from "@/components/admin/SearchBox";
import { SortSelect } from "@/components/admin/SortSelect";
import { FilterChips } from "@/components/admin/FilterChips";
import { Pagination } from "@/components/admin/Pagination";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { kstFormat } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const SORTS: Record<string, Prisma.UserOrderByWithRelationInput> = {
  recent: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  nickname: { nickname: "asc" },
};

export default async function AdminMembers({ searchParams }: { searchParams: { q?: string; role?: string; sort?: string; page?: string } }) {
  const q = searchParams.q?.trim();
  const role = searchParams.role;
  const sort = searchParams.sort && SORTS[searchParams.sort] ? searchParams.sort : "recent";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ nickname: { contains: q } }, { email: { contains: q } }] } : {}),
    ...(role ? { role } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { _count: { select: { posts: true, followedBy: true } } },
      orderBy: SORTS[sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminTitle title="회원 관리" desc={`총 ${total.toLocaleString()}명`} right={<SearchBox placeholder="닉네임/이메일 검색" />} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips param="role" defaultValue="" chips={[
          { value: "", label: "전체" },
          { value: "ANGLER", label: "낚시꾼" },
          { value: "PARTNER", label: "파트너" },
          { value: "SUPER_ADMIN", label: "관리자" },
        ]} />
        <SortSelect defaultValue="recent" options={[
          { value: "recent", label: "최신 가입순" },
          { value: "oldest", label: "오래된순" },
          { value: "nickname", label: "닉네임순" },
        ]} />
      </div>

      <Table head={["닉네임", "이메일", "역할", "게시글", "팔로워", "가입일", "관리"]}>
        {users.length === 0 && (
          <tr><td colSpan={7} className="p-0"><EmptyState title="회원이 없습니다" desc={q || role ? "검색 결과가 없습니다." : undefined} /></td></tr>
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
            <td className="px-4 py-3 text-navy-400">{kstFormat(u.createdAt, "yyyy.MM.dd")}</td>
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

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
