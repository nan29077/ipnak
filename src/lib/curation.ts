import { prisma } from "./prisma";
import { logCategoryLabel } from "./taxonomy";

// CurationFeature 모델은 prisma generate 이후 타입에 반영된다. 접근 경계에서만 캐스팅.
const db = prisma as any;

// ===== 인기 점수 합산 로직 =====
// 조회수 + 좋아요×3 + 댓글×4 + 저장×5 (관여도가 높은 행동에 가중치)
export const SCORE_WEIGHTS = { view: 1, like: 3, comment: 4, bookmark: 5 };
export function popularityScore(c: { viewCount?: number; likes?: number; comments?: number; bookmarks?: number }) {
  return (c.viewCount ?? 0) * SCORE_WEIGHTS.view
    + (c.likes ?? 0) * SCORE_WEIGHTS.like
    + (c.comments ?? 0) * SCORE_WEIGHTS.comment
    + (c.bookmarks ?? 0) * SCORE_WEIGHTS.bookmark;
}

export type CurationCardPost = {
  id: string; kind: string; href: string;
  title: string; caption: string | null; thumbnail: string | null;
  speciesName: string | null; sizeCm: number | null; region: string | null; boardLabel: string | null;
  viewCount: number; likeCount: number; commentCount: number; bookmarkCount: number; score: number;
  createdAt: string;
  author: { id: string; nickname: string; avatarUrl: string | null };
};

const cardInclude = {
  author: { select: { id: true, nickname: true, avatarUrl: true } },
  images: { orderBy: { order: "asc" as const }, take: 1 },
  _count: { select: { likes: true, comments: true, bookmarks: true } },
};

function toCard(p: any): CurationCardPost {
  const kind = p.kind ?? "FEED";
  const viewCount = p.viewCount ?? 0;
  const likeCount = p._count?.likes ?? 0;
  const commentCount = p._count?.comments ?? 0;
  const bookmarkCount = p._count?.bookmarks ?? 0;
  return {
    id: p.id, kind, href: kind === "LOG" ? `/log/${p.id}` : `/post/${p.id}`,
    title: p.title || (p.caption ? String(p.caption).slice(0, 40) : (p.speciesName ? `${p.speciesName} 조황` : "낚시 게시글")),
    caption: p.caption ?? null,
    thumbnail: p.images?.[0]?.url ?? null,
    speciesName: p.speciesName ?? null, sizeCm: p.sizeCm ?? null, region: p.region ?? null,
    boardLabel: kind === "LOG" ? logCategoryLabel(p.boardCategory) : null,
    viewCount, likeCount, commentCount, bookmarkCount,
    score: popularityScore({ viewCount, likes: likeCount, comments: commentCount, bookmarks: bookmarkCount }),
    createdAt: p.createdAt.toISOString(),
    author: { id: p.author.id, nickname: p.author.nickname, avatarUrl: p.author.avatarUrl },
  };
}

export type RankOpts = {
  kind?: "FEED" | "LOG" | "all";
  species?: string | null;
  authorId?: string | null;         // 특정 회원(프로 연결계정) 글만
  region?: string | null;          // 단일 지역(부분일치)
  regionKeywords?: string[];        // 지역 키워드 OR(부분일치) — 도/광역 확장용
  keywords?: string[];              // 테마 키워드 OR(캡션·지역·해시태그 부분일치)
  period?: "weekly" | "monthly" | "all";
  sort?: "best" | "recent";
  limit?: number;
  excludeIds?: string[];
  q?: string | null;
};

function sinceFor(period?: string): Date | null {
  if (period === "weekly") return new Date(Date.now() - 7 * 86400000);
  if (period === "monthly") return new Date(Date.now() - 30 * 86400000);
  return null;
}

