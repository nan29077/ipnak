import Link from "next/link";
import { Eye, Heart, MessageSquare, Bookmark, TrendingUp } from "lucide-react";
import { AdminTitle, Card } from "@/components/admin/ui";
import { Badge } from "@/components/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { SearchBox } from "@/components/admin/SearchBox";
import { getFeaturedForSection, getCurationCandidates, curationModelReady, getAdminSections } from "@/lib/curation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminCurationPage({ searchParams }: { searchParams: SP }) {
  const sectionList = await getAdminSections();
  const section = one(searchParams.section) || sectionList[0]?.key || "member_pick";
  const q = one(searchParams.q) || null;
  const def = sectionList.find((s) => s.key === section) ?? null;

  const [featured, candidates] = await Promise.all([
    getFeaturedForSection(section),
    getCurationCandidates({ section, q, limit: 50 }),
  ]);
  const ready = curationModelReady();

  return (
    <div>
      <AdminTitle title="메인 큐레이션 관리" desc="섹션별로 메인에 노출할 회원 글을 직접 골라 고정하거나, 비워두면 인기 점수순으로 자동 노출됩니다."
        right={<Link href="/admin/sections" className="rounded-lg bg-navy-50 px-3 py-2 text-[12.5px] font-semibold text-navy-600 hover:bg-navy-100">← 섹션 관리</Link>} />

      {!ready && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
          큐레이션 테이블이 아직 없습니다. 터미널에서 <code className="rounded bg-black/30 px-1">npm run db:push</code> 를 실행하면 고정 기능이 활성화됩니다. (지금도 메인은 점수순 자동 노출로 동작합니다.)
        </div>
      )}

      {/* 섹션 선택 */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {sectionList.map((s) => (
          <Link key={s.key} href={`/admin/curation?section=${s.key}`}
            className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              s.key === section ? "bg-orange-500 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100")}>
            {s.title}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 고정된 글 */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy-800">고정 노출 글 — {def?.title ?? section}</h2>
            <Badge tone={featured.length ? "green" : "gray"}>{featured.length ? `${featured.length}개 고정` : "자동 노출"}</Badge>
          </div>
          {featured.length === 0 ? (
            <p className="rounded-xl bg-white/[0.03] px-3 py-6 text-center text-[13px] text-navy-400">
              고정된 글이 없습니다. 오른쪽 후보에서 글을 추가하거나, 비워두면 점수순으로 자동 노출됩니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {featured.map((p, i) => (
                <li key={p.featureId} className={cn("flex items-center gap-2.5 rounded-xl border border-navy-100 bg-[#1e1e1e] p-2", !p.visible && "opacity-50")}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[12px] font-bold text-orange-400">{i + 1}</span>
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-navy-50">
                    {p.thumbnail && <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={p.href} className="block truncate text-[13px] font-semibold text-navy-900 hover:text-orange-400">{p.title}</Link>
                    <p className="truncate text-[11px] text-navy-400">{p.author.nickname} · <TrendingUp size={10} className="inline" />{p.score}점</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <ActionButton payload={{ type: "CURATION_MOVE", id: p.featureId, dir: "up" }} label="▲" variant="ghost" successMsg="이동됨" />
                    <ActionButton payload={{ type: "CURATION_MOVE", id: p.featureId, dir: "down" }} label="▼" variant="ghost" successMsg="이동됨" />
                    <ActionButton payload={{ type: "CURATION_TOGGLE", id: p.featureId }} label={p.visible ? "숨김" : "표시"} variant="default" successMsg="변경됨" />
                    <ActionButton payload={{ type: "CURATION_REMOVE", id: p.featureId }} label="제거" variant="danger" confirm="이 글을 섹션에서 제거할까요?" successMsg="제거됨" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 추천 후보 */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-navy-800">노출 추천 후보 (인기 점수순)</h2>
            <SearchBox placeholder="제목·어종·지역 검색" />
          </div>
          {candidates.length === 0 ? (
            <p className="rounded-xl bg-white/[0.03] px-3 py-6 text-center text-[13px] text-navy-400">후보 글이 없습니다.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
              {candidates.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 rounded-xl border border-navy-100 bg-[#1e1e1e] p-2">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-navy-50">
                    {p.thumbnail && <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={p.href} className="block truncate text-[13px] font-semibold text-navy-900 hover:text-orange-400">{p.title}</Link>
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-navy-400">
                      <Badge tone={p.kind === "LOG" ? "aqua" : "gray"}>{p.kind === "LOG" ? "조행기" : "피싱 피드"}</Badge>
                      <span className="inline-flex items-center gap-0.5"><Eye size={10} />{p.viewCount}</span>
                      <span className="inline-flex items-center gap-0.5"><Heart size={10} />{p.likeCount}</span>
                      <span className="inline-flex items-center gap-0.5"><MessageSquare size={10} />{p.commentCount}</span>
                      <span className="inline-flex items-center gap-0.5"><Bookmark size={10} />{p.bookmarkCount}</span>
                      <span className="font-bold text-orange-400">{p.score}점</span>
                    </p>
                  </div>
                  {p.inSection ? (
                    <Badge tone="green">노출중</Badge>
                  ) : (
                    <ActionButton payload={{ type: "CURATION_ADD", section, postId: p.id }} label="추가" variant="primary" successMsg="섹션에 추가됨" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
