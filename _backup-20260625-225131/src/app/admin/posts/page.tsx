import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTitle, Table } from "@/components/admin/ui";
import { SearchBox } from "@/components/admin/SearchBox";
import { ActionButton } from "@/components/admin/ActionButton";
import { Badge, EmptyState } from "@/components/ui";
import { format } from "date-fns";

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
            <td className="px-4 py-3 text-navy-400">{format(p.createdAt, "MM.dd")}</td>
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
  );
}