// 점수/최신순 랭킹. db push 전(새 컬럼 미존재)에는 안전하게 빈 배열 반환.
// where 는 모두 기존 컬럼(speciesName/region/caption/hashtags/createdAt)만 사용 → 마이그레이션 전에도 안전.
export async function getRankedPosts(opts: RankOpts = {}): Promise<CurationCardPost[]> {
  const limit = opts.limit ?? 12;
  const where: any = { hidden: false };
  if (opts.kind && opts.kind !== "all") where.kind = opts.kind;
  if (opts.species) where.speciesName = opts.species;
  if (opts.authorId) where.authorId = opts.authorId;
  if (opts.region) where.region = { contains: opts.region };
  const since = sinceFor(opts.period);
  if (since) where.createdAt = { gte: since };
  const ors: any[] = [];
  if (opts.regionKeywords?.length) for (const k of opts.regionKeywords) ors.push({ region: { contains: k } });
  if (opts.keywords?.length) for (const k of opts.keywords) ors.push({ caption: { contains: k } }, { region: { contains: k } }, { hashtags: { contains: k } });
  if (opts.q) ors.push({ caption: { contains: opts.q } }, { speciesName: { contains: opts.q } }, { region: { contains: opts.q } }, { hashtags: { contains: opts.q } });
  if (ors.length) where.OR = ors;
  try {
    const rows = await prisma.post.findMany({ where, include: cardInclude, orderBy: { createdAt: "desc" }, take: 200 });
    let cards = (rows as any[]).map(toCard);
    if (opts.excludeIds?.length) {
      const ex = new Set(opts.excludeIds);
      cards = cards.filter((c) => !ex.has(c.id));
    }
    if ((opts.sort ?? "best") === "best") cards.sort((a, b) => b.score - a.score || +new Date(b.createdAt) - +new Date(a.createdAt));
    return cards.slice(0, limit);
  } catch {
    // 마이그레이션 전: kind/viewCount 등 미존재 → 빈 결과로 graceful
    return [];
  }
}

// ===== 동적 섹션 정의 =====
export const SECTION_TYPES = [
  { key: "SPECIES", label: "어종별 포인트" },
  { key: "REGION", label: "지역 포인트" },
  { key: "THEME", label: "동행·테마" },
  { key: "BEST", label: "베스트(금주·월간)" },
] as const;
export const sectionTypeLabel = (t: string) => (t === "PRO" ? "프로 추천" : SECTION_TYPES.find((x) => x.key === t)?.label ?? t);

// 어종 프리셋(관리자 빠른 추가용)
export const SPECIES_PRESETS = ["광어", "배스", "우럭", "농어", "붕어", "갈치", "감성돔", "참돔", "무늬오징어"];
// 지역(도/광역) 프리셋
export const REGION_PRESETS = ["서울", "경기", "충청도", "전라도", "경상도", "강원도", "제주"];
// 동행·테마 프리셋(키워드는 캡션·해시태그 부분일치로 자동 매칭)
export const THEME_PRESETS: { label: string; keywords: string[] }[] = [
  { label: "연인과 가기 좋은", keywords: ["연인", "커플", "데이트"] },
  { label: "친구와 가기 좋은", keywords: ["친구", "동출", "함께"] },
  { label: "가족과 가기 좋은", keywords: ["가족", "아이", "아들", "딸", "캠핑"] },
  { label: "초보 입문", keywords: ["초보", "입문", "처음"] },
];

const PROVINCE_KEYWORDS: Record<string, string[]> = {
  "수도권": ["한강", "팔당", "서울", "경기", "인천", "가평", "청평", "김포", "시화"],
  "서울": ["한강", "서울"],
  "경기": ["팔당", "경기", "가평", "청평", "김포"],
  "충청도": ["대청", "충청", "대전", "보령", "서산", "태안", "당진", "충남", "충북"],
  "전라도": ["여수", "군산", "전라", "전남", "전북", "목포", "순천", "광주", "전주", "고흥", "부안", "완도"],
  "경상도": ["낙동", "안동", "포항", "부산", "통영", "경상", "경남", "경북", "거제", "사천", "울산", "창원", "김해", "경주"],
  "강원도": ["속초", "강원", "양양", "고성", "삼척", "동해", "강릉"],
  "제주": ["제주", "서귀포"],
};
const provinceKeywords = (region?: string) => (region ? PROVINCE_KEYWORDS[region] ?? null : null);

export type RawSection = { id?: string; key: string; title: string; type: string; params: any; mode: string; order: number; visible: boolean };
export type ResolvedSection = {
  key: string; title: string; type: string; mode: string;
  style: "editorial" | "rank" | "rail" | "pro"; more: string; posts: CurationCardPost[];
  pro?: { name: string; imageUrl: string | null; bio: string | null };
};

