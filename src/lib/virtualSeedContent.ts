import { prisma } from "@/lib/prisma";
import {
  buildWalkingRoute, logCategoryForSpot, pickCatchMarkers,
  SPOT_STYLE_LABEL, spotsForRegion, type FishingSpot,
} from "@/lib/fishingSpots";
import { findPersonality, type PersonalityKey } from "@/lib/virtualMembers";

// 가상회원 초기 시드 콘텐츠 생성.
// "이미 일정 기간 활동한 것처럼" 보이도록 최근 N일에 걸쳐 글·댓글·좋아요를 backdate 해서 채운다.
//
// 동적 활동(virtualActivity.ts)은 OpenAI 를 호출하지만, 초기 시드는 템플릿 기반이다.
//  - API 키 없이도 즉시 채울 수 있고, 수백 건을 만드는 데 비용이 들지 않으며
//  - 같은 입력이면 항상 같은 결과가 나와(결정적) 재현·검증이 쉽다.
// 입낚볼·쇼핑 구매(주문 데이터)는 생성하지 않는다.
//
// 기록/스마트피싱 기능은 건드리지 않는다 — FishingTrip/CatchRecord 등은 만들지 않고,
// 워킹 피드 글은 기존 더미(seed-feeds-walking)와 같이 tripId 없이 생성한다.

// ===== 결정적 난수 =====
/** mulberry32 — seed 하나로 재현 가능한 난수열을 만든다. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;
const pick = <T,>(arr: T[], r: Rand): T => arr[Math.floor(r() * arr.length)];
const int = (min: number, max: number, r: Rand) => min + Math.floor(r() * (max - min + 1));

const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800`;

// ===== 조건 데이터 =====
const WEATHER = ["맑음", "구름 많음", "흐림", "약한 비", "옅은 안개", "바람 조금 강함"];
const WIND = ["미풍", "북동풍 3m/s", "남풍 4m/s", "북서풍 6m/s", "동풍 2m/s"];
const TIDE = ["1물", "3물", "5물", "7물", "9물", "12물", "조금", "사리"];
const TIME_SLOT = ["새벽", "아침", "오전", "오후", "해질녘", "야간"];

/** 어종별 주 채비 — 실제로 그 어종에 쓰는 조합만 넣는다. */
const RIG_BY_SPECIES: Record<string, string[]> = {
  배스: ["4인치 웜 텍사스리그", "스피너베이트 3/8oz", "크랭크베이트", "지그헤드 + 그럽웜", "프로그"],
  쏘가리: ["7cm 미노우", "스푼 5g", "지그헤드 2g + 웜"],
  꺽지: ["5cm 미노우", "지그헤드 1.5g + 웜", "스푼 3g"],
  송어: ["스푼 3g", "미노우 5cm", "인디케이터 플라이"],
  산천어: ["스푼 3g", "소형 미노우 45mm"],
  은어: ["도로카시 채비", "루어 45mm"],
  볼락: ["1.5g 지그헤드 + 2인치 웜", "카드채비", "메탈지그 10g"],
  열기: ["카드채비 5본", "메탈지그 20g"],
  감성돔: ["0.8호 반유동 찌 + 크릴", "1.7호 목줄 + 갯지렁이", "밑밥 + 크릴"],
  벵에돔: ["0.6호 찌 + 크릴", "제로찌 반유동 + 빵가루"],
  돌돔: ["카본 목줄 20호 + 성게", "구멍찌 + 소라"],
  참돔: ["타이라바 100g", "타이라바 80g 네크로타입"],
  우럭: ["지그헤드 14g + 섀드웜", "다운샷 20호 + 미꾸라지", "메탈지그 30g"],
  광어: ["다운샷 채비 + 섀드웜", "지그헤드 20g + 웜"],
  농어: ["미노우 12cm", "바이브레이션 20g", "펜슬베이트"],
  무늬오징어: ["에기 3.5호", "에기 3.0호 샬로우"],
  한치: ["에기 2.5호 + 케미", "직결 채비"],
  방어: ["메탈지그 150g", "지깅 하이피치 180g"],
  부시리: ["메탈지그 120g", "펜슬 포퍼"],
  삼치: ["메탈지그 40g", "스푼 30g"],
  고등어: ["사비키 채비", "메탈지그 20g"],
  전갱이: ["사비키 채비", "1g 지그헤드 + 웜"],
  학꽁치: ["막대찌 + 크릴", "카고 채비"],
  붕어: ["글루텐 미끼", "지렁이 + 옥수수", "떡밥 3합"],
  잉어: ["옥수수 3알", "떡밥 + 지렁이"],
  가물치: ["프로그", "웜 노싱커"],
  강준치: ["미노우 7cm", "메탈바이브"],
  누치: ["지렁이 채비", "스푼 5g"],
  숭어: ["훌치기 채비", "지렁이 채비"],
  도다리: ["원투 2본 채비 + 갯지렁이", "루어 지그헤드"],
  주꾸미: ["에기 + 봉돌 채비"],
  문어: ["문어 에기", "왕눈이 채비"],
  노래미: ["원투 채비 + 갯지렁이"],
  따치: ["0.8호 찌 + 크릴"],
  황어: ["스푼 5g", "지렁이 채비"],
  블루길: ["소형 지그헤드 + 웜"],
  메기: ["지렁이 대물 채비"],
  끄리: ["소형 미노우", "스푼 5g"],
};
const rigFor = (species: string, r: Rand) => pick(RIG_BY_SPECIES[species] ?? ["지그헤드 + 웜", "메탈지그 20g", "미노우 9cm"], r);

