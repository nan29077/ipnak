// AI 가상회원 정의 — 지역·성격 분배 규칙, 닉네임 풀, 성격별 프롬프트 템플릿.
// 서버 전용 로직(생성·활동)은 virtualMemberSeed.ts / virtualActivity.ts 에서 이 모듈을 사용한다.

export const VIRTUAL_MEMBER_TOTAL = 100;

// 가상회원 계정 이메일 규칙 — 이 도메인으로 가상회원 여부를 판별한다.
export const VIRTUAL_EMAIL_DOMAIN = "virtual.ipnak.test";
export const virtualEmail = (index: number) =>
  `vangler${String(index + 1).padStart(3, "0")}@${VIRTUAL_EMAIL_DOMAIN}`;

// ===== 지역 분배 (한국 인구구조 참고, 합계 100명) =====
// region 문자열은 앱의 광역 지역 표기(MARKET_REGIONS)를 그대로 사용해 기존 지역 필터와 호환시킨다.
export type RegionGroupKey =
  | "CAPITAL" | "BUSAN_GN" | "DAEGU_GB" | "GWANGJU_JN"
  | "DAEJEON_CC" | "GANGWON" | "JEONBUK" | "JEJU" | "ETC";

export type RegionGroup = {
  key: RegionGroupKey;
  label: string;
  count: number; // 배정 인원(명)
  regions: string[]; // 그룹 내 실제 region 값 후보 (순환 배정)
};

export const REGION_GROUPS: RegionGroup[] = [
  { key: "CAPITAL", label: "수도권", count: 40, regions: ["서울", "경기", "인천", "경기", "서울", "경기"] },
  { key: "BUSAN_GN", label: "부산·경남", count: 15, regions: ["부산/울산/경남"] },
  { key: "DAEGU_GB", label: "대구·경북", count: 10, regions: ["대구/경북"] },
  { key: "GWANGJU_JN", label: "광주·전남", count: 8, regions: ["광주/전남"] },
  { key: "DAEJEON_CC", label: "대전·충청", count: 8, regions: ["대전/충남", "충북"] },
  { key: "GANGWON", label: "강원", count: 7, regions: ["강원"] },
  { key: "JEONBUK", label: "전북", count: 5, regions: ["전북"] },
  { key: "JEJU", label: "제주", count: 4, regions: ["제주"] },
  { key: "ETC", label: "기타", count: 3, regions: ["세종"] },
];

export const regionGroupLabel = (key: string) =>
  REGION_GROUPS.find((g) => g.key === key)?.label ?? key;

// ===== 성격 유형 분배 (합계 100명) =====
export type PersonalityKey = "ACTIVE" | "INFO" | "EMOTION" | "QUESTION" | "OBSERVER";

export type Personality = {
  key: PersonalityKey;
  label: string;
  count: number; // 배정 인원(명)
  desc: string;
  // 활동 1회에 글을 쓸 확률(0~1). 나머지는 댓글·좋아요 활동으로 처리한다.
  postRate: number;
  // 글을 쓸 때 선택할 영역 가중치. 합이 1이 아니어도 무방(정규화해서 사용).
  areaWeights: Partial<Record<VirtualContentArea, number>>;
  // OpenAI system 프롬프트에 들어가는 페르소나 지시문
  persona: string;
};

// 글을 쓸 수 있는 영역 — 입낚볼·쇼핑 구매는 의도적으로 제외한다.
export type VirtualContentArea = "FEED" | "GENERAL" | "LOG" | "WALKING" | "MARKET";

export const CONTENT_AREA_LABEL: Record<VirtualContentArea, string> = {
  FEED: "피싱 피드",
  GENERAL: "일상 피드",
  LOG: "조행기",
  WALKING: "워킹 피드",
  MARKET: "중고마켓",
};

