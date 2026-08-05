export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { distanceMeters } from "@/lib/map";
import { getAiCredentials } from "@/lib/aiCredentials";
import { classifyOpenAiError } from "@/lib/openaiError";
import { getMarineSnapshot, marineForPrompt, type MarineSnapshot } from "@/lib/marineData";
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
  const { naverClientId: clientId, naverClientSecret: clientSecret } = await getAiCredentials();
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

/**
 * Responses API 응답에서 생성 텍스트를 꺼낸다.
 * `output_text` 는 공식 SDK 가 만들어 주는 편의 속성이고 raw HTTP JSON 에는 없다.
 * 실제 텍스트는 output[].content[] 중 type === "output_text" 인 항목의 text 에 들어있다.
 * (이전에는 data.output_text 만 봐서 호출은 성공·과금됐는데 결과를 항상 버리고 휴리스틱으로 폴백했다.)
 */
function readResponsesText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text; // SDK 호환 형태도 허용
  const parts: string[] = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const c of Array.isArray(item?.content) ? item.content : []) {
      if (c?.type === "output_text" && typeof c.text === "string") parts.push(c.text);
    }
  }
  return parts.join(" ");
}

async function makeOpenAiBasis(
  openaiKey: string,
  points: { name: string; score: number; postCount: number; reason: string; species?: { name: string; count: number }[] }[],
  reports: WebFishReport[],
  species: string | null,
  marine: MarineSnapshot | null,
  when: { month: number | null; day: number | null },
) {
  if (!openaiKey) return "";
  try {
    // targetSpecies 를 함께 넘긴다 — 어종을 고르면 그 어종이 잡힌 포인트만 남긴 목록이라,
    // 이를 모르면 AI 문장이 "어종만 추린 결과"라는 사실과 어긋나게 쓰인다.
    // marine(물때·수온·바람·기압)은 값이 없으면 null 로 명시해 보낸다 — 없는 값을 지어내지 못하게 한다.
    const context = JSON.stringify({
      targetSpecies: species,
      targetDate: when.month ? `${when.month}월 ${when.day ?? ""}일`.trim() : null,
      points: points.slice(0, 3).map((p) => ({
        name: p.name, score: p.score, postCount: p.postCount, reason: p.reason,
        topSpecies: (p.species ?? []).slice(0, 3),
      })),
      marine: marineForPrompt(marine),
      recentBlogReports: reports.slice(0, 3).map((r) => ({ title: r.title, description: r.description, date: r.date })),
    });
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_RECOMMEND_MODEL || "gpt-4.1-mini",
        input: [
          "You are a Korean fishing assistant. Using ONLY the JSON below, write a Korean recommendation in 2~3 short sentences.",
          "Rules:",
          "1) Never invent data. Any field that is null is UNKNOWN — do not mention it at all.",
          "2) If marine data exists (물때/수온/풍향/풍속/기압), explain concretely WHY today suits the top point: e.g. 물때 단계와 만조·간조 시간대, 수온에 따른 어종 활성, 바람 세기의 캐스팅/안전 영향, 기압 하강 시 입질 변화.",
          "3) postCount 는 이 앱 회원이 올린 조황글 수다. 0 이면 데이터가 적다고 솔직히 말한다.",
          "4) targetSpecies 가 null 이 아니면, 나열된 포인트는 그 어종이 실제로 잡힌 곳만 추린 결과다. 그 사실을 밝히고 다른 어종용으로 추천하지 않는다.",
          "5) 존댓말, 낚시인이 읽는 문장. 마크다운·불릿·이모지 금지.",
          `JSON: ${context}`,
        ].join("\n"),
      }),
      signal: AbortSignal.timeout(8000),
    });
    // AI 문장 생성은 실패해도 데이터 휴리스틱 basis 로 폴백한다.
    // 다만 왜 폴백했는지(크레딧 소진·키 오류 등)는 서버 로그에 남긴다.
    if (!res.ok) { await classifyOpenAiError(res, "points/recommend"); return ""; }
    const data = await res.json();
    // 물때·수온까지 언급하면 문장이 길어져 300자에서 잘렸다 — 3문장이 온전히 들어가도록 넓힌다.
    const text = readResponsesText(data).trim().slice(0, 600);
    if (!text) console.error("[ipnak] OpenAI 추천 사유 응답에서 텍스트를 찾지 못했습니다 (points/recommend)");
    return text;
  } catch (e: any) {
    console.error(`[ipnak] OpenAI 추천 사유 생성 실패 (points/recommend): ${e?.name || "error"}`);
    return "";
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
  // 외부 AI·검색 API 비용이 발생하므로 로그인한 회원만 호출할 수 있다.
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // IP당 분당 3회 제한 — 네이버/OpenAI API 비용 절감
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`recommend:${ip}`, 3, 60_000)) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const sidoName: string | null = body.sido && body.sido !== "전체" ? String(body.sido) : null;
  const sgName: string | null = body.sigungu && body.sigungu !== "전체" ? String(body.sigungu) : null;
  const month: number | null = body.month ? Number(body.month) : null;
  const day: number | null = body.day ? Number(body.day) : null;
  const species: string | null = body.species && body.species !== "전체" ? String(body.species).trim() : null;

  /**
   * 해양·기상 데이터를 붙일 기준 좌표.
   * 1순위 클라이언트가 보낸 실제 위치(lat/lon 또는 lng) → 2순위 선택한 시군구 중심 → 3순위 시도 중심.
   * 셋 다 없으면(전국 추천) 아래에서 1위 추천 포인트 좌표로 대체한다.
   */
  // ⚠️ Number(null) === 0 이라 null 을 먼저 걸러야 한다.
  //    (클라이언트는 위치 미사용 시 lat/lon 을 null 로 보내는데, 그대로 두면 좌표 (0,0) 으로 조회된다)
  const num = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bodyLat = num(body.lat);
  const bodyLng = num(body.lon ?? body.lng);
  const validCoords =
    bodyLat != null && bodyLng != null &&
    Math.abs(bodyLat) <= 90 && Math.abs(bodyLng) <= 180 &&
    !(bodyLat === 0 && bodyLng === 0);
  let originCoords: { lat: number; lng: number; origin: "user" | "region" | "point" } | null =
    validCoords ? { lat: bodyLat as number, lng: bodyLng as number, origin: "user" } : null;

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

  /**
   * 대상 어종을 고르면 후보 포인트 선정·지역 보강도 그 어종 조황글만 기준으로 한다.
   * 전체 조황글로 후보를 뽑으면 "글은 많은데 그 어종은 한 마리도 안 잡힌 지역"이
   * 후보를 다 차지하고, 뒤에서 어종 필터에 전부 걸려 결과가 비어버린다.
   * (포인트별 조황글 목록은 맥락 확인용이라 아래에서 posts 전체를 그대로 쓴다)
   */
  const seedPosts: AnyPost[] = species ? posts.filter((p) => p.speciesName === species) : posts;

  // ---- 후보 포인트 구성 ----
  let cands: Cand[] = [];
  let broadened = false;

  const sg = sidoName && sgName ? findSigungu(sidoName, sgName) : null;

  // 클라이언트 위치가 없으면 선택 지역 중심을 해양·기상 조회 기준점으로 쓴다.
  if (!originCoords) {
    const sidoRegion = sidoName ? findSido(sidoName) : null;
    if (sg) originCoords = { lat: sg.lat, lng: sg.lng, origin: "region" };
    else if (sidoRegion) originCoords = { lat: sidoRegion.lat, lng: sidoRegion.lng, origin: "region" };
  }

  if (sidoName && sg) {
    cands = genSpots(sidoName, sg).map(tag(sidoName, sg.name));
    const matched = cands.reduce((a, c) => a + nearbyPostCount(c.lat, c.lng, seedPosts), 0);
    if (matched < 3) {
      broadened = true;
      const pool = (findSido(sidoName)?.sigungu || []).map((x) => ({ ...x, sidoName }));
      const extra = topSigunguByPosts(pool, seedPosts, 4).filter((x) => x.name !== sg.name);
      for (const e of extra) cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
      if (cands.reduce((a, c) => a + nearbyPostCount(c.lat, c.lng, seedPosts), 0) < 3) {
        const ext2 = topSigunguByPosts(allSigungu(), seedPosts, 4);
        for (const e of ext2) cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
      }
    }
  } else if (sidoName) {
    const pool = (findSido(sidoName)?.sigungu || []).map((x) => ({ ...x, sidoName }));
    const top = topSigunguByPosts(pool, seedPosts, 5);
    for (const e of top) cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
  } else {
    const top = topSigunguByPosts(allSigungu(), seedPosts, 6);
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

    // 대상 어종을 고르면 카드에 보여줄 조황글도 그 어종 글만 남긴다.
    // (포인트만 걸러두고 목록에 다른 어종이 섞여 나오면 왜 추천됐는지 확인이 안 된다)
    // 어종 필터를 통과한 포인트는 해당 어종 글이 1건 이상이라 목록이 비지 않는다.
    const listed = species ? matched.filter((m) => m.p.speciesName === species) : matched;

    const memberPosts = listed.slice(0, 8).map((m) => ({
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

  /**
   * 대상 어종을 고르면 그 어종 조황글이 1건 이상인 포인트만 남긴다.
   * (기존에는 가중치 점수만 올려서, 그 어종이 한 번도 안 잡힌 곳도 상위에 섞여 나왔다)
   * 어종 '전체'면 필터 없이 그대로 노출한다.
   */
  const filtered = species
    ? result.filter((p) => p.species.some((s) => s.name === species && s.count > 0))
    : result;
  const points = filtered.slice(0, 6);

  const regionLabel = sidoName && sgName ? `${sidoName} ${sgName}` : sidoName || "전국";
  const totalMatched = points.reduce((a, p) => a + p.postCount, 0);
  let basis: string;
  if (species && points.length === 0) {
    // 어종 필터로 전부 걸러진 경우 — 사용자가 다음에 뭘 바꿔야 할지 알려준다
    basis = `${regionLabel}에서 ${species} 조황글이 있는 포인트를 찾지 못했어요. 지역을 넓히거나 다른 어종으로 찾아보세요.`;
  } else if (species) {
    basis = broadened
      ? `${regionLabel} 주변까지 넓혀 ${species} 조황글이 있는 포인트만 골랐어요.`
      : `${regionLabel}에서 ${species} 조황글이 있는 포인트만 골랐어요.`;
  } else if (sidoName && sgName && !broadened) {
    basis = `${sidoName} ${sgName} 인근 회원 조황글을 분석해 추천했어요.`;
  } else if (sidoName && sgName && broadened) {
    basis = `${sidoName} ${sgName}의 회원 조황 데이터가 적어 인근 지역까지 함께 분석했어요.`;
  } else if (sidoName) {
    basis = `${sidoName} 회원 조황글을 분석해 추천했어요.`;
  } else {
    basis = `전국 회원 조황글을 분석해 추천했어요.`;
  }
  // 어종을 고른 경우의 안내는 위에서 이미 정확하므로 덮어쓰지 않는다.
  if (!species && totalMatched === 0) basis = "아직 이 지역 회원 조황 데이터가 적어요. 그럴듯한 명소 위주로 추천했어요.";

  // 위치도 지역도 안 주어진 전국 추천이면 1위 포인트 좌표를 해양·기상 기준점으로 삼는다.
  if (!originCoords && points[0]) {
    originCoords = { lat: points[0].lat, lng: points[0].lng, origin: "point" };
  }
  // 기준점의 물성(민물/바다) — 수온 기준 어종 적합도를 그 물성에 맞게 추린다.
  const originWater = points[0]?.water ?? null;

  // 웹 조황 검색 + AI 키 조회 + 해양/기상 수집을 모두 병렬 실행한다.
  // marine 은 어떤 항목이 실패해도 null 필드만 남기고 스냅샷 자체는 반드시 돌아온다.
  const [webResults, { openai }, marine] = await Promise.all([
    fetchNaverBlogReports(sidoName, sgName, species, month, day),
    getAiCredentials(),
    originCoords
      ? getMarineSnapshot(originCoords.lat, originCoords.lng, originWater).catch(() => null)
      : Promise.resolve(null),
  ]);

  // 추천할 포인트가 없으면 AI 를 부르지 않는다 — 호출 비용만 나가고,
  // 근거 없는 문장이 위에서 만든 "못 찾았어요 + 다음 행동" 안내를 덮어쓴다.
  const aiBasis = points.length > 0
    ? await makeOpenAiBasis(openai, points, webResults, species, marine, { month, day })
    : "";

  return NextResponse.json({
    basis: aiBasis || basis,
    broadened,
    query: { sido: sidoName || "전체", sigungu: sgName || "전체", month, day, species: species || null },
    points,
    webResults,
    marine,
    marineOrigin: originCoords
      ? { lat: originCoords.lat, lng: originCoords.lng, origin: originCoords.origin }
      : null,
  });
}