/** 어종별 현실적인 씨알 범위(cm) */
const SIZE_BY_SPECIES: Record<string, [number, number]> = {
  배스: [25, 48], 쏘가리: [25, 45], 꺽지: [15, 26], 송어: [25, 45], 산천어: [18, 30],
  은어: [15, 25], 볼락: [15, 26], 열기: [18, 30], 감성돔: [28, 45], 벵에돔: [22, 38],
  돌돔: [30, 52], 참돔: [35, 65], 우럭: [22, 40], 광어: [35, 60], 농어: [40, 75],
  무늬오징어: [18, 30], 한치: [15, 25], 방어: [60, 95], 부시리: [55, 90], 삼치: [40, 65],
  고등어: [25, 38], 전갱이: [18, 30], 학꽁치: [20, 30], 붕어: [20, 38], 잉어: [40, 70],
  가물치: [45, 70], 강준치: [30, 50], 누치: [30, 50], 숭어: [35, 60], 도다리: [20, 32],
  주꾸미: [10, 18], 문어: [25, 50], 노래미: [20, 32], 따치: [20, 30], 황어: [25, 40],
  블루길: [10, 20], 메기: [40, 70], 끄리: [25, 40],
};
function sizeFor(species: string, r: Rand) {
  const [min, max] = SIZE_BY_SPECIES[species] ?? [20, 40];
  return int(min, max, r);
}

// ===== 피싱 피드(조황) 캡션 =====
type Ctx = {
  spot: FishingSpot; styleLabel: string; species: string; size: number; count: number;
  weather: string; wind: string; tide: string; rig: string; temp: number; slot: string;
  dateLabel: string; region: string;
};

const FEED_CAPTION: Record<PersonalityKey, ((c: Ctx) => string)[]> = {
  ACTIVE: [
    (c) => `${c.spot.name} 다녀왔습니다! ${c.species} ${c.count}마리, 최대 ${c.size}cm 🎣 ${c.rig} 반응이 제일 좋았어요`,
    (c) => `${c.slot} ${c.spot.name} 출근 완료! ${c.species} ${c.size}cm급 나와줬습니다 💪`,
    (c) => `${c.spot.name} ${c.styleLabel} 조황 좋습니다! ${c.count}마리 하고 철수 🙌`,
  ],
  INFO: [
    (c) => `${c.spot.name} / ${c.weather} / ${c.tide}\n${c.species} ${c.count}마리 (${c.size}cm급)\n채비: ${c.rig}\n수온 ${c.temp}도, 입질은 ${c.slot}에 집중됐습니다.`,
    (c) => `[${c.dateLabel} ${c.spot.name}]\n대상어 ${c.species} · ${c.count}마리 · 최대 ${c.size}cm\n${c.rig} / ${c.wind}\n같은 채비로 ${c.slot} 시간대 노려보시면 좋습니다.`,
    (c) => `${c.spot.name} ${c.styleLabel} 기록 남깁니다.\n${c.species} ${c.size}cm 포함 ${c.count}마리, ${c.tide}에 조류 적당했습니다. 채비는 ${c.rig}.`,
  ],
  EMOTION: [
    (c) => `${c.spot.name}의 ${c.slot}. ${c.count === 1 ? `${c.species} 한 마리로 충분한 하루였습니다` : `${c.species} ${c.count}마리, 조용한 하루였습니다`}`,
    (c) => `물빛이 좋아서 오래 앉아 있었습니다. ${c.species} ${c.size}cm, 보내주고 왔어요`,
    (c) => `${c.weather}인 ${c.spot.name}. 조용해서 좋았습니다`,
  ],
  QUESTION: [
    (c) => `${c.spot.name}에서 ${c.species} ${c.count}마리 했는데요, ${c.rig} 말고 더 잘 먹는 채비 있을까요?`,
    (c) => `${c.species} ${c.size}cm 나왔습니다! 초보라 잘 모르는데 이 정도면 괜찮은 씨알인가요?`,
    (c) => `${c.spot.name} 처음 가봤어요. ${c.slot}에 갔는데 시간대를 바꿔야 할까요?`,
  ],
  OBSERVER: [
    (c) => `${c.spot.name} ${c.species} ${c.size}cm. 조용히 한 수 하고 왔습니다`,
    (c) => `${c.dateLabel} ${c.spot.name}. ${c.count}마리.`,
    (c) => `오랜만에 ${c.spot.name}. ${c.species} 얼굴 봤습니다`,
  ],
};

