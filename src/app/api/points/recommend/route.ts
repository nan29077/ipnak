export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { distanceMeters } from "@/lib/map";
import {
  KOREA_REGIONS, findSido, findSigungu, genSpots,
  SPOT_TYPE_LABEL, SPOT_WATER, type NamedSpot, type Sigungu,
} from "@/lib/regions";

// ===== 네이버 블로그 검색 (조황 웹 결과) =====
export type WebFishReport = {
  title: string;
  link: string;
  description: string;
  blogger: string;
  date: string;
};

async function fetchNaverBlogReports(
  sido: string | null, sigungu: string | null,
  species: string | null, month: number | null, day: number | null,
): Promise<WebFishReport[]> {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];
  try {
    const parts = [sido || "", sigungu || "", species || "", "조황", month ? `${month}월` : "", day ? `${day}일` : ""].filter(Boolean);
    const query = encodeURIComponent(parts.join(" ").trim());
    const res = await fetch(`https://openapi.naver.com/v1/search/blog?query=${query}&display=6&sort=date`, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any): WebFishReport => ({
      title: item.title.replace(/<[^>]+>/g, ""),
      link: item.link,
      description: item.description.replace(/<[^>]+>/g, "").slice(0, 120),
      blogger: item.bloggername || "",
      date: item.postdate
        ? `${item.postdate.slice(0, 4)}.${item.postdate.slice(4, 6)}.${item.postdate.slice(6, 8)}`
        : "",
    }));
  } catch {
    return [];
  }
}

// ===== AI 포인트 추천 (시군 단위 · 날짜 기반) =====
// 회원 조황글(posts)을 명소형 포인트(저수지/강/방파제/갯바위/해변)에 근접 매칭하여
// 구체적 장소명으로 추천한다. 선택 시군의 데이터가 적으면 인근/전국으로 보강하고 안내한다.
// 외부 LLM 키(LLM_API_KEY)가 있으면 사유 문장을 보강할 수 있으나, 없으면 데이터 휴리스틱을 사용한다.

type AnyPost = any;
type Cand = NamedSpot & { sido: string; sigungu: string };
type PoolItem = Sigungu & { sidoName: string };

const R_MATCH = 30000; // 회원글 매칭 반경 (m)

function allSigungu(): PoolItem[] {
  const out: PoolItem[] = [];
  for (const sido of KOREA_REGIONS) for (const sg of sido.sigungu) out.push({ ...sg, sidoName: sido.name });
  return out;
}

function nearbyPostCount(lat: number, lng: number, posts: AnyPost[], radius = R_MATCH) {
  let n = 0;
  for (const p of posts) if (distanceMeters({ lat, lng }, { lat: p.lat, lng: p.lng }) <= radius) n++;
  return n;
}

