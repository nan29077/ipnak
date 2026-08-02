// 입낚 낚시 분류 체계 / 어종 / 피싱태그 데이터 (seed + UI 공용)

export const MAIN_CATEGORIES = ["민물낚시", "바다낚시"] as const;

export const FRESH_ENVIRONMENTS = [
  "강", "하천", "계류", "저수지", "댐", "호수", "수로", "늪/소류지", "유료낚시터", "얼음낚시터",
];

export const SEA_ENVIRONMENTS = [
  "방파제", "갯바위", "선상", "좌대", "해상펜션", "항구/내항", "해변/서프", "테트라포드", "원도권", "내만", "외해",
];

export const FISHING_METHODS = [
  "루어낚시", "찌낚시", "원투낚시", "민장대낚시", "플라이낚시", "바닥낚시", "장어낚시", "선상낚시",
  "워킹낚시", "좌대낚시", "카약낚시", "보팅낚시", "지깅", "타이라바", "텐야", "에깅", "다운샷",
  "프리리그", "카이젤", "노싱커", "Texas Rig", "Carolina Rig", "미노우", "크랭크베이트",
  "스피너베이트", "빙어낚시", "플로팅/탑워터",
];

export const ACCESS_STYLES = [
  "워킹", "선상", "좌대", "보트", "카약", "갯바위", "방파제", "유료터", "해상펜션", "동출/가이드",
];

export const FRESH_SPECIES = [
  "붕어", "잉어", "배스", "쏘가리", "메기", "가물치", "빙어", "향어", "블루길", "피라미",
  "강준치", "끄리", "뱀장어", "무지개송어", "산천어", "연어", "황어", "동자개", "참마자",
  "꺽지", "살치", "누치", "모래무지", "참붕어", "송어", "은어",
];

export const SEA_SPECIES = [
  "농어", "광어", "우럭(조피볼락)", "감성돔", "참돔", "돌돔", "벵에돔", "방어", "부시리",
  "갈치", "볼락", "고등어", "삼치", "학꽁치", "전갱이", "가자미", "도다리", "참가자미",
  "쥐노래미", "양태", "망상어", "숭어", "청어", "꽁치", "대구", "주꾸미", "오징어", "문어",
  "낙지", "새우", "꽃게", "대게", "참치", "열기", "노래미", "망둥어", "무늬오징어",
  "갑오징어", "민어",
];

export const ALL_SPECIES = [...FRESH_SPECIES, ...SEA_SPECIES];

// 피싱태그 카테고리
export const PRODUCT_CATEGORIES: { key: string; label: string }[] = [
  { key: "ROD", label: "낚싯대" },
  { key: "REEL", label: "릴" },
  { key: "LINE", label: "라인" },
  { key: "LEADER", label: "쇼크리더" },
  { key: "LURE", label: "루어" },
  { key: "WORM", label: "웜" },
  { key: "HOOK", label: "바늘" },
  { key: "SINKER", label: "봉돌" },
  { key: "FLOAT", label: "찌" },
  { key: "BAIT", label: "미끼" },
  { key: "TACKLEBOX", label: "태클박스" },
  { key: "COOLER", label: "쿨러" },
  { key: "RULER", label: "계측자" },
  { key: "NET", label: "뜰채" },
  { key: "APPAREL", label: "의류" },
  { key: "LIFEVEST", label: "구명조끼" },
  { key: "ETC", label: "기타" },
];

export const productCategoryLabel = (key: string) =>
  PRODUCT_CATEGORIES.find((p) => p.key === key)?.label ?? key;

// 조행기(카페형 게시판) 카테고리
export const LOG_CATEGORIES: { key: string; label: string }[] = [
  { key: "WALKING",    label: "워킹조행기" },
  { key: "BOATING",    label: "보팅조행기" },
  { key: "JWADAE",     label: "좌대조행기" },
  { key: "SEA",        label: "바다조행기" },
  { key: "FRESHWATER", label: "민물조행기" },
];

export const logCategoryLabel = (key: string | null | undefined) =>
  LOG_CATEGORIES.find((c) => c.key === key)?.label ?? "조행기";

// 예약 카테고리
export const RESERVATION_CATEGORIES: { key: string; label: string }[] = [
  { key: "BOAT", label: "낚시배" },
  { key: "PENSION", label: "낚시펜션" },
  { key: "PAID_POND", label: "유료낚시터" },
  { key: "SEAT", label: "좌대" },
  { key: "SEA_PENSION", label: "해상펜션" },
  { key: "GUIDE", label: "낚시 가이드" },
];

export const reservationCategoryLabel = (key: string) =>
  RESERVATION_CATEGORIES.find((p) => p.key === key)?.label ?? key;

// 위치 공개 옵션
export const VISIBILITY_OPTIONS: { key: string; label: string }[] = [
  { key: "PUBLIC", label: "전체공개" },
  { key: "FOLLOWERS", label: "팔로워공개" },
  { key: "PRIVATE", label: "비공개" },
  { key: "BLURRED", label: "위치 흐림 공개" },
];

export const POINT_VISIBILITY: { key: string; label: string }[] = [
  { key: "EXACT", label: "정확히 공개" },
  { key: "BLUR_100", label: "반경 100m 흐림" },
  { key: "BLUR_500", label: "반경 500m 흐림" },
  { key: "PRIVATE", label: "비공개" },
];

// 대회 타입
export const TOURNAMENT_TYPES: { key: string; label: string }[] = [
  { key: "WEEKLY", label: "주간전" },
  { key: "MONTHLY", label: "월간전" },
  { key: "GRAND", label: "왕중왕전" },
];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "최고관리자",
  ANGLER: "낚시꾼",
  PARTNER: "파트너",
};

