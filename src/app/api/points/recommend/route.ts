export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
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

// ===== 시즌 가이드 (조황 데이터가 없어도 쓸모 있는 정보를 주기 위한 상수 테이블) =====

/**
 * 어종별 계절 공략 팁.
 * 회원 조황 데이터가 적을 때 "명소 위주로 골랐어요" 같은 빈 문장 대신
 * 실제로 도움이 되는 시즌 정보를 내려주기 위한 낚시 일반론 기준 가이드다.
 * (지역·연도에 따라 편차가 있어 단정 대신 경향으로 서술한다)
 */
const SEASON_TIPS: Record<string, { months: number[]; tip: string }[]> = {
  배스: [
    { months: [3, 4, 5], tip: "봄 산란 시즌이라 수심 1~2m 얕은 수초대와 물이 먼저 데워지는 북쪽 연안, 침수 구조물 주변이 핵심이에요." },
    { months: [6, 7, 8], tip: "수온이 높아 한낮에는 입질이 뚝 떨어지니 해 뜨기 전후와 해질녘 피딩 타임에 집중하고, 그늘·유입구·산소가 도는 곳을 노려보세요." },
    { months: [9, 10, 11], tip: "가을 대활성기라 베이트를 쫓아 중층까지 올라와요. 딥 브레이크라인과 볼 계열 빠른 서치 운영이 잘 먹히는 시기예요." },
    { months: [12, 1, 2], tip: "수온이 낮아 배스가 깊은 곳에 정체돼 있어요. 딥 포인트에서 메탈·다운샷을 아주 느리게 끌어주는 운영이 유효해요." },
  ],
  붕어: [
    { months: [3, 4, 5], tip: "산란기 대물이 연안으로 붙는 시기예요. 수초 언저리와 완만한 경사대를 노리고 새벽·초저녁 입질에 집중하세요." },
    { months: [6, 7, 8], tip: "장마철 물이 불고 유입수가 들어올 때 활성이 크게 오르고, 무더운 낮보다 밤낚시가 압도적으로 유리해요." },
    { months: [9, 10, 11], tip: "월동을 앞둔 먹이 활동으로 씨알과 마릿수가 함께 좋아지는 시기라 하루 종일 입질을 기대할 수 있어요." },
    { months: [12, 1, 2], tip: "저수온기라 활성이 낮아요. 깊은 수심의 새우·글루텐 조합에 예민한 채비, 긴 기다림이 필요합니다." },
  ],
  쏘가리: [
    { months: [3, 4, 5], tip: "5월 금어기 전후를 반드시 확인하고, 여울 하류의 큰 바위 지대를 훑어보세요." },
    { months: [6, 7, 8], tip: "여울 활성기예요. 물살이 꺾이는 반전류와 큰 돌 뒤 정체 구간에 붙어 있고 야간 활성이 특히 좋아요." },
    { months: [9, 10, 11], tip: "가을 대형 개체가 붙는 시기라 여울 하단 깊은 소(沼)와 합수부를 공략해보세요." },
    { months: [12, 1, 2], tip: "깊은 소에 모여 월동해요. 무겁게 바닥을 더듬는 느린 운영이 아니면 입질을 보기 어렵습니다." },
  ],
  송어: [
    { months: [11, 12, 1, 2, 3], tip: "저수온기가 곧 시즌이에요. 수면 아래 1~2m 층을 스푼으로 탐색하고, 물색이 맑을수록 라인을 가늘게 쓰는 게 유리해요." },
    { months: [4, 5, 6, 7, 8, 9, 10], tip: "수온이 오르면 활성이 급격히 떨어지는 냉수성 어종이라, 계곡·저수지 깊은 찬물 구간이 아니면 기대치를 낮추는 게 좋아요." },
  ],
  감성돔: [
    { months: [3, 4, 5], tip: "산란 후 회복기라 씨알보다 마릿수 위주예요. 밑밥을 아끼지 말고 조류가 스치는 갯바위 홈통을 노려보세요." },
    { months: [6, 7, 8], tip: "잡어 성화가 심한 시기라 밑밥 분리와 무거운 채비로 바닥층을 빠르게 공략하는 게 관건이에요." },
    { months: [9, 10, 11], tip: "본격 시즌 시작이에요. 수온이 내려가며 연안으로 붙고, 만조 전후 조류가 살아나는 타이밍이 가장 좋아요." },
    { months: [12, 1, 2], tip: "한겨울 대물 시즌이에요. 수심 깊은 직벽·여밭에서 채비를 깊게 내리고 아주 느린 흘림으로 승부하세요." },
  ],
  참돔: [
    { months: [3, 4, 5], tip: "산란기 대형 개체가 연안 가까이 붙는 시기라 조류가 강한 수중여 주변이 유망해요." },
    { months: [6, 7, 8], tip: "수온이 높아 새벽·야간 활성이 좋고, 타이라바는 조류가 흐르는 시간대에 집중하는 게 효율적이에요." },
    { months: [9, 10, 11], tip: "가을 먹이 활동이 왕성해 마릿수 조황을 기대할 수 있는 최성기예요." },
    { months: [12, 1, 2], tip: "깊은 수심대로 빠지는 시기라 무거운 헤드로 바닥층을 천천히 공략해야 해요." },
  ],
  농어: [
    { months: [3, 4, 5], tip: "봄 베이트를 따라 연안으로 붙는 시기예요. 물때가 바뀌는 조류 변화 타이밍이 골든타임이에요." },
    { months: [6, 7, 8], tip: "여름 야간 시즌이에요. 조명 경계면과 방파제 안쪽 흐름을 노리면 확률이 올라갑니다." },
    { months: [9, 10, 11], tip: "가을 대형급이 붙는 최성기라 파도가 적당히 있는 날 서프 지역이 특히 좋아요." },
    { months: [12, 1, 2], tip: "깊은 곳으로 빠져 개체 수가 줄어요. 수심 있는 방파제 끝단과 하구 깊은 골을 노려보세요." },
  ],
  광어: [
    { months: [3, 4, 5], tip: "산란 전후라 얕은 모래·자갈 바닥에 붙어 있고, 바닥을 끄는 다운샷 운영이 잘 통해요." },
    { months: [6, 7, 8], tip: "활성이 좋아 마릿수가 붙는 시기예요. 조류가 흐를 때 바닥 근처 30cm 안쪽을 집중 공략하세요." },
    { months: [9, 10, 11], tip: "살이 오른 대형급 시즌이에요. 수심 20m 전후 여밭 경계에서 확률이 높아요." },
    { months: [12, 1, 2], tip: "깊은 수심으로 이동해 선상 위주 시즌이 됩니다. 무거운 봉돌로 바닥을 정확히 잡는 게 중요해요." },
  ],
  "우럭(조피볼락)": [
    { months: [3, 4, 5], tip: "연안 테트라·수중여에 붙는 시기라 가벼운 지그헤드로 구조물 틈을 노려보세요." },
    { months: [6, 7, 8], tip: "수온이 높아 낮에는 깊은 곳, 밤에는 얕은 구조물로 붙어요. 야간 활성이 훨씬 좋습니다." },
    { months: [9, 10, 11], tip: "먹이 활동이 왕성해 씨알과 마릿수가 함께 좋은 시기예요." },
    { months: [12, 1, 2], tip: "저수온기 대물 시즌이에요. 깊은 어초·침선에서 천천히 바닥을 두드리는 운영이 유효해요." },
  ],
  볼락: [
    { months: [11, 12, 1, 2, 3], tip: "겨울~초봄이 제철이에요. 해가 진 뒤 연안 테트라와 방파제 조명 경계에서 가벼운 채비로 노려보세요." },
    { months: [4, 5, 6, 7, 8, 9, 10], tip: "수온이 오르면 깊은 곳으로 빠져 확률이 낮아져요. 새벽·야간 위주로 짧게 승부하는 게 좋아요." },
  ],
  갈치: [
    { months: [7, 8, 9, 10, 11], tip: "여름~가을이 본시즌이에요. 야간 집어등 불빛 경계면에서 수심을 바꿔가며 층을 찾는 게 핵심이에요." },
    { months: [12, 1, 2, 3, 4, 5, 6], tip: "비시즌이라 연안 확률이 크게 떨어져요. 남해 원거리 선상이 아니면 다른 어종을 함께 고려하세요." },
  ],
  무늬오징어: [
    { months: [5, 6, 7], tip: "산란기 대형 개체가 얕은 해조밭으로 붙는 시기예요. 에깅은 잘피밭 가장자리를 천천히 공략하세요." },
    { months: [8, 9, 10, 11], tip: "가을 신자(新子) 시즌으로 마릿수가 가장 좋아요. 작은 에기로 빠른 탐색이 효율적이에요." },
    { months: [12, 1, 2, 3, 4], tip: "수온이 내려가 개체가 깊은 곳으로 빠져요. 수온이 유지되는 남해·제주권이 아니면 확률이 낮습니다." },
  ],
  주꾸미: [
    { months: [8, 9, 10, 11], tip: "가을이 제철이에요. 서해 모래·펄 바닥에서 애기를 바닥에 붙여 통통 튀기듯 운영해보세요." },
    { months: [12, 1, 2, 3, 4, 5, 6, 7], tip: "산란·성장기라 금어기(5~8월)를 확인해야 하고, 연안 확률도 크게 떨어지는 시기예요." },
  ],
  문어: [
    { months: [3, 4, 5, 6], tip: "봄 대형급 시즌이에요. 연안 갯바위·여밭 바닥을 문어 에기로 천천히 끌어보세요." },
    { months: [7, 8, 9, 10, 11, 12, 1, 2], tip: "수온에 따라 수심대가 크게 바뀌어요. 바닥 감촉이 바뀌는 지점을 찾는 게 조과를 가릅니다." },
  ],
  벵에돔: [
    { months: [6, 7, 8, 9, 10], tip: "고수온기가 본시즌이에요. 밑밥과 미끼를 같이 흘리는 동조가 승부처고, 파도가 부딪히는 포말 지대를 노려보세요." },
    { months: [11, 12, 1, 2, 3, 4, 5], tip: "수온이 내려가면 깊은 곳으로 빠져 확률이 낮아요. 남해 원도권이 아니면 다른 어종이 유리합니다." },
  ],
};

