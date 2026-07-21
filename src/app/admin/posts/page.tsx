import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { SearchBox } from "@/components/admin/SearchBox";
import { ActionButton } from "@/components/admin/ActionButton";
import { Badge, EmptyState } from "@/components/ui";
import { kstFormat } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { GENERAL: "일반", FISHING_POINT: "피싱포인트", TOURNAMENT: "대회" };

export default async function AdminPosts({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const posts = await prisma.post.findMany({
    where: q ? { OR: [{ caption: { contains: q } }, { speciesName: { contains: q } }, { region: { contains: q } }] } : undefined,
    include: { author: { select: { nickname: true } }, images: { take: 1, orderBy: { order: "asc" } }, _count: { select: { likes: true, comments: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });

  return (
    <div>
      <AdminTitle title="게시글 / 피싱포인트 관리" desc={`총 ${posts.length}개`} right={<SearchBox placeholder="캡션/어종/지역 검색" />} />

      {/* PC 테이블 */}
      <div className="hidden md:block">
        <Table head={["사진", "작성자", "타입", "내용", "좋아요", "댓글", "상태", "등록일", "관리"]}>
          {posts.length === 0 && (
            <tr><td colSpan={9} className="p-0"><EmptyState title="게시글이 없습니다" desc={q ? "검색 결과가 없습니다." : undefined} /></td></tr>
          )}
          {posts.map((p) => (
            <tr key={p.id} className={p.hidden ? "opacity-50" : ""}>
              <td className="px-4 py-3"><img src={p.images[0]?.url || ""} alt="" className="h-10 w-10 rounded-lg object-cover" /></td>
              <td className="px-4 py-3 font-semibold text-navy-800">{p.author.nickname}</td>
              <td className="px-4 py-3 text-navy-500">{TYPE[p.postType]}</td>
              <td className="max-w-[200px] truncate px-4 py-3 text-navy-500">{p.caption}</td>
              <td className="px-4 py-3 text-navy-500">{p._count.likes}</td>
              <td className="px-4 py-3 text-navy-500">{p._count.comments}</td>
              <td className="px-4 py-3">{p.hidden ? <Badge tone="red">숨김</Badge> : <Badge tone="aqua">공개</Badge>}</td>
              <td className="px-4 py-3 text-navy-400">{kstFormat(p.createdAt, "MM.dd")}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  <Link href={`/post/${p.id}`} className="rounded-lg bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-700">보기</Link>
                  {p.hidden
                    ? <ActionButton payload={{ type: "POST_HIDE", id: p.id, hidden: false }} label="공개" successMsg="공개 처리됨" />
                    : <ActionButton payload={{ type: "POST_HIDE", id: p.id, hidden: true }} label="숨김" variant="danger" successMsg="숨김 처리됨" />}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* 모바일 카드 목록 */}
      <div className="space-y-3 md:hidden">
        {posts.length === 0 && <EmptyState title="게시글이 없습니다" desc={q ? "검색 결과가 없습니다." : undefined} />}
        {posts.map((p) => (
          <div key={p.id} className={`rounded-2xl border border-navy-100 bg-white px-3 py-3 shadow-card ${p.hidden ? "opacity-50" : ""}`}>
            <div className="flex items-start gap-2.5">
              {p.images[0]?.url && (
                <img src={p.images[0].url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-navy-800">{p.author.nickname}</span>
                  <Badge tone={p.postType === "FISHING_POINT" ? "aqua" : "gray"}>{TYPE[p.postType]}</Badge>
                  {p.hidden ? <Badge tone="red">숨김</Badge> : null}
                </div>
                {p.caption && <p className="mt-0.5 truncate text-[12px] text-navy-500">{p.caption}</p>}
                <p className="mt-0.5 text-[11px] text-navy-300">좋아요 {p._count.likes} · 댓글 {p._count.comments} · {kstFormat(p.createdAt, "MM.dd")}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Link href={`/post/${p.id}`} className="rounded-lg bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-700">보기</Link>
              {p.hidden
                ? <ActionButton payload={{ type: "POST_HIDE", id: p.id, hidden: false }} label="공개" successMsg="공개 처리됨" />
                : <ActionButton payload={{ type: "POST_HIDE", id: p.id, hidden: true }} label="숨김" variant="danger" successMsg="숨김 처리됨" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