// ===== 일상 피드 캡션 =====
const GENERAL_CAPTION: Record<PersonalityKey, ((c: Ctx) => string)[]> = {
  ACTIVE: [
    (c) => `이번 주말 ${c.region} 출조 계획 중입니다! ${c.spot.name} 쪽 생각하고 있는데 동출하실 분 계신가요 🙌`,
    (c) => `장비 정리 끝! 이번엔 ${c.species} 노려봅니다. ${c.rig} 새로 묶어놨어요 🎣`,
    (c) => `${c.region} 조황 슬슬 올라오네요. 다음 주에 ${c.spot.name} 갑니다!`,
  ],
  INFO: [
    (c) => `${c.spot.name} 주차·진입 정보 공유합니다.\n입구 쪽에 10대 정도 세울 수 있고, ${c.styleLabel} 구간까지 도보 5분 정도입니다. 발판이 젖어 있으면 미끄러워서 신발 조심하세요.`,
    (c) => `${c.region} ${c.species} 시즌 정리\n수온 ${c.temp}도 전후로 활성도가 올라옵니다. 채비는 ${c.rig} 기준으로 맞추시면 무리 없어요.`,
    (c) => `${c.rig} 한 달 써본 후기입니다. 장점은 밑걸림이 확실히 줄어든 점, 단점은 예민한 입질을 놓치기 쉽다는 것. ${c.species} 노릴 때는 만족스러웠습니다.`,
  ],
  EMOTION: [
    () => `장비 정리하다 보니 벌써 새벽. 낚시는 준비하는 시간도 좋습니다`,
    (c) => `${c.region}은 오늘 ${c.weather}. 못 나가는 날엔 사진만 들여다봅니다`,
    () => `물가에 앉아 있으면 생각이 정리됩니다. 그래서 계속 나가는 것 같아요`,
  ],
  QUESTION: [
    (c) => `낚시 입문 3개월입니다. 로드를 하나 더 사려는데 ${c.region}에서 ${c.species} 노리기 좋은 대 추천 부탁드립니다!`,
    (c) => `${c.spot.name} 처음 가보려고 하는데 초보도 괜찮을까요? 발판이 험한 편인가요?`,
    (c) => `합사와 카본 목줄 연결 매듭이 자꾸 풀립니다 ㅠㅠ ${c.species} 채비 쓰시는 분들은 어떤 매듭 쓰세요?`,
  ],
  OBSERVER: [
    (c) => `요즘 ${c.region} 조황 글 잘 보고 있습니다. 다들 대박 나시길`,
    () => `날씨 풀리면 다시 나가보려 합니다`,
    (c) => `${c.spot.name} 언젠가 꼭 가보고 싶습니다`,
  ],
};

