import Link from "next/link";
import { Eye, Heart, MessageSquare, Bookmark, Fish, TrendingUp } from "lucide-react";
import { getRankedPosts, type RankOpts } from "@/lib/curation";
import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { timeAgo, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function buildTitle(species: string | null, period: string, sort: string) {
  const periodLabel = period === "weekly" ? "금주 " : period === "monthly" ? "월간 " : "";
  const sortLabel = sort === "best" ? "베스트" : "최신";
  if (species) return `${species} ${periodLabel}${sort === "best" ? "베스트" : "포인트"}`.trim();
  return `${periodLabel}${sortLabel} 글 모아보기`.trim();
}

function qs(base: SP, over: Record<string, string | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) { const s = one(v); if (s) sp.set(k, s); }
  for (const [k, v] of Object.entries(over)) { if (v === null) sp.delete(k); else sp.set(k, v); }
  const s = sp.toString();
  return `/explore${s ? `?${s}` : ""}`;
}

export default async function ExplorePage({ searchParams }: { searchParams: SP }) {
  const species = one(searchParams.species) ?? null;
  const region = one(searchParams.region) ?? null;
  const keywords = (one(searchParams.keywords) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const period = (one(searchParams.period) as RankOpts["period"]) ?? "all";
  const sort = (one(searchParams.sort) as RankOpts["sort"]) ?? "best";
  const kind = (one(searchParams.kind) as RankOpts["kind"]) ?? "all";

  const posts = await getRankedPosts({ species, region, keywords, period, sort, kind, limit: 60 });
  const headline = species || region || (keywords.length ? keywords[0] : null);
  const title = headline ? `${headline} ${period === "weekly" ? "금주 " : period === "monthly" ? "월간 " : ""}${sort === "best" ? "베스트" : "포인트"}`.trim() : buildTitle(species, period ?? "all", sort ?? "best");

  const periodChips = [{ k: "all", l: "전체" }, { k: "weekly", l: "금주" }, { k: "monthly", l: "월간" }];
  const sortChips = [{ k: "best", l: "인기순" }, { k: "recent", l: "최신순" }];
  const kindChips = [{ k: "all", l: "전체" }, { k: "FEED", l: "피싱 피드" }, { k: "LOG", l: "조행기" }];

  return (
    <div className="pb-10">
      <PageHeader title={title} back sub={species ? `${species} · ${posts.length}건` : `${posts.length}건`} />

      {/* 필터 */}
      <div className="sticky top-[6.5rem] z-20 space-y-2 border-b border-navy-100 bg-[#161616]/85 px-3 py-2.5 backdrop-blur-md">
        <ChipRow label="기간" chips={periodChips} active={period ?? "all"} hrefFor={(k) => qs(searchParams, { period: k === "all" ? null : k })} />
        <ChipRow label="정렬" chips={sortChips} active={sort ?? "best"} hrefFor={(k) => qs(searchParams, { sort: k })} />
        <ChipRow label="종류" chips={kindChips} active={kind ?? "all"} hrefFor={(k) => qs(searchParams, { kind: k === "all" ? null : k })} />
      </div>

      {posts.length === 0 ? (
        <EmptyState title="해당하는 글이 없어요" desc="기간·정렬·종류를 바꾸거나 회원 글이 쌓이면 채워져요." action={<LinkButton href="/">홈으로</LinkButton>} />
      ) : (
        <ul className="divide-y divide-navy-100">
          {posts.map((p, i) => (
            <li key={p.id}>
              <Link href={p.href} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
                {sort === "best" && (
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[12px] font-extrabold text-orange-400">{i + 1}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[11px] font-bold text-orange-400">{p.boardLabel ?? (p.kind === "LOG" ? "조행기" : "피싱 피드")}</span>
                    {p.speciesName && <span className="inline-flex items-center gap-0.5 text-[11px] text-aqua-300"><Fish size={10} />{p.speciesName}</span>}
                    {p.region && <span className="text-[11px] text-navy-400">{p.region}</span>}
                  </div>
                  <p className="line-clamp-1 text-[14.5px] font-bold leading-snug text-navy-900">{p.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-navy-300">
                    <span className="font-semibold text-navy-500">{p.author.nickname}</span>
                    <span>{timeAgo(p.createdAt)}</span>
                    <span className="inline-flex items-center gap-0.5"><Eye size={12} />{p.viewCount}</span>
                    <span className="inline-flex items-center gap-0.5"><Heart size={12} />{p.likeCount}</span>
                    <span className="inline-flex items-center gap-0.5"><MessageSquare size={12} />{p.commentCount}</span>
                    <span className="inline-flex items-center gap-0.5"><Bookmark size={12} />{p.bookmarkCount}</span>
                    <span className="ml-auto inline-flex items-center gap-0.5 font-bold text-orange-400"><TrendingUp size={12} />{p.score}</span>
                  </div>
                </div>
                {p.thumbnail && (
                  <span className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-navy-50">
                    <img src={p.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChipRow({ label, chips, active, hrefFor }: { label: string; chips: { k: string; l: string }[]; active: string; hrefFor: (k: string) => string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[11px] font-semibold text-navy-400">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {chips.map((c) => (
          <Link key={c.k} href={hrefFor(c.k)}
            className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors",
              active === c.k ? "bg-orange-500 text-white shadow-soft" : "bg-navy-50 text-navy-500 hover:bg-navy-100")}>
            {c.l}
          </Link>
        ))}
      </div>
    </div>
  );
}