export const PERSONALITIES: Personality[] = [
  {
    key: "ACTIVE",
    label: "활발형",
    count: 20,
    desc: "자주 글 쓰고 댓글도 많이 남김",
    postRate: 0.75,
    areaWeights: { FEED: 3, GENERAL: 3, LOG: 1, WALKING: 2, MARKET: 1 },
    persona:
      "당신은 낚시 커뮤니티에서 가장 활발한 회원입니다. 밝고 에너지 넘치는 말투로 짧게 자주 글을 씁니다. 이모지를 1~2개 자연스럽게 섞습니다.",
  },
  {
    key: "INFO",
    label: "정보공유형",
    count: 25,
    desc: "조황 정보·포인트·장비 리뷰 위주",
    postRate: 0.7,
    areaWeights: { FEED: 2, GENERAL: 1, LOG: 4, WALKING: 1, MARKET: 2 },
    persona:
      "당신은 조황·포인트·장비 정보를 꼼꼼히 정리해 공유하는 회원입니다. 물때·수온·채비·미끼처럼 구체적인 조건을 담아 담백하게 설명합니다. 과장하지 않습니다.",
  },
  {
    key: "EMOTION",
    label: "감성형",
    count: 20,
    desc: "짧고 감성적인 글",
    postRate: 0.6,
    areaWeights: { FEED: 3, GENERAL: 4, LOG: 1, WALKING: 2 },
    persona:
      "당신은 낚시의 풍경과 기분을 짧게 적는 감성적인 회원입니다. 두세 문장 안에서 끝내고, 조황 수치보다 그 순간의 분위기를 씁니다.",
  },
  {
    key: "QUESTION",
    label: "질문형",
    count: 15,
    desc: "낚시 초보, 질문이 많음",
    postRate: 0.65,
    areaWeights: { FEED: 1, GENERAL: 4, LOG: 1, WALKING: 1 },
    persona:
      "당신은 낚시를 시작한 지 얼마 안 된 초보 회원입니다. 장비·채비·포인트에 대해 궁금한 점을 솔직하게 묻습니다. 글은 반드시 질문으로 끝냅니다.",
  },
  {
    key: "OBSERVER",
    label: "관찰형",
    count: 20,
    desc: "댓글 위주, 글은 가끔",
    postRate: 0.2,
    areaWeights: { FEED: 2, GENERAL: 2, LOG: 1 },
    persona:
      "당신은 주로 남의 글을 읽고 짧게 반응하는 조용한 회원입니다. 글을 쓸 때도 담담하고 짧게 씁니다.",
  },
];

export const personalityLabel = (key: string) =>
  PERSONALITIES.find((p) => p.key === key)?.label ?? key;

export const findPersonality = (key: string) =>
  PERSONALITIES.find((p) => p.key === key) ?? PERSONALITIES[0];

// ===== 닉네임 풀 (100개, 중복 없음) =====
export const VIRTUAL_NICKNAMES: string[] = [
  "배스사냥꾼", "루어킹", "한강찌돌이", "갯바위낭만", "새벽출조",
  "초릿대감성", "쏘가리요정", "미노우장인", "원투의신", "붕어박사",
  "무늬오징어킬러", "에깅소년", "볼락등불", "감성돔사랑", "참돔한마리",
  "방파제산책", "웜하나면충분", "지그헤드러", "텍사스리거", "프로그맨",
  "수초헌터", "릴소리좋아", "스풀정리중", "합사매니아", "목줄장인",
  "뜰채준비완료", "쿨러가득", "방생주의보", "첫수의추억", "입질대기중",
  "찌올림중독", "밤낚시좋아", "조황요정", "물때달력", "조류읽는사람",
  "여울지기", "저수지산책러", "대물꿈나무", "손맛중독자", "캐스팅연습중",
  "라인트러블", "태클박스정리", "헤드랜턴", "웨이더신고", "갯지렁이한통",
  "크릴한스푼", "밑밥배합", "두마리면충분", "빈손도괜찮아", "낚시가좋다",
  "주말출조러", "퇴근후한수", "연차쓰고낚시", "도시어부지망생", "강태공이호",
  "물가의고요", "아침안개", "노을찌", "별보며낚시", "파도소리듣기",
  "갈대숲포인트", "다리밑명당", "수문앞자리", "방류직후", "초보탈출중",
  "이제두달차", "장비병환자", "중고장터폐인", "릴하나더", "로드다섯대",
  "스텔라꿈꾸는", "배스보트희망", "카약낚시러", "워킹만한다", "자전거출조",
  "뚜벅이앵글러", "백패킹낚시", "계곡송어", "산천어보고싶다", "은어살오름",
  "빙어시즌기다림", "겨울광어", "봄도다리", "여름농어", "가을삼치",
  "방어시즌개막", "부시리대물", "갈치은빛", "문어삼합", "주꾸미봄바람",
  "낙지가을", "우럭매운탕", "광어회한접시", "열기구이", "학꽁치찌맞춤",
  "숭어떼몰이", "잉어대물꾼", "향어터단골", "유료터전문", "아빠와낚시",
];