// ===== 조행기 =====
function buildLog(c: Ctx, personality: PersonalityKey, r: Rand): { title: string; body: string } {
  // 조황에 안 맞는 제목("1마리 대박")이 나오지 않도록 마릿수에 따라 표현을 바꾼다.
  const catchPhrase = c.count === 0 ? "빈손 출조" : c.count >= 4 ? `${c.count}마리 대박` : `${c.species} ${c.size}cm`;
  const titles: Record<PersonalityKey, string[]> = {
    ACTIVE: [`${c.spot.name} ${c.species} 조행기 — ${catchPhrase}`, `${c.slot} ${c.spot.name} 출조기 · ${c.species} ${c.size}cm`],
    INFO: [`${c.spot.name} ${c.species} 조행기 — 채비·물때 정리`, `[${c.dateLabel}] ${c.spot.name} ${c.styleLabel} 조황 리포트`],
    EMOTION: [`${c.spot.name}의 ${c.slot}`, `${c.spot.name}에서 만난 ${c.species}`],
    QUESTION: [`${c.spot.name} 첫 출조기 (조언 부탁드립니다)`, `초보의 ${c.spot.name} ${c.species} 도전기`],
    OBSERVER: [`${c.spot.name} 조행기`, `${c.dateLabel} ${c.spot.name} 기록`],
  };

  const intro = pick([
    `${c.dateLabel}, ${c.spot.name}으로 ${c.species} 출조를 다녀왔습니다. 날씨는 ${c.weather}, ${c.wind} 정도였고 수온은 ${c.temp}도였습니다.`,
    `${c.slot}에 ${c.spot.name}에 도착했습니다. ${c.weather}에 ${c.wind}, ${c.spot.water === "SEA" ? `물때는 ${c.tide}였습니다.` : `물색은 적당히 맑았습니다.`}`,
    `오랜만에 ${c.spot.name}을 찾았습니다. ${c.weather}인 날씨였고 ${c.styleLabel} 구간을 위주로 공략했습니다.`,
  ], r);

  const middle = pick([
    `채비는 ${c.rig}로 통일했습니다. ${c.styleLabel} 특성상 밑걸림이 있어서 무게를 조금 가볍게 가져갔고, 그게 오히려 입질을 늘려준 것 같습니다. ${c.species}는 ${c.slot}에 집중적으로 붙었습니다.`,
    `${c.rig} 조합으로 시작했는데 반응이 없어서 리트리브 속도를 절반으로 줄였습니다. 그때부터 ${c.species}가 붙기 시작했어요. 액션보다 속도가 답인 날이었습니다.`,
    `주력은 ${c.rig}였습니다. ${c.spot.water === "SEA" ? "조류가 흐르는 구간과 죽는 구간의 경계" : "물골과 수초 경계선"}을 집중적으로 노렸고, 그 라인에서만 입질이 나왔습니다.`,
  ], r);

  const result = `조황은 ${c.species} ${c.count}마리, 최대 ${c.size}cm였습니다.` +
    (c.count >= 4 ? " 씨알도 고르게 좋아서 만족스러운 하루였습니다." : c.count === 0 ? " 아쉽게 얼굴은 못 봤지만 다음 패턴은 잡은 것 같습니다." : " 마릿수는 적었지만 씨알이 괜찮았습니다.");

  const outro: Record<PersonalityKey, string> = {
    ACTIVE: "다음 주에 또 갈 예정입니다. 동출하실 분 댓글 주세요! 🎣",
    INFO: `정리하면 ${c.spot.name}은 ${c.slot} 시간대 + ${c.rig} 조합이 가장 무난합니다. 참고되셨으면 좋겠습니다.`,
    EMOTION: "돌아오는 길 노을이 좋았습니다. 그것만으로도 충분한 출조였어요.",
    QUESTION: `혹시 이 포인트에서 ${c.species} 노리실 때 더 좋은 채비 있으면 알려주시면 감사하겠습니다!`,
    OBSERVER: "기록으로 남겨둡니다.",
  };

  return {
    title: pick(titles[personality], r),
    body: `${intro}\n\n${middle}\n\n${result} ${outro[personality]}`,
  };
}