function topSigunguByPosts(pool: PoolItem[], posts: AnyPost[], n: number): PoolItem[] {
  const scored = pool.map((sg) => ({ sg, c: nearbyPostCount(sg.lat, sg.lng, posts) }));
  scored.sort((a, b) => b.c - a.c);
  const withPosts = scored.filter((s) => s.c > 0).map((s) => s.sg);
  if (withPosts.length >= 1) return withPosts.slice(0, n);
  return pool.slice(0, n); // 데이터가 전혀 없으면 앞쪽 시군이라도 노출
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sidoName: string | null = body.sido && body.sido !== "전체" ? String(body.sido) : null;
  const sgName: string | null = body.sigungu && body.sigungu !== "전체" ? String(body.sigungu) : null;
  const month: number | null = body.month ? Number(body.month) : null;
  const day: number | null = body.day ? Number(body.day) : null;
  const species: string | null = body.species && body.species !== "전체" ? String(body.species).trim() : null;

  const posts: AnyPost[] = await prisma.post.findMany({
    where: { hidden: false, visibility: { not: "PRIVATE" }, lat: { not: null }, lng: { not: null } },
    include: {
      author: { select: { id: true, nickname: true, avatarUrl: true } },
      images: { orderBy: { order: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const tag = (sido: string, sigungu: string) => (s: NamedSpot): Cand => ({ ...s, sido, sigungu });

  // ---- 후보 포인트 구성 ----
  let cands: Cand[] = [];
  let broadened = false;

  const sg = sidoName && sgName ? findSigungu(sidoName, sgName) : null;
  if (sidoName && sg) {
    cands = genSpots(sidoName, sg).map(tag(sidoName, sg.name));
    const matched = cands.reduce((a, c) => a + nearbyPostCount(c.lat, c.lng, posts), 0);
    if (matched < 3) {
      broadened = true;
      const pool = (findSido(sidoName)?.sigungu || []).map((x) => ({ ...x, sidoName }));
      const extra = topSigunguByPosts(pool, posts, 4).filter((x) => x.name !== sg.name);
      for (const e of extra) cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
      if (cands.reduce((a, c) => a + nearbyPostCount(c.lat, c.lng, posts), 0) < 3) {
        const ext2 = topSigunguByPosts(allSigungu(), posts, 4);
        for (const e of ext2) cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
      }
    }
  } else if (sidoName) {
    const pool = (findSido(sidoName)?.sigungu || []).map((x) => ({ ...x, sidoName }));
    const top = topSigunguByPosts(pool, posts, 5);
    for (const e of top) cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
  } else {
    const top = topSigunguByPosts(allSigungu(), posts, 6);
    for (const e of top) cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
  }

  // 중복 제거
  const seen = new Set<string>();
  cands = cands.filter((c) => { const k = `${c.name}_${c.lat.toFixed(3)}`; if (seen.has(k)) return false; seen.add(k); return true; });

  const now = Date.now();

  const result = cands.map((c, idx) => {
    const matched = posts
      .map((p) => ({ p, d: distanceMeters({ lat: c.lat, lng: c.lng }, { lat: p.lat, lng: p.lng }) }))
      .filter((m) => m.d <= R_MATCH)
      .sort((a, b) => new Date(b.p.createdAt).getTime() - new Date(a.p.createdAt).getTime());

    const sp = new Map<string, number>();
    for (const m of matched) if (m.p.speciesName) sp.set(m.p.speciesName, (sp.get(m.p.speciesName) || 0) + 1);
    const speciesList = [...sp.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

    const lastActivity = matched.length ? new Date(matched[0].p.createdAt).getTime() : 0;
    const daysSince = lastActivity ? (now - lastActivity) / 86400000 : 999;

    const volumeScore = matched.length * 14;
    const recencyScore = lastActivity ? Math.max(0, 30 - daysSince * 2) : 0;
    const speciesMatch = species ? (sp.get(species) || 0) : 0;
    const speciesScore = speciesMatch * 22;
    const monthMatch = month ? matched.filter((m) => new Date(m.p.createdAt).getMonth() + 1 === month).length : 0;
    const monthScore = monthMatch * 6;
    const curatedBonus = idx; // genSpots에서 override(유명지)가 앞에 오므로 약한 우선치
    const score = Math.round(volumeScore + recencyScore + speciesScore + monthScore - curatedBonus * 0.5);

    const reasons: string[] = [];
    if (matched.length) reasons.push(`회원 조황글 ${matched.length}건`);
    else reasons.push("회원 조황 데이터 적음");
    if (speciesList[0]) reasons.push(`${speciesList[0].name} 조황`);
    if (lastActivity && daysSince < 3) reasons.push("최근 조황 확인");
    else if (lastActivity && daysSince < 21) reasons.push(`${Math.round(daysSince)}일 내 조황`);
    if (species && speciesMatch > 0) reasons.push(`${species} ${speciesMatch}건`);

    const memberPosts = matched.slice(0, 8).map((m) => ({
      id: m.p.id,
      imageUrl: m.p.images?.[0]?.url || null,
      caption: m.p.caption,
      speciesName: m.p.speciesName,
      sizeCm: m.p.sizeCm,
      fishingType: m.p.fishingType,
      postType: m.p.postType,
      createdAt: new Date(m.p.createdAt).toISOString(),
      author: m.p.author,
    }));

    return {
      id: `${c.name}_${idx}`,
      name: c.name,
      type: c.type,
      typeLabel: SPOT_TYPE_LABEL[c.type],
      water: SPOT_WATER[c.type],
      sido: c.sido,
      sigungu: c.sigungu,
      lat: c.lat,
      lng: c.lng,
      postCount: matched.length,
      species: speciesList,
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
      score,
      reason: reasons.join(" · "),
      posts: memberPosts,
    };
  });

  result.sort((a, b) => b.score - a.score);
  const points = result.slice(0, 6);

  const totalMatched = points.reduce((a, p) => a + p.postCount, 0);
  let basis: string;
  if (sidoName && sgName && !broadened) {
    basis = `${sidoName} ${sgName} 인근 회원 조황글을 분석해 추천했어요.`;
  } else if (sidoName && sgName && broadened) {
    basis = `${sidoName} ${sgName}의 회원 조황 데이터가 적어 인근 지역까지 함께 분석했어요.`;
  } else if (sidoName) {
    basis = `${sidoName} 회원 조황글을 분석해 추천했어요.`;
  } else {
    basis = `전국 회원 조황글을 분석해 추천했어요.`;
  }
  if (totalMatched === 0) basis = "아직 이 지역 회원 조황 데이터가 적어요. 그럴듯한 명소 위주로 추천했어요.";

  // 웹 조황 검색 (네이버 블로그) — 비동기 병렬
  const webResults = await fetchNaverBlogReports(sidoName, sgName, species, month, day);

  return NextResponse.json({
    basis,
    broadened,
    query: { sido: sidoName || "전체", sigungu: sgName || "전체", month, day, species: species || null },
    points,
    webResults,
  });
}