// 기본 섹션(관리자 미설정/마이그레이션 전 폴백).
// 어종 포인트 2개(배스·붕어) + 지역별 이번 주 포인트(전라도·경상도·수도권).
export const DEFAULT_SECTIONS: RawSection[] = [
  { key: "member_pick", title: "회원 추천", type: "BEST", params: { period: "monthly", style: "editorial" }, mode: "AUTO", order: 10, visible: true },
  { key: "best_weekly", title: "금주 베스트", type: "BEST", params: { period: "weekly" }, mode: "AUTO", order: 20, visible: true },
  { key: "best_monthly", title: "월간 베스트", type: "BEST", params: { period: "monthly" }, mode: "AUTO", order: 30, visible: true },
  { key: "point_bass", title: "이번 달 배스 포인트", type: "SPECIES", params: { species: "배스" }, mode: "AUTO", order: 40, visible: true },
  { key: "point_crucian", title: "이번 달 붕어 포인트", type: "SPECIES", params: { species: "붕어" }, mode: "AUTO", order: 50, visible: true },
  { key: "region_jeolla", title: "전라도 이번 주 포인트", type: "REGION", params: { region: "전라도", period: "weekly" }, mode: "AUTO", order: 60, visible: true },
  { key: "region_gyeongsang", title: "경상도 이번 주 포인트", type: "REGION", params: { region: "경상도", period: "weekly" }, mode: "AUTO", order: 70, visible: true },
  { key: "region_capital", title: "수도권 이번 주 포인트", type: "REGION", params: { region: "수도권", period: "weekly" }, mode: "AUTO", order: 80, visible: true },
];

function parseParams(p: any): any { if (!p) return {}; if (typeof p === "object") return p; try { return JSON.parse(p) || {}; } catch { return {}; } }
const toArr = (v: any): string[] => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\s]+/).filter(Boolean) : []);

export function paramsToRankOpts(type: string, params: any): RankOpts {
  const period = (params.period as RankOpts["period"]) || "monthly";
  switch (type) {
    case "SPECIES": return { species: params.species, sort: "best", period };
    case "REGION": { const kw = provinceKeywords(params.region); return kw ? { regionKeywords: kw, sort: "best", period } : { region: params.region, sort: "best", period }; }
    case "THEME": return { keywords: toArr(params.keywords), sort: "best", period: (params.period as RankOpts["period"]) || "all" };
    case "BEST": return { kind: "all", sort: (params.sort as RankOpts["sort"]) || "best", period };
    case "PRO": return { authorId: params._authorId || "__nomatch__", sort: "best", period: (params.period as RankOpts["period"]) || "weekly" };
    case "FEED": return { kind: "FEED", sort: "recent", period: "all" };
    default: return { sort: "best", period };
  }
}

function styleFor(type: string, params: any, key: string): ResolvedSection["style"] {
  if (params.style === "editorial" || params.style === "rank" || params.style === "rail" || params.style === "pro") return params.style;
  if (type === "PRO") return "pro";
  if (key === "member_pick") return "editorial";
  if (type === "BEST") return "rank";
  return "rail";
}

export function sectionMoreLink(type: string, params: any): string {
  const sp = new URLSearchParams();
  if (params.species) sp.set("species", params.species);
  if (params.region) sp.set("region", params.region);
  if (params.keywords) sp.set("keywords", toArr(params.keywords).join(","));
  sp.set("sort", params.sort || "best");
  sp.set("period", params.period || (type === "BEST" ? "monthly" : "monthly"));
  return `/explore?${sp.toString()}`;
}

const featureInclude = { post: { include: cardInclude } };

// 섹션 행 가져오기: DB에 있으면 DB(전체, 정렬), 없으면 기본값
export async function getSectionRows(): Promise<RawSection[]> {
  try {
    const rows = await db.curationSection.findMany({ orderBy: { order: "asc" } });
    if (rows && rows.length) return (rows as any[]).map((r) => ({ id: r.id, key: r.key, title: r.title, type: r.type, params: parseParams(r.params), mode: r.mode, order: r.order, visible: r.visible }));
  } catch { /* 모델 미존재 → 기본값 */ }
  return DEFAULT_SECTIONS;
}

export const sectionLabel = (key: string) => DEFAULT_SECTIONS.find((s) => s.key === key)?.title ?? key;

// 한 섹션의 노출 글: 관리자 고정(featured) 우선 + 자동(점수순) 채움
async function resolveSectionPosts(key: string, autoOpts: RankOpts, limit: number): Promise<CurationCardPost[]> {
  let featured: CurationCardPost[] = [];
  try {
    const rows = await db.curationFeature.findMany({ where: { section: key, visible: true }, orderBy: { order: "asc" }, include: featureInclude, take: 40 });
    featured = (rows as any[]).map((r) => r.post).filter(Boolean).map(toCard);
  } catch { /* 모델 미존재 → featured 없음 */ }
  if (featured.length >= limit) return featured.slice(0, limit);
  const auto = await getRankedPosts({ ...autoOpts, excludeIds: featured.map((p) => p.id), limit: limit - featured.length });
  return [...featured, ...auto].slice(0, limit);
}