// ===== 워킹 피드 캡션 =====
// FeedCard 는 워킹 피드에서 caption 을 본문에 노출하지 않고 거리·시간·마릿수 스트립으로 대체하지만,
// 메인 큐레이션 카드와 조행기 목록의 제목 폴백에서는 caption 을 사용하므로 출조 요약을 담아둔다.
function walkingCaption(c: Ctx, distanceM: number, durationMin: number) {
  const dist = distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${distanceM}m`;
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const time = hours > 0 ? `${hours}시간 ${mins > 0 ? `${mins}분` : ""}`.trim() : `${mins}분`;
  const head = `${c.dateLabel} ${c.spot.name} 워킹 · ${dist} · ${time}`;
  const body = c.count > 0
    ? `${c.species} ${c.count}마리(최대 ${c.size}cm) · ${c.rig} · ${c.weather}`
    : `${c.species} 노렸지만 입질 없음 · ${c.rig} · ${c.weather}`;
  return `${head}\n${body}`;
}

// ===== 중고마켓 =====
const MARKET_ITEMS: { category: string; names: string[]; min: number; max: number }[] = [
  { category: "REEL", names: ["다이와 루비아스 LT2500", "시마노 스텔라 C3000", "시마노 뱅퀴시 2500S", "아부가르시아 레보 베이트릴"], min: 90000, max: 480000 },
  { category: "ROD", names: ["메이저크래프트 배스로드 1.6m", "에깅 전용대 8.6ft", "원투 캐스팅대 4.5m", "선상 지깅대 6ft"], min: 60000, max: 320000 },
  { category: "LURE", names: ["미노우 모음 20개", "메탈지그 세트 6개", "무늬오징어 에기 세트 12개", "타이라바 헤드 80g 세트"], min: 15000, max: 90000 },
  { category: "WORM", names: ["4인치 웜 대량 미개봉", "그럽웜 세트", "섀드웜 3인치 묶음"], min: 8000, max: 35000 },
  { category: "LINE", names: ["PE 합사 1.5호 300m", "카본 목줄 3호 100m", "나일론 원줄 4호"], min: 10000, max: 60000 },
  { category: "WADER", names: ["갯바위 웨이더 270mm", "네오프렌 웨이더 275mm"], min: 40000, max: 150000 },
  { category: "TACKLEBOX", names: ["방수 태클박스 대형", "숄더 태클백"], min: 20000, max: 90000 },
  { category: "COOLER", names: ["쿨러 25L 아이스박스", "쿨러 45L 대형"], min: 30000, max: 180000 },
  { category: "LIFEVEST", names: ["자동팽창 구명조끼 미사용", "부력 구명조끼"], min: 40000, max: 160000 },
  { category: "ELECTRONICS", names: ["휴대용 어탐기", "헤드랜턴 충전식", "집어등 12V"], min: 30000, max: 320000 },
];

function buildMarket(c: Ctx, personality: PersonalityKey, r: Rand) {
  const item = pick(MARKET_ITEMS, r);
  const name = pick(item.names, r);
  const condition = r() < 0.25 ? "NEW" : "USED";
  const price = Math.round((item.min + r() * (item.max - item.min)) / 1000) * 1000;
  const years = int(1, 4, r);

  const desc = condition === "NEW"
    ? `${name} 새제품입니다.\n\n선물 받았는데 이미 같은 제품이 있어 판매합니다. 미개봉 상태이고 구성품 전부 있습니다.\n${c.region} 직거래 가능하며 택배도 보내드립니다.\n궁금한 점 있으면 편하게 문의 주세요.`
    : `${name} 판매합니다.\n\n${years}년 정도 사용했고 ${c.spot.name} 위주로 다니면서 썼습니다. 기능상 문제는 전혀 없고 사용에 따른 잔기스 정도만 있습니다.\n${personality === "INFO" ? `${c.species} 노릴 때 주로 사용했고, 최근에 점검·세척까지 마쳤습니다.` : "깨끗하게 관리했습니다."}\n${c.region} 직거래 선호하고 택배 발송도 가능합니다.`;

  return { title: name, description: desc, price, condition, category: item.category };
}

// ===== 댓글 =====
const COMMENTS: Record<PersonalityKey, string[]> = {
  ACTIVE: [
    "와 대박이네요! 저도 이번 주에 가보겠습니다 🎣", "씨알 좋습니다!! 축하드려요",
    "역시 이 시기엔 여기가 답이네요 👏", "동출 한번 하시죠! 저도 그쪽 자주 갑니다",
    "사진만 봐도 손맛이 느껴집니다 ㅎㅎ",
  ],
  INFO: [
    "채비 조합이 시간대와 잘 맞았네요. 정보 감사합니다", "물때까지 적어주셔서 도움 많이 됐습니다",
    "저도 같은 구간에서 비슷한 패턴이었습니다. 수온이 관건인 듯하네요",
    "리트리브 속도 줄인 게 결정적이었을 것 같습니다", "포인트 진입로 정보까지 정확하네요. 잘 배웠습니다",
  ],
  EMOTION: [
    "사진 분위기가 참 좋네요", "이런 날씨에 물가 앉아있으면 참 좋죠",
    "글이 차분해서 읽기 좋았습니다", "방생하신 것도 멋지네요",
    "노을 사진 한 장이 다 말해주는 것 같습니다",
  ],
  QUESTION: [
    "혹시 채비 어떻게 하셨는지 더 알려주실 수 있나요?", "초보도 갈 수 있는 포인트인가요? 발판이 궁금합니다",
    "저도 그 채비 써봤는데 잘 안 됐어요. 리트리브 속도가 문제였을까요?",
    "주차는 어디에 하셨나요?", "몇 시쯤 들어가시는 게 좋을까요?",
  ],
  OBSERVER: [
    "좋은 조황이네요", "잘 보고 갑니다", "부럽습니다 ㅎㅎ", "저도 조만간 나가봐야겠어요", "멋진 씨알입니다",
  ],
};

// ===== 성격별 생성량 =====
const PLAN: Record<PersonalityKey, { feed: number; general: number; log: number; walking: number; market: number; comments: number; likes: number }> = {
  //                       조황  일상  조행기 워킹  중고  댓글  좋아요
  ACTIVE:   { feed: 3, general: 3, log: 1, walking: 2, market: 1, comments: 12, likes: 22 },
  INFO:     { feed: 2, general: 2, log: 2, walking: 1, market: 2, comments: 7, likes: 14 },
  EMOTION:  { feed: 2, general: 2, log: 1, walking: 1, market: 0, comments: 9, likes: 18 },
  QUESTION: { feed: 1, general: 3, log: 1, walking: 1, market: 0, comments: 7, likes: 12 },
  OBSERVER: { feed: 1, general: 1, log: 0, walking: 0, market: 0, comments: 14, likes: 24 },
};

export type SeedContentSummary = {
  members: number;
  feed: number;
  general: number;
  log: number;
  walking: number;
  market: number;
  comments: number;
  likes: number;
  skipped: number;
};

const KO_DATE = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

function buildCtx(spot: FishingSpot, at: Date, r: Rand): Ctx {
  const species = pick(spot.species, r);
  return {
    spot,
    styleLabel: SPOT_STYLE_LABEL[spot.style],
    species,
    size: sizeFor(species, r),
    count: int(0, 6, r),
    weather: pick(WEATHER, r),
    wind: pick(WIND, r),
    tide: pick(TIDE, r),
    rig: rigFor(species, r),
    temp: int(spot.water === "SEA" ? 12 : 8, spot.water === "SEA" ? 24 : 26, r),
    slot: pick(TIME_SLOT, r),
    dateLabel: KO_DATE(at),
    region: spot.region,
  };
}

/**
 * 가상회원 초기 시드 콘텐츠를 생성한다.
 * 이미 콘텐츠 활동 이력이 있는 회원은 건너뛰므로, 여러 번 실행해도 중복 생성되지 않는다.
 *
 * @param days 콘텐츠를 분산시킬 과거 기간(일). 기본 60일.
 */
export async function seedVirtualContent(options?: { days?: number }): Promise<SeedContentSummary> {
  const days = Math.max(7, Math.min(365, options?.days ?? 60));
  const members = await prisma.virtualMember.findMany({
    include: { user: { select: { id: true, region: true, nickname: true } } },
    orderBy: { createdAt: "asc" },
  });

  const summary: SeedContentSummary = {
    members: 0, feed: 0, general: 0, log: 0, walking: 0, market: 0, comments: 0, likes: 0, skipped: 0,
  };
  if (members.length === 0) return summary;

  // 이미 콘텐츠를 가진 회원은 건너뛴다 (중복 방지)
  const existing = await prisma.virtualActivity.groupBy({
    by: ["memberId"],
    where: { kind: { in: ["FEED", "GENERAL", "LOG", "WALKING", "MARKET"] } },
  });
  const hasContent = new Set(existing.map((e) => e.memberId));

  const now = Date.now();
  const spanMs = days * 86400000;
  // 활동 이력(VirtualActivity)은 마지막에 한 번에 넣는다.
  const activityRows: { memberId: string; kind: string; targetType: string; targetId: string; summary: string; createdAt: Date }[] = [];
  // 좋아요 대상으로 쓸 (postId, authorId) 목록
  const createdPosts: { id: string; authorId: string; createdAt: Date }[] = [];

  for (let mi = 0; mi < members.length; mi++) {
    const m = members[mi];
    if (hasContent.has(m.id)) { summary.skipped++; continue; }

    const r = rng(0x51ed + mi * 7919);
    const personality = findPersonality(m.personality).key;
    const plan = PLAN[personality];
    const spots = spotsForRegion(m.user.region);

    // 이 회원의 글들을 기간 내에 흩어 놓는다.
    const totalPosts = plan.feed + plan.general + plan.log + plan.walking + plan.market;
    const times: Date[] = Array.from({ length: totalPosts }, (_, k) => {
      const ratio = (k + r() * 0.8) / Math.max(1, totalPosts);
      // 최근일수록 조금 촘촘하게 — ratio 를 제곱해 과거로 밀어낸다.
      const back = spanMs * (1 - Math.pow(ratio, 0.85)) * (0.85 + r() * 0.3);
      return new Date(now - Math.min(spanMs, Math.max(3600000, back)));
    }).sort((a, b) => a.getTime() - b.getTime());

    let t = 0;
    const nextAt = () => times[Math.min(t++, times.length - 1)] ?? new Date(now - r() * spanMs);

    const addActivity = (kind: string, targetType: string, targetId: string, text: string, createdAt: Date) =>
      activityRows.push({ memberId: m.id, kind, targetType, targetId, summary: text.replace(/\s+/g, " ").slice(0, 200), createdAt });

    // --- 피싱 피드 ---
    for (let k = 0; k < plan.feed; k++) {
      const at = nextAt();
      const spot = pick(spots, r);
      const c = buildCtx(spot, at, r);
      if (c.count === 0) c.count = 1; // 조황 피드는 최소 1마리
      const caption = pick(FEED_CAPTION[personality], r)(c);
      const post = await prisma.post.create({
        data: {
          authorId: m.user.id, kind: "FEED", postType: "GENERAL",
          caption, region: spot.region, speciesName: c.species, sizeCm: c.size,
          categoryPath: `${spot.water === "SEA" ? "바다낚시" : "민물낚시"} > ${c.styleLabel}`,
          fishingType: c.styleLabel,
          lat: spot.lat, lng: spot.lng,
          visibility: "PUBLIC",
          hashtags: JSON.stringify([c.species, spot.name.replace(/\s/g, ""), c.styleLabel]),
          createdAt: at,
          images: { create: [{ url: img(`vfeed-${m.id}-${k}`), alt: `${c.species} ${c.size}cm`, order: 0 }] },
        },
      });
      createdPosts.push({ id: post.id, authorId: m.user.id, createdAt: at });
      addActivity("FEED", "POST", post.id, caption, at);
      summary.feed++;
    }

    // --- 일상 피드 ---
    for (let k = 0; k < plan.general; k++) {
      const at = nextAt();
      const spot = pick(spots, r);
      const c = buildCtx(spot, at, r);
      const caption = pick(GENERAL_CAPTION[personality], r)(c);
      const withPhoto = r() < 0.45;
      const post = await prisma.post.create({
        data: {
          authorId: m.user.id, kind: "FEED", postType: "GENERAL",
          caption, region: spot.region, visibility: "PUBLIC",
          hashtags: JSON.stringify(["낚시일상", spot.region]),
          createdAt: at,
          ...(withPhoto ? { images: { create: [{ url: img(`vgen-${m.id}-${k}`), alt: null, order: 0 }] } } : {}),
        },
      });
      createdPosts.push({ id: post.id, authorId: m.user.id, createdAt: at });
      addActivity("GENERAL", "POST", post.id, caption, at);
      summary.general++;
    }

    // --- 조행기 ---
    for (let k = 0; k < plan.log; k++) {
      const at = nextAt();
      const spot = pick(spots, r);
      const c = buildCtx(spot, at, r);
      const { title, body } = buildLog(c, personality, r);
      const imgCount = int(1, 2, r);
      const post = await prisma.post.create({
        data: {
          authorId: m.user.id, kind: "LOG", postType: "GENERAL",
          title, body, boardCategory: logCategoryForSpot(spot.style),
          region: spot.region, speciesName: c.species,
          viewCount: int(12, 340, r),
          visibility: "PUBLIC",
          hashtags: JSON.stringify(["조행기", c.species, spot.name.replace(/\s/g, "")]),
          createdAt: at,
          images: { create: Array.from({ length: imgCount }, (_, i) => ({ url: img(`vlog-${m.id}-${k}-${i}`), alt: title, order: i })) },
        },
      });
      createdPosts.push({ id: post.id, authorId: m.user.id, createdAt: at });
      addActivity("LOG", "POST", post.id, title, at);
      summary.log++;
    }

    // --- 워킹 피드 (실제 동선·어획 좌표 포함) ---
    for (let k = 0; k < plan.walking; k++) {
      const at = nextAt();
      // 워킹은 걸어서 접근하는 포인트가 자연스럽다 — 선상은 제외한다.
      const walkable = spots.filter((s) => s.style !== "BOAT");
      const spot = pick(walkable.length ? walkable : spots, r);
      const c = buildCtx(spot, at, r);
      const distanceM = int(1500, 8500, r);
      const durationMin = Math.round(distanceM / 1000 * int(35, 55, r));
      const seed = mi * 977 + k * 131 + 17;
      const route = buildWalkingRoute(spot, distanceM, seed);
      const catchMarkers = pickCatchMarkers(route, c.count, seed);
      const caption = walkingCaption(c, distanceM, durationMin);

      const post = await prisma.post.create({
        data: {
          authorId: m.user.id, kind: "WALKING", postType: "WALKING_FEED",
          caption,
          // FeedCard / WalkingFeedPage 가 파싱하는 동선·통계 JSON
          body: JSON.stringify({
            routePoints: route,
            distanceM,
            durationSec: durationMin * 60,
            points: route.length,
            catchCount: c.count,
            catchMarkers,
          }),
          region: spot.region,
          speciesName: c.count > 0 ? c.species : null,
          lat: spot.lat, lng: spot.lng,
          visibility: "PUBLIC",
          hashtags: JSON.stringify(["워킹낚시", spot.name.replace(/\s/g, ""), ...(c.count > 0 ? [c.species] : [])]),
          createdAt: at,
          // 어획이 있으면 조과 사진을 붙인다 (슬라이드는 [지도, ...사진] 순서로 렌더된다)
          ...(c.count > 0
            ? { images: { create: Array.from({ length: Math.min(2, c.count) }, (_, i) => ({ url: img(`vwalk-${m.id}-${k}-${i}`), alt: `${c.species} ${c.size}cm`, order: i })) } }
            : {}),
        },
      });
      createdPosts.push({ id: post.id, authorId: m.user.id, createdAt: at });
      addActivity("WALKING", "POST", post.id, caption, at);
      summary.walking++;
    }

    // --- 중고마켓 ---
    for (let k = 0; k < plan.market; k++) {
      const at = nextAt();
      const spot = pick(spots, r);
      const c = buildCtx(spot, at, r);
      const item = buildMarket(c, personality, r);
      const listing = await prisma.marketListing.create({
        data: {
          sellerId: m.user.id,
          title: item.title,
          category: item.category,
          condition: item.condition,
          price: item.price,
          region: m.user.region ?? spot.region,
          description: item.description,
          tradeMethod: pick(["DIRECT", "DELIVERY", "BOTH"], r),
          status: r() < 0.12 ? "RESERVED" : r() < 0.1 ? "SOLD" : "SELLING",
          viewCount: int(3, 210, r),
          createdAt: at,
          updatedAt: at,
          images: { create: Array.from({ length: int(1, 3, r) }, (_, i) => ({ url: img(`vmkt-${m.id}-${k}-${i}`), order: i })) },
        },
      });
      addActivity("MARKET", "MARKET_LISTING", listing.id, item.title, at);
      summary.market++;
    }

    summary.members++;
  }

  // ===== 댓글 · 좋아요 =====
  // 글이 모두 생성된 뒤에 달아야 "남의 글"을 폭넓게 고를 수 있다.
  const allPosts = createdPosts.length > 0
    ? createdPosts
    : (await prisma.post.findMany({
        where: { author: { virtualMember: { isNot: null } } },
        select: { id: true, authorId: true, createdAt: true },
      }));

  if (allPosts.length > 1) {
    const likeRows: { postId: string; userId: string; createdAt: Date }[] = [];

    for (let mi = 0; mi < members.length; mi++) {
      const m = members[mi];
      if (hasContent.has(m.id)) continue;
      const r = rng(0x9e37 + mi * 6151);
      const personality = findPersonality(m.personality).key;
      const plan = PLAN[personality];
      const others = allPosts.filter((p) => p.authorId !== m.user.id);
      if (others.length === 0) continue;

      // --- 댓글 ---
      for (let k = 0; k < plan.comments; k++) {
        const target = pick(others, r);
        // 댓글은 글보다 나중에 달린다 (글 시각 ~ 지금 사이)
        const gap = Math.max(600000, (now - target.createdAt.getTime()) * r());
        const at = new Date(Math.min(now - 60000, target.createdAt.getTime() + gap));
        const body = pick(COMMENTS[personality], r);
        const comment = await prisma.comment.create({
          data: { postId: target.id, authorId: m.user.id, body, createdAt: at },
        });
        activityRows.push({
          memberId: m.id, kind: "COMMENT", targetType: "COMMENT", targetId: comment.id,
          summary: body.slice(0, 200), createdAt: at,
        });
        summary.comments++;
      }

      // --- 좋아요 ---
      const liked = new Set<string>();
      for (let k = 0; k < plan.likes; k++) {
        const target = pick(others, r);
        if (liked.has(target.id)) continue;
        liked.add(target.id);
        const gap = Math.max(300000, (now - target.createdAt.getTime()) * r());
        const at = new Date(Math.min(now - 30000, target.createdAt.getTime() + gap));
        likeRows.push({ postId: target.id, userId: m.user.id, createdAt: at });
        activityRows.push({
          memberId: m.id, kind: "LIKE", targetType: "LIKE", targetId: target.id,
          summary: "", createdAt: at,
        });
      }
    }

    // 좋아요는 (postId, userId) 유니크다. 회원별 Set 으로 이미 중복을 걸렀지만,
    // SQLite 는 createMany 의 skipDuplicates 를 지원하지 않으므로 충돌 시에는 건별로 재시도한다.
    for (let i = 0; i < likeRows.length; i += 500) {
      const chunk = likeRows.slice(i, i + 500);
      try {
        const res = await prisma.like.createMany({ data: chunk });
        summary.likes += res.count;
      } catch {
        for (const row of chunk) {
          const ok = await prisma.like.create({ data: row }).catch(() => null);
          if (ok) summary.likes++;
        }
      }
    }
  }

  // ===== 활동 이력 기록 + 회원 집계 갱신 =====
  for (let i = 0; i < activityRows.length; i += 500) {
    await prisma.virtualActivity.createMany({ data: activityRows.slice(i, i + 500) });
  }

  const perMember = new Map<string, { count: number; last: Date }>();
  for (const a of activityRows) {
    const cur = perMember.get(a.memberId);
    if (!cur) perMember.set(a.memberId, { count: 1, last: a.createdAt });
    else {
      cur.count++;
      if (a.createdAt > cur.last) cur.last = a.createdAt;
    }
  }
  for (const [memberId, agg] of perMember) {
    await prisma.virtualMember.update({
      where: { id: memberId },
      data: { activityCount: { increment: agg.count }, lastActiveAt: agg.last },
    });
  }

  return summary;
}