/** 어종을 고르지 않았을 때 쓰는 월별 일반 가이드 */
const GENERAL_SEASON_TIPS: Record<number, string> = {
  1: "한겨울 저수온기예요. 깊은 수심대에서 느린 운영이 기본이고, 낮 시간대 수온이 조금이라도 오르는 타이밍이 승부처예요.",
  2: "늦겨울에서 초봄으로 넘어가는 전환기라 물이 먼저 데워지는 얕은 만입부와 양지쪽 연안부터 살아나요.",
  3: "봄 활성기가 시작돼요. 산란을 준비하는 어종들이 얕은 곳으로 붙으면서 입질이 눈에 띄게 좋아지는 시기예요.",
  4: "본격 산란 시즌이에요. 수초·구조물 주변 얕은 수심에 대형 개체가 붙고, 하루 중에는 오후 수온이 오를 때가 좋아요.",
  5: "산란 후 회복기라 먹이 활동이 활발해요. 다만 금어기 어종이 많은 달이라 대상어의 금어기 여부를 꼭 확인하세요.",
  6: "수온이 빠르게 오르며 활성이 정점에 가까워져요. 낮보다 이른 아침과 해질녘 피딩 타임이 훨씬 유리해요.",
  7: "장마와 고수온이 겹치는 시기예요. 비 온 뒤 물이 유입되는 지점과 그늘·산소가 도는 자리가 핵심이에요.",
  8: "한여름 고수온기라 낮 활성이 크게 떨어져요. 야간·새벽 위주로 짧고 굵게 노리는 편이 효율적이에요.",
  9: "가을 시즌 개막이에요. 수온이 내려가며 베이트를 쫓는 활성이 살아나 하루 종일 기회가 생겨요.",
  10: "연중 가장 안정적인 조황을 기대할 수 있는 달이에요. 씨알과 마릿수가 함께 좋아 넓게 탐색해볼 만해요.",
  11: "월동 전 먹이 활동이 왕성한 시기예요. 대형 개체 확률이 높아 조금 무겁고 큰 채비도 잘 통해요.",
  12: "초겨울 저수온기로 접어들어요. 어군이 깊은 곳에 뭉치니 포인트를 넓게 옮기기보다 한 자리를 깊게 파는 게 유리해요.",
};