// ===== 자기소개 템플릿 (성격별) =====
const BIO_TEMPLATES: Record<PersonalityKey, string[]> = {
  ACTIVE: [
    "{region} 어디든 달려갑니다. 같이 출조하실 분 환영해요 🎣",
    "주 3회 출조 목표! {region} 조황은 제가 제일 빠릅니다",
    "{region}에서 제일 부지런한 앵글러가 되겠습니다",
  ],
  INFO: [
    "{region} 포인트·조황 정보를 기록으로 남깁니다. 채비 문의 환영",
    "{region} 위주로 다니며 장비 리뷰와 물때 데이터를 정리합니다",
    "{region} 조황 아카이브 중. 정확한 정보만 공유하려 노력합니다",
  ],
  EMOTION: [
    "{region} 물가에서 보내는 시간을 기록합니다",
    "고기보다 풍경. {region}의 아침을 좋아합니다",
    "{region} 노을과 파도 소리에 중독됐습니다",
  ],
  QUESTION: [
    "{region} 사는 낚시 입문자입니다. 많이 배우겠습니다!",
    "낚시 시작한 지 얼마 안 됐어요. {region} 초보 잘 부탁드립니다",
    "{region}에서 첫 낚시대 산 초보입니다. 질문 많아도 이해해주세요 🙏",
  ],
  OBSERVER: [
    "{region}에서 조용히 낚시합니다. 눈팅이 많아요",
    "{region} 거주. 주로 읽고 가끔 씁니다",
    "말수는 적지만 {region} 조황은 늘 챙겨봅니다",
  ],
};

export function virtualBio(personality: PersonalityKey, region: string, index: number) {
  const pool = BIO_TEMPLATES[personality] ?? BIO_TEMPLATES.OBSERVER;
  return pool[index % pool.length].replace("{region}", region);
}

// ===== 100명 배정 계획 =====
export type VirtualMemberPlan = {
  index: number;
  email: string;
  nickname: string;
  personality: PersonalityKey;
  regionGroup: RegionGroupKey;
  region: string;
  bio: string;
};

/**
 * 지역·성격 분배 비율을 그대로 반영한 100명의 배정 계획을 만든다.
 * 지역 그룹과 성격 목록을 각각 정해진 인원만큼 펼친 뒤, 성격 쪽을 한 칸씩 밀면서(index % ...)
 * 짝지어 특정 지역에 한 성격만 몰리지 않게 한다. 결과는 항상 동일하다(결정적).
 */
export function buildVirtualMemberPlan(): VirtualMemberPlan[] {
  const regionSlots: { group: RegionGroupKey; region: string }[] = [];
  for (const g of REGION_GROUPS) {
    for (let i = 0; i < g.count; i++) {
      regionSlots.push({ group: g.key, region: g.regions[i % g.regions.length] });
    }
  }

  const personalitySlots: PersonalityKey[] = [];
  for (const p of PERSONALITIES) {
    for (let i = 0; i < p.count; i++) personalitySlots.push(p.key);
  }

  // 두 배열 모두 100칸이지만, 방어적으로 짧은 쪽 기준으로 맞춘다.
  const total = Math.min(regionSlots.length, personalitySlots.length, VIRTUAL_NICKNAMES.length);

  return Array.from({ length: total }, (_, i) => {
    const slot = regionSlots[i];
    // 성격 배열을 소수(37)만큼 순회 위치를 흩어 지역별로 성격이 섞이게 한다.
    const personality = personalitySlots[(i * 37) % personalitySlots.length];
    return {
      index: i,
      email: virtualEmail(i),
      nickname: VIRTUAL_NICKNAMES[i],
      personality,
      regionGroup: slot.group,
      region: slot.region,
      bio: virtualBio(personality, slot.region, i),
    };
  });
}
