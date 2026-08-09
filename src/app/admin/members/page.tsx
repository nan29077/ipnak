import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Table, StatusBadge } from "@/components/admin/ui";
import { getBoolSetting } from "@/lib/settings";
import { SearchBox } from "@/components/admin/SearchBox";
import { SortSelect } from "@/components/admin/SortSelect";
import { FilterChips } from "@/components/admin/FilterChips";
import { Pagination } from "@/components/admin/Pagination";
import { ActionButton } from "@/components/admin/ActionButton";
import { MemberPointTopup } from "@/components/admin/MemberPointTopup";
import { EmptyState } from "@/components/ui";
import { kstFormat } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { ensureKeyringTables } from "@/lib/ensureKeyringTables";

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

  const bassOnly = await getBoolSetting("bass_only_mode");
  const anglerLabel = bassOnly ? "앵글러" : "낚시꾼";
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: {
        _count: { select: { posts: true, followedBy: true } },
        linkedBalls: { select: { ballId: true } },
      },
      orderBy: SORTS[sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  // 입낚키링 연동 정보 — LinkedKeyring 은 Prisma 클라이언트에 아직 생성돼 있지 않아 raw 로 조회한다.
  const keyringByUser: Record<string, string[]> = {};
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    try {
      await ensureKeyringTables();
      const rows = await prisma.$queryRawUnsafe<{ userId: string; keyringId: string }[]>(
        `SELECT userId, keyringId FROM LinkedKeyring WHERE userId IN (${userIds.map(() => "?").join(",")}) ORDER BY linkedAt DESC`,
        ...userIds
      );
      for (const r of rows) (keyringByUser[r.userId] ||= []).push(r.keyringId);
    } catch { /* 테이블 미생성 등 — 키링 정보 없이 목록만 표시 */ }
  }

  // prisma generate 후 isActive가 타입에 포함됨 — 로컬 미생성 환경은 any로 우회
  const isSuspended = (u: (typeof users)[0]) =>
    (u as any).isActive === false || (u as any).isActive === 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminTitle title="회원 관리" desc={`총 ${total.toLocaleString()}명`} right={<SearchBox placeholder="닉네임/이메일 검색" />} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips param="role" defaultValue="" chips={[
          { value: "", label: "전체" },
          { value: "ANGLER", label: anglerLabel },
          { value: "PARTNER", label: "파트너" },
          { value: "SUPER_ADMIN", label: "관리자" },
        ]} />
        <SortSelect defaultValue="recent" options={[
          { value: "recent", label: "최신 가입순" },
          { value: "oldest", label: "오래된순" },
          { value: "nickname", label: "닉네임순" },
        ]} />
      </div>

      {/* PC 테이블 */}
      <div className="hidden md:block">
        <Table head={["닉네임", "이메일", "역할", "게시글", "팔로워", "포인트", "가입일", "입낚볼", "입낚키링", "관리"]}>
          {users.length === 0 && (
            <tr><td colSpan={10} className="p-0"><EmptyState title="회원이 없습니다" desc={q || role ? "검색 결과가 없습니다." : undefined} /></td></tr>
          )}
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <img src={getAvatarUrl(u.id, u.avatarUrl)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy-800">{u.nickname}</span>
                      {isSuspended(u) && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">정지</span>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-navy-500">{u.email}</td>
              <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
              <td className="px-4 py-3 text-navy-500">{u._count.posts}</td>
              <td className="px-4 py-3 text-navy-500">{u._count.followedBy}</td>
              <td className="px-4 py-3 font-semibold text-amber-600">{(u.points ?? 0).toLocaleString()}P</td>
              <td className="px-4 py-3 text-navy-400">{kstFormat(u.createdAt, "yyyy.MM.dd")}</td>
              <td className="px-4 py-3">
                {u.linkedBalls && u.linkedBalls.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {u.linkedBalls.map(lb => (
                      <div key={lb.ballId} className="flex items-center gap-1">
                        <span className="font-mono text-[10px] bg-orange-50 text-orange-600 border border-orange-200 rounded px-1.5 py-0.5 whitespace-nowrap">{lb.ballId}</span>
                        <span className="text-[10px] font-semibold text-green-600 whitespace-nowrap">연동중</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-navy-300">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                {(keyringByUser[u.id]?.length ?? 0) > 0 ? (
                  <div className="flex flex-col gap-1">
                    {keyringByUser[u.id].map(kid => (
                      <div key={kid} className="flex items-center gap-1">
                        <span className="font-mono text-[10px] bg-aqua-50 text-aqua-600 border border-aqua-200 rounded px-1.5 py-0.5 whitespace-nowrap">{kid}</span>
                        <span className="text-[10px] font-semibold text-green-600 whitespace-nowrap">연동중</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-navy-300">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <MemberPointTopup userId={u.id} nickname={u.nickname} points={u.points ?? 0} />
                  {u.role !== "SUPER_ADMIN" && (
                    <>
                      {u.role !== "PARTNER" ? (
                        <ActionButton payload={{ type: "USER_ROLE", id: u.id, role: "PARTNER" }} label="파트너 지정" successMsg="역할이 변경되었습니다" />
                      ) : (
                        <ActionButton payload={{ type: "USER_ROLE", id: u.id, role: "ANGLER" }} label={`${anglerLabel}으로`} successMsg="역할이 변경되었습니다" />
                      )}
                      <ActionButton
                        payload={{ type: "USER_SUSPEND", id: u.id }}
                        label={isSuspended(u) ? "정지해제" : "활동정지"}
                        variant={isSuspended(u) ? "default" : "danger"}
                        confirm={isSuspended(u) ? `[${u.nickname}] 회원의 정지를 해제하시겠습니까?` : `[${u.nickname}] 회원을 활동정지 하시겠습니까?`}
                        successMsg={isSuspended(u) ? "정지가 해제되었습니다" : "활동이 정지되었습니다"}
                      />
                      <ActionButton
                        payload={{ type: "USER_DELETE", id: u.id }}
                        label="삭제"
                        variant="danger"
                        confirm={`[${u.nickname}] 회원을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
                        successMsg="회원이 삭제되었습니다"
                      />
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* 모바일 카드 목록 */}
      <div className="space-y-3 md:hidden">
        {users.length === 0 && (
          <EmptyState title="회원이 없습니다" desc={q || role ? "검색 결과가 없습니다." : undefined} />
        )}
        {users.map((u) => (
          <div key={u.id} className={`rounded-2xl border bg-white px-3 py-3 shadow-card ${isSuspended(u) ? "border-red-200 opacity-70" : "border-navy-100"}`}>
            <div className="flex items-center gap-2.5">
              <img src={getAvatarUrl(u.id, u.avatarUrl)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-navy-800">{u.nickname}</span>
                  <StatusBadge status={u.role} />
                  {isSuspended(u) && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">정지</span>}
                </div>
                <p className="truncate text-[12px] text-navy-400">{u.email}</p>
              </div>
              {((u.linkedBalls?.length ?? 0) > 0 || (keyringByUser[u.id]?.length ?? 0) > 0) && (
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {u.linkedBalls.map(lb => (
                    <div key={lb.ballId} className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-[10px] bg-orange-50 text-orange-600 border border-orange-200 rounded px-1.5 py-0.5 whitespace-nowrap">{lb.ballId}</span>
                      <span className="text-[10px] font-semibold text-green-600">연동중</span>
                    </div>
                  ))}
                  {(keyringByUser[u.id] ?? []).map(kid => (
                    <div key={kid} className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-[10px] bg-aqua-50 text-aqua-600 border border-aqua-200 rounded px-1.5 py-0.5 whitespace-nowrap">{kid}</span>
                      <span className="text-[10px] font-semibold text-green-600">연동중</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-navy-400">
              <span>게시글 {u._count.posts}</span>
              <span>팔로워 {u._count.followedBy}</span>
              <span className="font-semibold text-amber-600">{(u.points ?? 0).toLocaleString()}P</span>
              <span>가입 {kstFormat(u.createdAt, "yy.MM.dd")}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <MemberPointTopup userId={u.id} nickname={u.nickname} points={u.points ?? 0} />
              {u.role !== "SUPER_ADMIN" && (
                <>
                  {u.role !== "PARTNER" ? (
                    <ActionButton payload={{ type: "USER_ROLE", id: u.id, role: "PARTNER" }} label="파트너 지정" successMsg="역할이 변경되었습니다" />
                  ) : (
                    <ActionButton payload={{ type: "USER_ROLE", id: u.id, role: "ANGLER" }} label={`${anglerLabel}으로`} successMsg="역할이 변경되었습니다" />
                  )}
                  <ActionButton
                    payload={{ type: "USER_SUSPEND", id: u.id }}
                    label={isSuspended(u) ? "정지해제" : "활동정지"}
                    variant={isSuspended(u) ? "default" : "danger"}
                    confirm={isSuspended(u) ? `[${u.nickname}] 회원의 정지를 해제하시겠습니까?` : `[${u.nickname}] 회원을 활동정지 하시겠습니까?`}
                    successMsg={isSuspended(u) ? "정지가 해제되었습니다" : "활동이 정지되었습니다"}
                  />
                  <ActionButton
                    payload={{ type: "USER_DELETE", id: u.id }}
                    label="삭제"
                    variant="danger"
                    confirm={`[${u.nickname}] 회원을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
                    successMsg="회원이 삭제되었습니다"
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