/** 배스낚시 전용 모드일 때 "낚시꾼" → "앵글러" */
export function getAnglerLabel(bassOnly: boolean): string {
  return bassOnly ? "앵글러" : "낚시꾼";
}

/** 배스낚시 전용 모드에서만 노출할 어종 (민물 배스 계열) */
export const BASS_ONLY_SPECIES = [
  "배스", "블루길", "쏘가리", "꺽지", "강준치", "가물치", "붕어", "잉어",
];

/**
 * 배스낚시 전용 모드 노출 대상 어종인지 판정.
 * - "배스" / "bass" 를 포함한 표기(라지마우스 배스, Largemouth Bass 등)
 * - BASS_ONLY_SPECIES 8종 (글쓰기 드롭다운에서 선택 가능한 어종과 동일 기준)
 */
export function isBassOnlySpecies(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  if (!n) return false;
  if (n.includes("배스") || n.toLowerCase().includes("bass")) return true;
  return BASS_ONLY_SPECIES.includes(n);
}

/** 자유 텍스트(캡션·제목·해시태그)에 배스 관련 키워드가 있는지 */
export function isBassOnlyText(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return t.includes("배스") || t.toLowerCase().includes("bass");
}

/** 게시글(피드/조행기)이 배스 전용 모드에서 노출 대상인지 — 어종 태그 또는 해시태그 기준 */
export function isBassOnlyPost(post: {
  speciesName?: string | null;
  hashtags?: string[] | null;
}): boolean {
  if (isBassOnlySpecies(post.speciesName)) return true;
  return (post.hashtags ?? []).some((tag) => isBassOnlySpecies(tag) || isBassOnlyText(tag));
}

// 글쓰기 폼 "지역" 선택 목록 — 도(광역단체) 단위만, 2차 분류(시·군·구) 없음
export const KOREA_PROVINCES: string[] = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시",
  "울산광역시", "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도",
  "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
];

// 한국 주요 낚시 지역 (위경도)
export const KOREA_SPOTS: { name: string; lat: number; lng: number }[] = [
  { name: "한강", lat: 37.5326, lng: 126.9905 },
  { name: "팔당", lat: 37.5503, lng: 127.2475 },
  { name: "대청호", lat: 36.4806, lng: 127.4889 },
  { name: "낙동강", lat: 35.1796, lng: 128.9784 },
  { name: "안동호", lat: 36.5684, lng: 128.7294 },
  { name: "여수", lat: 34.7604, lng: 127.6622 },
  { name: "통영", lat: 34.8544, lng: 128.4331 },
  { name: "제주", lat: 33.4996, lng: 126.5312 },
  { name: "군산", lat: 35.9676, lng: 126.7367 },
  { name: "포항", lat: 36.019, lng: 129.3435 },
  { name: "속초", lat: 38.207, lng: 128.5918 },
  { name: "부산", lat: 35.1796, lng: 129.0756 },
];

// ===== 중고나라 (중고 거래 마켓플레이스) =====
export const MARKET_CATEGORIES: { key: string; label: string }[] = [
  { key: "ROD", label: "로드/낚싯대" },
  { key: "REEL", label: "릴" },
  { key: "LURE", label: "루어" },
  { key: "WORM", label: "웜/소프트베이트" },
  { key: "LINE", label: "라인/쇼크리더" },
  { key: "WADER", label: "웨이더/장화" },
  { key: "TACKLEBOX", label: "태클박스/가방" },
  { key: "COOLER", label: "쿨러/아이스박스" },
  { key: "LIFEVEST", label: "구명조끼" },
  { key: "APPAREL", label: "의류/모자" },
  { key: "ELECTRONICS", label: "어탐/전자장비" },
  { key: "ETC", label: "기타 용품" },
];

export const marketCategoryLabel = (key: string) =>
  MARKET_CATEGORIES.find((c) => c.key === key)?.label ?? key;

// 거래 지역 (광역 단위)
export const MARKET_REGIONS: string[] = [
  "서울", "경기", "인천", "강원", "충북", "대전/충남", "대구/경북",
  "부산/울산/경남", "전북", "광주/전남", "제주",
];

// 상품 상태 (새상품/중고)
export const MARKET_CONDITIONS: { key: string; label: string }[] = [
  { key: "NEW", label: "새상품" },
  { key: "USED", label: "중고" },
];
export const marketConditionLabel = (key: string) =>
  MARKET_CONDITIONS.find((c) => c.key === key)?.label ?? key;

// 거래방법 (직거래/택배/둘 다 가능)
export const MARKET_TRADE_METHODS: { key: string; label: string }[] = [
  { key: "DIRECT", label: "직거래" },
  { key: "DELIVERY", label: "택배" },
  { key: "BOTH", label: "둘 다 가능" },
];
export const marketTradeMethodLabel = (key: string) =>
  MARKET_TRADE_METHODS.find((m) => m.key === key)?.label ?? key;

// 판매 상태 (판매중/예약중/판매완료)
export const MARKET_STATUS: { key: string; label: string }[] = [
  { key: "SELLING", label: "판매중" },
  { key: "RESERVED", label: "예약중" },
  { key: "SOLD", label: "판매완료" },
];
export const marketStatusLabel = (key: string) =>
  MARKET_STATUS.find((s) => s.key === key)?.label ?? key;

// 가격 정렬 옵션
export const MARKET_SORTS: { key: string; label: string }[] = [
  { key: "recent", label: "최신순" },
  { key: "price_asc", label: "낮은 가격순" },
  { key: "price_desc", label: "높은 가격순" },
];