// 메인용: 보이는 섹션을 순서대로 해석해 글까지 채워 반환
export async function getMainSections(limitPerSection = 10): Promise<ResolvedSection[]> {
  await ensureDefaultSections(); // 새 기본 섹션(지역 주간 등) 자동 반영. 모델 없으면 무시.
  const [allRows, pros] = await Promise.all([getSectionRows(), getProsMap()]);
  const rows = allRows.filter((r) => r.visible !== false);
  return Promise.all(rows.map(async (r) => {
    const params = parseParams(r.params);
    let title = r.title;
    let more = sectionMoreLink(r.type, params);
    let opts: RankOpts;
    let pro: any = null;
    if (r.type === "PRO") {
      pro = params.proId ? pros[params.proId] : null;
      opts = paramsToRankOpts("PRO", { ...params, _authorId: pro?.linkedUserId || "__nomatch__" });
      if (pro?.name && !title) title = `${pro.name} 프로 추천 포인트`;
      more = pro?.linkedUserId ? `/profile/${pro.linkedUserId}` : "";
    } else {
      opts = paramsToRankOpts(r.type, params);
    }
    const posts = await resolveSectionPosts(r.key, opts, limitPerSection);
    const base: ResolvedSection = { key: r.key, title, type: r.type, mode: r.mode, style: styleFor(r.type, params, r.key), more, posts };
    if (r.type === "PRO" && pro) base.pro = { name: pro.name, imageUrl: pro.imageUrl ?? null, bio: pro.bio ?? null };
    return base;
  }));
}

// 기본 섹션을 DB에 시드(없는 키만 추가 — 새 기본 섹션도 반영). 기존 행의 편집/노출/순서는 건드리지 않음.
export async function ensureDefaultSections(): Promise<void> {
  try {
    const existing = await db.curationSection.findMany({ select: { key: true } });
    const have = new Set((existing as any[]).map((e) => e.key));
    const missing = DEFAULT_SECTIONS.filter((s) => !have.has(s.key));
    if (missing.length) {
      await db.curationSection.createMany({
        data: missing.map((s) => ({ key: s.key, title: s.title, type: s.type, params: JSON.stringify(s.params), mode: s.mode, order: s.order, visible: true })),
      });
    }
  } catch { /* 모델 미존재 → 무시 */ }
}

// ===== 프로/유튜버 =====
async function getProsMap(): Promise<Record<string, any>> {
  try {
    const list = await db.proAngler.findMany();
    const m: Record<string, any> = {};
    for (const p of list as any[]) m[p.id] = p;
    return m;
  } catch { return {}; }
}
export async function getPros(): Promise<any[]> {
  try { return await db.proAngler.findMany({ orderBy: { createdAt: "desc" } }); } catch { return []; }
}
export async function getProById(id: string) {
  try { return await db.proAngler.findUnique({ where: { id } }); } catch { return null; }
}
export function proModelReady() { return !!db.proAngler; }

// ===== 관리자용 =====
export async function getAdminSections(): Promise<RawSection[]> {
  return getSectionRows();
}
export async function getSectionByKey(key: string): Promise<RawSection | null> {
  const rows = await getSectionRows();
  return rows.find((r) => r.key === key) ?? null;
}
export async function getFeaturedForSection(key: string): Promise<(CurationCardPost & { featureId: string; order: number; visible: boolean })[]> {
  try {
    const rows = await db.curationFeature.findMany({ where: { section: key }, orderBy: { order: "asc" }, include: featureInclude, take: 60 });
    return (rows as any[]).filter((r) => r.post).map((r) => ({ ...toCard(r.post), featureId: r.id, order: r.order, visible: r.visible }));
  } catch {
    return [];
  }
}

// 추천 점수 높은 "메인 노출 후보" (관리자가 고를 대상). 이미 섹션에 들어간 글 표시.
export async function getCurationCandidates(opts: { section?: string; q?: string | null; kind?: "FEED" | "LOG" | "all"; limit?: number } = {}) {
  const cards = await getRankedPosts({ kind: opts.kind ?? "all", sort: "best", q: opts.q, limit: opts.limit ?? 60 });
  let inSection = new Set<string>();
  if (opts.section) {
    try {
      const rows = await db.curationFeature.findMany({ where: { section: opts.section }, select: { postId: true } });
      inSection = new Set((rows as any[]).map((r) => r.postId));
    } catch { /* ignore */ }
  }
  return cards.map((c) => ({ ...c, inSection: inSection.has(c.id) }));
}

export function curationModelReady() {
  return !!db.curationFeature;
}