// ===== 사용자 출조 이력 프로파일 =====

/**
 * 사용자의 최근 출조 글(좌표 있는 글)을 분석해 선호 어종·수역 타입을 반환한다.
 * take:50 으로 최근 이력만 보고 부담을 최소화한다.
 */
async function getUserFishingProfile(userId: string) {
  const userPosts = await prisma.post.findMany({
    where: { authorId: userId, lat: { not: null }, lng: { not: null }, hidden: false },
    select: { lat: true, lng: true, speciesName: true, fishingType: true, location: true, region: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 어종 빈도 집계
  const speciesCount: Record<string, number> = {};
  for (const p of userPosts) {
    if (p.speciesName) speciesCount[p.speciesName] = (speciesCount[p.speciesName] || 0) + 1;
  }
  const preferredSpecies = Object.entries(speciesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  // 수역 선호(민물/바다) 집계
  const waterCount: Record<string, number> = {};
  for (const p of userPosts) {
    if (p.fishingType) waterCount[p.fishingType] = (waterCount[p.fishingType] || 0) + 1;
  }

  return { userPosts, preferredSpecies, waterCount, speciesCount };
}

/**
 * 위도·경도를 시군구 목록(pool)과 비교해 가장 가까운 시군구를 반환한다.
 * 50km 초과면 null — 바다 한가운데 등 엉뚱한 매핑을 방지한다.
 * pool 은 반복 호출 비용 절감을 위해 호출부에서 한 번만 생성해 넘긴다.
 */
function findNearestSigungu(lat: number, lng: number, pool: PoolItem[]): PoolItem | null {
  let best: PoolItem | null = null;
  let bestDist = Infinity;
  const MAX_DIST = 50_000; // 50 km
  for (const sg of pool) {
    const d = distanceMeters({ lat, lng }, { lat: sg.lat, lng: sg.lng });
    if (d < bestDist) { bestDist = d; best = sg; }
  }
  return bestDist <= MAX_DIST ? best : null;
}

/** KST 기준 현재 월 (서버 타임존이 UTC 여도 한국 계절과 어긋나지 않게 한다) */
function kstMonth() {
  return new Date(Date.now() + 9 * 3600_000).getUTCMonth() + 1;
}

/** 어종 + 월 → 시즌 팁. 어종 팁이 없으면 월별 일반 가이드로 폴백한다. */
function getSeasonTip(species: string | null, month: number): string | null {
  const m = month >= 1 && month <= 12 ? month : kstMonth();
  if (species) {
    const table = SEASON_TIPS[species];
    const hit = table?.find((t) => t.months.includes(m));
    if (hit) return `${species}는 ${m}월 기준 ${hit.tip}`;
  }
  return GENERAL_SEASON_TIPS[m] ?? null;
}

type BasisPoint = {
  name: string;
  typeLabel: string;
  sido: string;
  sigungu: string;
  postCount: number;
};

/**
 * OpenAI 문장을 못 받았을 때 쓰는 근거 문단.
 * "데이터 상황 → 시즌 가이드 → 해양/기상 요약" 순으로 이어 붙여
 * 조황 데이터가 0건이어도 읽을거리가 남도록 한다.
 */
function buildEnrichedBasis(args: {
  regionLabel: string;
  species: string | null;
  month: number | null;
  points: BasisPoint[];
  marine: MarineSnapshot | null;
  totalMatched: number;
  broadened: boolean;
}): string {
  const { regionLabel, species, month, points, marine, totalMatched, broadened } = args;
  const parts: string[] = [];

  // 1) 데이터 상황
  if (points.length === 0) {
    parts.push(
      species
        ? `${regionLabel}에서 ${species} 조황글이 있는 포인트를 찾지 못했어요. 지역을 넓히거나 다른 어종으로 찾아보세요.`
        : `${regionLabel}에서 추천할 포인트를 찾지 못했어요. 지역을 넓혀서 다시 시도해보세요.`,
    );
  } else if (totalMatched > 0) {
    const scope = broadened ? `${regionLabel} 주변까지 넓혀` : `${regionLabel}에서`;
    const target = species ? `${species} 조황글 ` : "회원 조황글 ";
    parts.push(`${scope} ${target}${totalMatched}건을 분석해 ${points.length}곳을 골랐어요.`);
  } else {
    parts.push(
      `회원 조황 데이터가 아직 쌓이는 중이에요. ${regionLabel} 주변의 검증된 낚시 명소를 지형과 수계 특성을 기준으로 선별했어요.`,
    );
  }

  // 2) 포인트 성격 요약 (어떤 유형의 자리인지 알려주면 준비물이 달라진다)
  const typeCount = new Map<string, number>();
  for (const p of points.slice(0, 6)) typeCount.set(p.typeLabel, (typeCount.get(p.typeLabel) || 0) + 1);
  const typeLabels = [...typeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
  if (typeLabels.length && points.length > 0) {
    parts.push(`추천 자리는 ${typeLabels.join("·")} 위주예요.`);
  }

  // 3) 시즌 가이드
  const tip = getSeasonTip(species, month ?? kstMonth());
  if (tip) parts.push(tip);

  // 4) 해양·기상 요약 (있는 값만)
  const marineParts: string[] = [];
  if (marine?.tide?.phase) {
    marineParts.push(`지금은 ${marine.tide.phase}${marine.tide.mulddae ? `(${marine.tide.mulddae})` : ""}`);
  }
  if (marine?.tide?.next) {
    marineParts.push(`다음 ${marine.tide.next.kind === "high" ? "만조" : "간조"}는 ${marine.tide.next.label}`);
  }
  if (marine?.waterTemp) marineParts.push(`${marine.waterTemp.stationName} 수온 ${marine.waterTemp.tempC}℃`);
  if (marine?.wind?.speedMs != null) {
    marineParts.push(`바람은 ${marine.wind.label ? `${marine.wind.label}풍 ` : ""}${marine.wind.speedMs}m/s`);
  }
  if (marineParts.length) parts.push(`${marineParts.join(", ")}예요.`);

  return parts.join(" ");
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

/**
 * 추천 사유 다양화를 위한 랜덤 앵글 목록.
 * 매 호출마다 하나가 선택되어 OpenAI 가 그 관점을 중심 주제로 삼도록 지시한다.
 * marine 데이터 유무와 무관하게 항상 적용되며, 앵글에 맞는 구체적 조언을 유도한다.
 */
const RECOMMEND_ANGLES = [
  {
    key: "tide",
    instruction:
      "이번 추천의 핵심 주제는 【조류·물때】다. marine.tide 값을 이용해 현재 물때가 대상 어종의 활성·이동에 어떤 영향을 주는지를 첫 문장에서 구체적으로 설명하고, 그 흐름이 이번 추천 포인트와 어떻게 연결되는지 서술하라. marine이 null이면 시즌(seasonTip)의 전형적인 조류 패턴으로 대체한다.",
  },
  {
    key: "depth",
    instruction:
      "이번 추천의 핵심 주제는 【수심·층 공략】이다. 현재 수온(marine.waterTemp)과 계절(seasonTip)을 근거로, 대상 어종이 머무를 가능성이 높은 수심대와 층을 구체적으로 제시하고, 그에 맞는 채비 운영 방법을 설명하라. 수온이 없으면 seasonTip의 계절 수온 경향으로 대체한다.",
  },
  {
    key: "timing",
    instruction:
      "이번 추천의 핵심 주제는 【입질 타이밍】이다. 물때(marine.tide)·수온·계절(seasonTip)을 조합해 하루 중 가장 활성이 오르는 시간대(새벽·아침·낮·저녁·야간)를 특정하고, 그 이유와 함께 추천 포인트에서 그 시간대에 어떻게 공략할지를 구체적으로 조언하라.",
  },
  {
    key: "technique",
    instruction:
      "이번 추천의 핵심 주제는 【채비·기법】이다. 추천 포인트의 자리 유형(방파제·갯바위·저수지·강 등)과 현재 수온·바람(marine)을 고려해, 이 포인트에서 효과가 높은 채비나 루어 운영 기법을 첫 문장부터 구체적으로 제안하라. marine이 null이면 seasonTip 기반 일반 기법을 제시한다.",
  },
  {
    key: "structure",
    instruction:
      "이번 추천의 핵심 주제는 【지형·구조물 공략】이다. 추천 포인트의 지형적 특징(여밭·수중구조물·수초·합수부·테트라 등)과 조류 방향(marine.wind·marine.tide)을 연결해, 물고기가 붙을 가능성이 높은 자리를 좁혀서 설명하라. marine이 없으면 포인트 유형(typeLabel)의 전형적인 지형 공략으로 대체한다.",
  },
  {
    key: "wind_wave",
    instruction:
      "이번 추천의 핵심 주제는 【바람·파도 대응】이다. marine.wind(풍향·풍속)와 marine.wave(파고)를 이용해 현재 바람이 이번 포인트에서 낚시에 유리한지 불리한지를 판단하고, 그에 맞는 자리 선택과 캐스팅 방향 조언을 구체적으로 제시하라. marine이 null이면 이 앵글 대신 seasonTip 심화 서술로 대체한다.",
  },
] as const;

async function makeOpenAiBasis(
  openaiKey: string,
  points: { name: string; score: number; postCount: number; reason: string; species?: { name: string; count: number }[] }[],
  reports: WebFishReport[],
  species: string | null,
  marine: MarineSnapshot | null,
  when: { month: number | null; day: number | null },
  userProfile?: { preferredSpecies: string[]; preferredRegions: string[]; waterType: string | null } | null,
) {
  if (!openaiKey) return "";
  try {
    // targetSpecies 를 함께 넘긴다 — 어종을 고르면 그 어종이 잡힌 포인트만 남긴 목록이라,
    // 이를 모르면 AI 문장이 "어종만 추린 결과"라는 사실과 어긋나게 쓰인다.
    // marine(물때·수온·바람·기압)은 값이 없으면 null 로 명시해 보낸다 — 없는 값을 지어내지 못하게 한다.
    // seasonTip 은 우리가 관리하는 상수 테이블에서 나온 검증된 문장이라,
    // 조황 데이터가 0건이어도 AI 가 지어내지 않고 기댈 수 있는 근거가 된다.
    const targetMonth = when.month ?? kstMonth();

    // 랜덤 앵글 선택 — 매 호출마다 다른 관점으로 서술하도록 유도한다.
    // marine이 없으면 바람·파도 앵글(wind_wave)을 제외한 나머지 중에서 고른다.
    const eligibleAngles = marine
      ? RECOMMEND_ANGLES
      : RECOMMEND_ANGLES.filter((a) => a.key !== "wind_wave");
    const angle = eligibleAngles[Math.floor(Math.random() * eligibleAngles.length)];

    const marinePromptData = marineForPrompt(marine);

    const context = JSON.stringify({
      targetSpecies: species,
      targetDate: when.month ? `${when.month}월 ${when.day ?? ""}일`.trim() : null,
      targetMonth,
      seasonTip: getSeasonTip(species, targetMonth),
      points: points.slice(0, 3).map((p) => ({
        name: p.name, score: p.score, postCount: p.postCount, reason: p.reason,
        topSpecies: (p.species ?? []).slice(0, 3),
      })),
      marine: marinePromptData,
      recentBlogReports: reports.slice(0, 3).map((r) => ({ title: r.title, description: r.description, date: r.date })),
      userProfile: userProfile ?? null,
    });
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_RECOMMEND_MODEL || "gpt-4.1-mini",
        input: [
          "You are an expert Korean fishing guide with 20 years of on-water experience.",
          "Using ONLY the JSON data below, write a professional fishing recommendation in 3~4 Korean sentences.",
          "Rules:",
          "1) NEVER invent data. Any field that is null is UNKNOWN — never mention it, never guess a value.",
          // 1번: 랜덤 앵글 — 매 호출마다 다른 관점을 핵심 주제로 삼도록 강제한다.
          `2) FOCUS ANGLE — ${angle.instruction}`,
          // 2번: marine 데이터 강제 연결 — 값이 있으면 반드시 어종 행동과 연결해 서술한다.
          "3) If marine data exists and the FOCUS ANGLE does not already cover it: you MUST explicitly connect at least one marine value (water temperature, tide phase, or wind) to the target species' behavior or the specific recommended spot — do NOT merely list the values, explain the cause-and-effect link.",
          "4) If marine data is missing: focus instead on the location's characteristics, the seasonal pattern (seasonTip), and the specific listed spots.",
          "5) If postCount is 0: say the spot is well known among local anglers by its geographical/structural characteristics — do NOT claim member data that does not exist.",
          "6) seasonTip 은 검증된 시즌 정보다. 그 내용을 자연스럽게 녹여 쓰되 문장을 그대로 복사하지 말고 요약·재구성한다.",
          "7) targetSpecies 가 null 이 아니면, 나열된 포인트는 그 어종이 실제로 잡힌 곳만 추린 결과다. 그 사실을 밝히고 다른 어종용 조언은 하지 않는다.",
          "8) targetSpecies 가 null 이면 특정 어종을 단정하지 말고, 그 계절에 노려볼 만한 방향으로 서술한다.",
          "9) 존댓말. 낚시인이 읽는 전문적인 조사(釣師) 어조. 마크다운·불릿·이모지·머리말 금지. 평문 문단 하나로만 쓴다.",
          "10) userProfile 이 null 이 아닌 경우, 해당 사용자의 과거 출조 이력(선호 어종·자주 간 지역·수역 타입)을 자연스럽게 언급해 맞춤형 느낌을 주되, 문장이 길어지지 않도록 한 문장 이내로만 반영한다.",
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
  // 사용자 출조 이력 기반 맞춤 추천을 위해 user 객체를 보관한다.
  let currentUser: Awaited<ReturnType<typeof requireUser>> | null = null;
  try {
    currentUser = await requireUser();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // IP당 분당 3회 제한 — 네이버/OpenAI API 비용 절감
  const ip = getClientIp(req);
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
  // 전체 지역 맞춤 추천 시 사용자 프로파일 (OpenAI 프롬프트에도 전달)
  let userFishingProfile: { preferredSpecies: string[]; preferredRegions: string[]; waterType: string | null } | null = null;

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
    // 전체 지역 — 사용자 출조 이력이 충분하면 맞춤 추천, 없으면 커뮤니티 인기 지역으로 폴백
    let usedUserHistory = false;
    if (currentUser) {
      try {
        const profile = await getUserFishingProfile(currentUser.id);
        if (profile.userPosts.length >= 3) {
          const allPool = allSigungu();
          // 글별 위치 → 가장 가까운 시군구 매핑 후 빈도 집계
          const sigunguCount: Record<string, { item: PoolItem; count: number }> = {};
          for (const p of profile.userPosts) {
            if (p.lat == null || p.lng == null) continue;
            const sg = findNearestSigungu(p.lat, p.lng, allPool);
            if (!sg) continue;
            const key = `${sg.sidoName}_${sg.name}`;
            if (!sigunguCount[key]) sigunguCount[key] = { item: sg, count: 0 };
            sigunguCount[key].count++;
          }
          const topUserSigungu = Object.values(sigunguCount)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((v) => v.item);
          if (topUserSigungu.length > 0) {
            for (const e of topUserSigungu) {
              cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
            }
            // OpenAI 프롬프트에 전달할 사용자 컨텍스트 저장
            const topWater = Object.entries(profile.waterCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
            userFishingProfile = {
              preferredSpecies: profile.preferredSpecies,
              preferredRegions: topUserSigungu.slice(0, 3).map((sg) => `${sg.sidoName} ${sg.name}`),
              waterType: topWater,
            };
            usedUserHistory = true;
          }
        }
      } catch {
        // 사용자 이력 조회 실패 → 커뮤니티 기반 로직으로 폴백
      }
    }
    if (!usedUserHistory) {
      const top = topSigunguByPosts(allSigungu(), seedPosts, 6);
      for (const e of top) cands.push(...genSpots(e.sidoName, e).slice(0, 2).map(tag(e.sidoName, e.name)));
    }
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
    ? await makeOpenAiBasis(openai, points, webResults, species, marine, { month, day }, userFishingProfile)
    : "";

  /**
   * AI 문장을 못 받았을 때의 근거 문단.
   * 예전에는 "그럴듯한 명소 위주로 추천했어요" 한 줄로 끝나 정보가 없었는데,
   * 이제 데이터 상황 + 자리 유형 + 시즌 가이드 + 해양/기상 요약을 조합해 내려준다.
   * (해양 데이터가 필요하므로 marine 수집 이후에 만든다)
   */
  const basis = buildEnrichedBasis({
    regionLabel, species, month, points, marine, totalMatched, broadened,
  });

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
