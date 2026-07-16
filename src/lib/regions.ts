// 한국 행정구역(시도 → 시군구) + 좌표/해안여부 데이터 및 명소형 낚시 포인트 생성기.
// AI 포인트 추천 기능에서 2단계 지역 선택과 구체적 장소명 추천에 사용한다.

export type Sigungu = { name: string; lat: number; lng: number; sea?: boolean };
export type Sido = { name: string; lat: number; lng: number; sigungu: Sigungu[] };

// 해안에 접한 시군구는 sea: true (방파제/갯바위/해변 포인트 생성)
export const KOREA_REGIONS: Sido[] = [
  {
    name: "서울특별시", lat: 37.5665, lng: 126.978, sigungu: [
      { name: "강남구", lat: 37.5172, lng: 127.0473 }, { name: "강동구", lat: 37.5301, lng: 127.1238 },
      { name: "강북구", lat: 37.6396, lng: 127.0257 }, { name: "강서구", lat: 37.5509, lng: 126.8495 },
      { name: "관악구", lat: 37.4784, lng: 126.9516 }, { name: "광진구", lat: 37.5385, lng: 127.0823 },
      { name: "구로구", lat: 37.4954, lng: 126.8874 }, { name: "금천구", lat: 37.4569, lng: 126.8956 },
      { name: "노원구", lat: 37.6542, lng: 127.0568 }, { name: "도봉구", lat: 37.6688, lng: 127.0471 },
      { name: "동대문구", lat: 37.5744, lng: 127.0398 }, { name: "동작구", lat: 37.5124, lng: 126.9393 },
      { name: "마포구", lat: 37.5663, lng: 126.9019 }, { name: "서대문구", lat: 37.5791, lng: 126.9368 },
      { name: "서초구", lat: 37.4837, lng: 127.0324 }, { name: "성동구", lat: 37.5633, lng: 127.0371 },
      { name: "성북구", lat: 37.5894, lng: 127.0167 }, { name: "송파구", lat: 37.5145, lng: 127.106 },
      { name: "양천구", lat: 37.5169, lng: 126.8665 }, { name: "영등포구", lat: 37.5264, lng: 126.8962 },
      { name: "용산구", lat: 37.5324, lng: 126.99 }, { name: "은평구", lat: 37.6027, lng: 126.9291 },
      { name: "종로구", lat: 37.5735, lng: 126.9789 }, { name: "중구", lat: 37.5636, lng: 126.9975 },
      { name: "중랑구", lat: 37.6063, lng: 127.0927 },
    ],
  },
  {
    name: "부산광역시", lat: 35.1796, lng: 129.0756, sigungu: [
      { name: "강서구", lat: 35.2122, lng: 128.9806, sea: true }, { name: "금정구", lat: 35.2429, lng: 129.0922 },
      { name: "기장군", lat: 35.2445, lng: 129.2222, sea: true }, { name: "남구", lat: 35.1366, lng: 129.0844, sea: true },
      { name: "동구", lat: 35.1294, lng: 129.0454, sea: true }, { name: "동래구", lat: 35.2049, lng: 129.0838 },
      { name: "부산진구", lat: 35.1626, lng: 129.0531 }, { name: "북구", lat: 35.1973, lng: 128.9904 },
      { name: "사상구", lat: 35.1525, lng: 128.9913 }, { name: "사하구", lat: 35.1043, lng: 128.9747, sea: true },
      { name: "서구", lat: 35.0979, lng: 129.0241, sea: true }, { name: "수영구", lat: 35.1455, lng: 129.1132, sea: true },
      { name: "연제구", lat: 35.1762, lng: 129.0796 }, { name: "영도구", lat: 35.0911, lng: 129.0683, sea: true },
      { name: "중구", lat: 35.1063, lng: 129.0325, sea: true }, { name: "해운대구", lat: 35.1631, lng: 129.1635, sea: true },
    ],
  },
  {
    name: "대구광역시", lat: 35.8714, lng: 128.6014, sigungu: [
      { name: "남구", lat: 35.846, lng: 128.5977 }, { name: "달서구", lat: 35.8297, lng: 128.5326 },
      { name: "달성군", lat: 35.7747, lng: 128.4314 }, { name: "동구", lat: 35.8866, lng: 128.6356 },
      { name: "북구", lat: 35.8858, lng: 128.5829 }, { name: "서구", lat: 35.8718, lng: 128.5591 },
      { name: "수성구", lat: 35.8583, lng: 128.6307 }, { name: "중구", lat: 35.8693, lng: 128.6062 },
      { name: "군위군", lat: 36.2429, lng: 128.5727 },
    ],
  },
  {
    name: "인천광역시", lat: 37.4563, lng: 126.7052, sigungu: [
      { name: "계양구", lat: 37.5374, lng: 126.7378 }, { name: "미추홀구", lat: 37.4636, lng: 126.6502 },
      { name: "남동구", lat: 37.4474, lng: 126.7314, sea: true }, { name: "동구", lat: 37.4738, lng: 126.6432 },
      { name: "부평구", lat: 37.5071, lng: 126.7219 }, { name: "서구", lat: 37.5454, lng: 126.676, sea: true },
      { name: "연수구", lat: 37.4101, lng: 126.6783, sea: true }, { name: "중구", lat: 37.4738, lng: 126.6216, sea: true },
      { name: "강화군", lat: 37.7466, lng: 126.4878, sea: true }, { name: "옹진군", lat: 37.4467, lng: 126.6369, sea: true },
    ],
  },
  {
    name: "광주광역시", lat: 35.1595, lng: 126.8526, sigungu: [
      { name: "광산구", lat: 35.1399, lng: 126.7937 }, { name: "남구", lat: 35.1330, lng: 126.9024 },
      { name: "동구", lat: 35.1461, lng: 126.9231 }, { name: "북구", lat: 35.1746, lng: 126.912 },
      { name: "서구", lat: 35.1516, lng: 126.8901 },
    ],
  },
  {
    name: "대전광역시", lat: 36.3504, lng: 127.3845, sigungu: [
      { name: "대덕구", lat: 36.3466, lng: 127.4156 }, { name: "동구", lat: 36.3115, lng: 127.4548 },
      { name: "서구", lat: 36.3554, lng: 127.3839 }, { name: "유성구", lat: 36.3623, lng: 127.3565 },
      { name: "중구", lat: 36.3256, lng: 127.4214 },
    ],
  },
  {
    name: "울산광역시", lat: 35.5384, lng: 129.3114, sigungu: [
      { name: "중구", lat: 35.5697, lng: 129.3328 }, { name: "남구", lat: 35.5439, lng: 129.33, sea: true },
      { name: "동구", lat: 35.5048, lng: 129.4167, sea: true }, { name: "북구", lat: 35.5827, lng: 129.3614, sea: true },
      { name: "울주군", lat: 35.522, lng: 129.2422, sea: true },
    ],
  },
  {
    name: "세종특별자치시", lat: 36.48, lng: 127.289, sigungu: [
      { name: "세종시", lat: 36.48, lng: 127.289 },
    ],
  },
  {
    name: "경기도", lat: 37.4138, lng: 127.5183, sigungu: [
      { name: "수원시", lat: 37.2636, lng: 127.0286 }, { name: "성남시", lat: 37.42, lng: 127.1265 },
      { name: "고양시", lat: 37.6584, lng: 126.832 }, { name: "용인시", lat: 37.2411, lng: 127.1776 },
      { name: "부천시", lat: 37.5035, lng: 126.766 }, { name: "안산시", lat: 37.3219, lng: 126.8309, sea: true },
      { name: "안양시", lat: 37.3943, lng: 126.9568 }, { name: "남양주시", lat: 37.636, lng: 127.2165 },
      { name: "화성시", lat: 37.1996, lng: 126.8313, sea: true }, { name: "평택시", lat: 36.9921, lng: 127.1129, sea: true },
      { name: "의정부시", lat: 37.738, lng: 127.0337 }, { name: "시흥시", lat: 37.38, lng: 126.8031, sea: true },
      { name: "파주시", lat: 37.7599, lng: 126.7799 }, { name: "김포시", lat: 37.6152, lng: 126.7156, sea: true },
      { name: "광명시", lat: 37.4786, lng: 126.8645 }, { name: "광주시", lat: 37.4292, lng: 127.2551 },
      { name: "군포시", lat: 37.3617, lng: 126.9352 }, { name: "이천시", lat: 37.2722, lng: 127.435 },
      { name: "양주시", lat: 37.7853, lng: 127.0457 }, { name: "오산시", lat: 37.1499, lng: 127.0775 },
      { name: "구리시", lat: 37.5944, lng: 127.1296 }, { name: "안성시", lat: 37.008, lng: 127.2797 },
      { name: "포천시", lat: 37.895, lng: 127.2003 }, { name: "의왕시", lat: 37.3446, lng: 126.9683 },
      { name: "하남시", lat: 37.5394, lng: 127.2149 }, { name: "여주시", lat: 37.2983, lng: 127.6371 },
      { name: "양평군", lat: 37.4917, lng: 127.4875 }, { name: "동두천시", lat: 37.9036, lng: 127.0606 },
      { name: "과천시", lat: 37.4292, lng: 126.9876 }, { name: "가평군", lat: 37.8315, lng: 127.5095 },
      { name: "연천군", lat: 38.0966, lng: 127.075 },
    ],
  },
  {
    name: "강원특별자치도", lat: 37.8228, lng: 128.1555, sigungu: [
      { name: "춘천시", lat: 37.8813, lng: 127.7298 }, { name: "원주시", lat: 37.3422, lng: 127.9202 },
      { name: "강릉시", lat: 37.7519, lng: 128.8761, sea: true }, { name: "동해시", lat: 37.5247, lng: 129.1143, sea: true },
      { name: "속초시", lat: 38.207, lng: 128.5918, sea: true }, { name: "삼척시", lat: 37.4499, lng: 129.1655, sea: true },
      { name: "태백시", lat: 37.1641, lng: 128.9856 }, { name: "홍천군", lat: 37.6971, lng: 127.8888 },
      { name: "횡성군", lat: 37.4917, lng: 127.985 }, { name: "영월군", lat: 37.1836, lng: 128.4615 },
      { name: "평창군", lat: 37.3705, lng: 128.3902 }, { name: "정선군", lat: 37.3807, lng: 128.6608 },
      { name: "철원군", lat: 38.1466, lng: 127.3134 }, { name: "화천군", lat: 38.1061, lng: 127.708 },
      { name: "양구군", lat: 38.108, lng: 127.9899 }, { name: "인제군", lat: 38.0697, lng: 128.1707 },
      { name: "고성군", lat: 38.3806, lng: 128.4678, sea: true }, { name: "양양군", lat: 38.0754, lng: 128.6191, sea: true },
    ],
  },
  {
    name: "충청북도", lat: 36.6357, lng: 127.4912, sigungu: [
      { name: "청주시", lat: 36.6424, lng: 127.489 }, { name: "충주시", lat: 36.9911, lng: 127.9259 },
      { name: "제천시", lat: 37.1326, lng: 128.191 }, { name: "보은군", lat: 36.4894, lng: 127.7294 },
      { name: "옥천군", lat: 36.3066, lng: 127.5715 }, { name: "영동군", lat: 36.175, lng: 127.7833 },
      { name: "증평군", lat: 36.7853, lng: 127.5814 }, { name: "진천군", lat: 36.8553, lng: 127.4355 },
      { name: "괴산군", lat: 36.8153, lng: 127.7866 }, { name: "음성군", lat: 36.9402, lng: 127.6905 },
      { name: "단양군", lat: 36.9846, lng: 128.3656 },
    ],
  },
  {
    name: "충청남도", lat: 36.5184, lng: 126.8 , sigungu: [
      { name: "천안시", lat: 36.8151, lng: 127.1139 }, { name: "공주시", lat: 36.4466, lng: 127.119 },
      { name: "보령시", lat: 36.3331, lng: 126.6128, sea: true }, { name: "아산시", lat: 36.7898, lng: 127.0019 },
      { name: "서산시", lat: 36.7848, lng: 126.4503, sea: true }, { name: "논산시", lat: 36.1872, lng: 127.0986 },
      { name: "계룡시", lat: 36.2745, lng: 127.2487 }, { name: "당진시", lat: 36.8929, lng: 126.6286, sea: true },
      { name: "금산군", lat: 36.1089, lng: 127.4881 }, { name: "부여군", lat: 36.2756, lng: 126.9098 },
      { name: "서천군", lat: 36.0804, lng: 126.6914, sea: true }, { name: "청양군", lat: 36.4593, lng: 126.802 },
      { name: "홍성군", lat: 36.6014, lng: 126.661, sea: true }, { name: "예산군", lat: 36.6809, lng: 126.8447 },
      { name: "태안군", lat: 36.7456, lng: 126.298, sea: true },
    ],
  },
  {
    name: "전북특별자치도", lat: 35.7175, lng: 127.153, sigungu: [
      { name: "전주시", lat: 35.8242, lng: 127.148 }, { name: "군산시", lat: 35.9676, lng: 126.7367, sea: true },
      { name: "익산시", lat: 35.9483, lng: 126.9577 }, { name: "정읍시", lat: 35.5699, lng: 126.856 },
      { name: "남원시", lat: 35.4164, lng: 127.3905 }, { name: "김제시", lat: 35.8035, lng: 126.8809, sea: true },
      { name: "완주군", lat: 35.9047, lng: 127.162 }, { name: "진안군", lat: 35.7917, lng: 127.4248 },
      { name: "무주군", lat: 36.0068, lng: 127.6608 }, { name: "장수군", lat: 35.6473, lng: 127.5212 },
      { name: "임실군", lat: 35.6177, lng: 127.2889 }, { name: "순창군", lat: 35.3744, lng: 127.1376 },
      { name: "고창군", lat: 35.4358, lng: 126.702, sea: true }, { name: "부안군", lat: 35.7318, lng: 126.7331, sea: true },
    ],
  },
  {
    name: "전라남도", lat: 34.8679, lng: 126.991, sigungu: [
      { name: "목포시", lat: 34.8118, lng: 126.3922, sea: true }, { name: "여수시", lat: 34.7604, lng: 127.6622, sea: true },
      { name: "순천시", lat: 34.9506, lng: 127.4872 }, { name: "나주시", lat: 35.0157, lng: 126.7108 },
      { name: "광양시", lat: 34.9407, lng: 127.6959, sea: true }, { name: "담양군", lat: 35.3211, lng: 126.988 },
      { name: "곡성군", lat: 35.282, lng: 127.292 }, { name: "구례군", lat: 35.2024, lng: 127.4628 },
      { name: "고흥군", lat: 34.6111, lng: 127.2849, sea: true }, { name: "보성군", lat: 34.7714, lng: 127.08, sea: true },
      { name: "화순군", lat: 35.0645, lng: 126.9866 }, { name: "장흥군", lat: 34.6816, lng: 126.907, sea: true },
      { name: "강진군", lat: 34.6421, lng: 126.7672, sea: true }, { name: "해남군", lat: 34.5734, lng: 126.5988, sea: true },
      { name: "영암군", lat: 34.8 , lng: 126.6967, sea: true }, { name: "무안군", lat: 34.9904, lng: 126.4817, sea: true },
      { name: "함평군", lat: 35.0658, lng: 126.5169, sea: true }, { name: "영광군", lat: 35.2772, lng: 126.512, sea: true },
      { name: "장성군", lat: 35.302, lng: 126.7849 }, { name: "완도군", lat: 34.3111, lng: 126.755, sea: true },
      { name: "진도군", lat: 34.4868, lng: 126.2634, sea: true }, { name: "신안군", lat: 34.8336, lng: 126.3515, sea: true },
    ],
  },
  {
    name: "경상북도", lat: 36.4919, lng: 128.8889, sigungu: [
      { name: "포항시", lat: 36.019, lng: 129.3435, sea: true }, { name: "경주시", lat: 35.8562, lng: 129.2247, sea: true },
      { name: "김천시", lat: 36.1398, lng: 128.1136 }, { name: "안동시", lat: 36.5684, lng: 128.7294 },
      { name: "구미시", lat: 36.1196, lng: 128.3445 }, { name: "영주시", lat: 36.8056, lng: 128.624 },
      { name: "영천시", lat: 35.9733, lng: 128.9386 }, { name: "상주시", lat: 36.4109, lng: 128.1591 },
      { name: "문경시", lat: 36.5866, lng: 128.1867 }, { name: "경산시", lat: 35.825, lng: 128.7415 },
      { name: "의성군", lat: 36.3527, lng: 128.697 }, { name: "청송군", lat: 36.4361, lng: 129.057 },
      { name: "영양군", lat: 36.6667, lng: 129.1124 }, { name: "영덕군", lat: 36.415, lng: 129.3656, sea: true },
      { name: "청도군", lat: 35.6473, lng: 128.7339 }, { name: "고령군", lat: 35.7259, lng: 128.2628 },
      { name: "성주군", lat: 35.9192, lng: 128.2829 }, { name: "칠곡군", lat: 35.9956, lng: 128.4015 },
      { name: "예천군", lat: 36.658, lng: 128.4527 }, { name: "봉화군", lat: 36.8932, lng: 128.7325 },
      { name: "울진군", lat: 36.993, lng: 129.4 , sea: true }, { name: "울릉군", lat: 37.4844, lng: 130.9057, sea: true },
    ],
  },
  {
    name: "경상남도", lat: 35.4606, lng: 128.2132, sigungu: [
      { name: "창원시", lat: 35.2281, lng: 128.6811, sea: true }, { name: "진주시", lat: 35.18, lng: 128.1076 },
      { name: "통영시", lat: 34.8544, lng: 128.4331, sea: true }, { name: "사천시", lat: 35.0035, lng: 128.0642, sea: true },
      { name: "김해시", lat: 35.2285, lng: 128.8894 }, { name: "밀양시", lat: 35.5037, lng: 128.7466 },
      { name: "거제시", lat: 34.8806, lng: 128.6211, sea: true }, { name: "양산시", lat: 35.335, lng: 129.0378 },
      { name: "의령군", lat: 35.3222, lng: 128.2616 }, { name: "함안군", lat: 35.2725, lng: 128.4065 },
      { name: "창녕군", lat: 35.5444, lng: 128.4922 }, { name: "고성군", lat: 34.9729, lng: 128.3224, sea: true },
      { name: "남해군", lat: 34.8377, lng: 127.8924, sea: true }, { name: "하동군", lat: 35.0672, lng: 127.7513, sea: true },
      { name: "산청군", lat: 35.4156, lng: 127.8736 }, { name: "함양군", lat: 35.5205, lng: 127.7251 },
      { name: "거창군", lat: 35.6868, lng: 127.9094 }, { name: "합천군", lat: 35.5666, lng: 128.1659 },
    ],
  },
  {
    name: "제주특별자치도", lat: 33.4996, lng: 126.5312, sigungu: [
      { name: "제주시", lat: 33.4996, lng: 126.5312, sea: true }, { name: "서귀포시", lat: 33.2541, lng: 126.5601, sea: true },
    ],
  },
];

export type SpotType = "RESERVOIR" | "LAKE" | "RIVER" | "BREAKWATER" | "ROCK" | "BEACH";
export const SPOT_TYPE_LABEL: Record<SpotType, string> = {
  RESERVOIR: "저수지", LAKE: "호·댐", RIVER: "강·하천",
  BREAKWATER: "방파제", ROCK: "갯바위", BEACH: "해변",
};
export const SPOT_WATER: Record<SpotType, "민물" | "바다"> = {
  RESERVOIR: "민물", LAKE: "민물", RIVER: "민물", BREAKWATER: "바다", ROCK: "바다", BEACH: "바다",
};

export type NamedSpot = { name: string; type: SpotType; lat: number; lng: number };

// 시군구별 유명 포인트(있으면 우선 노출) — key: `${sido}|${sigungu}`
const OVERRIDES: Record<string, NamedSpot[]> = {
  "경상북도|안동시": [{ name: "안동호", type: "LAKE", lat: 36.566, lng: 128.78 }, { name: "임하호", type: "LAKE", lat: 36.541, lng: 128.86 }],
  "충청북도|충주시": [{ name: "충주호", type: "LAKE", lat: 36.997, lng: 128.06 }, { name: "탄금호", type: "LAKE", lat: 37.01, lng: 127.9 }],
  "충청북도|제천시": [{ name: "청풍호(충주호)", type: "LAKE", lat: 37.04, lng: 128.18 }],
  "강원특별자치도|춘천시": [{ name: "소양호", type: "LAKE", lat: 37.95, lng: 127.82 }, { name: "의암호", type: "LAKE", lat: 37.86, lng: 127.7 }],
  "경기도|가평군": [{ name: "청평호", type: "LAKE", lat: 37.74, lng: 127.42 }],
  "경기도|남양주시": [{ name: "팔당호", type: "LAKE", lat: 37.55, lng: 127.25 }],
  "경기도|양평군": [{ name: "남한강(양평)", type: "RIVER", lat: 37.49, lng: 127.49 }],
  "충청남도|예산군": [{ name: "예당저수지", type: "RESERVOIR", lat: 36.62, lng: 126.78 }],
  "충청남도|청양군": [{ name: "예당저수지(청양)", type: "RESERVOIR", lat: 36.55, lng: 126.83 }],
  "충청남도|서산시": [{ name: "간월호", type: "RESERVOIR", lat: 36.69, lng: 126.39, }, { name: "삼길포방파제", type: "BREAKWATER", lat: 36.99, lng: 126.5 }],
  "충청남도|보령시": [{ name: "대천방파제", type: "BREAKWATER", lat: 36.31, lng: 126.5 }, { name: "대천해수욕장", type: "BEACH", lat: 36.317, lng: 126.51 }],
  "충청남도|태안군": [{ name: "안흥방파제", type: "BREAKWATER", lat: 36.67, lng: 126.13 }, { name: "신두리해변", type: "BEACH", lat: 36.82, lng: 126.18 }],
  "전북특별자치도|군산시": [{ name: "군산외항방파제", type: "BREAKWATER", lat: 35.98, lng: 126.62 }, { name: "비응항방파제", type: "BREAKWATER", lat: 35.94, lng: 126.52 }],
  "전북특별자치도|부안군": [{ name: "격포방파제", type: "BREAKWATER", lat: 35.62, lng: 126.46 }, { name: "변산해수욕장", type: "BEACH", lat: 35.66, lng: 126.5 }],
  "전라남도|여수시": [{ name: "여수신항방파제", type: "BREAKWATER", lat: 34.74, lng: 127.74 }, { name: "돌산갯바위", type: "ROCK", lat: 34.66, lng: 127.78 }, { name: "안포방파제", type: "BREAKWATER", lat: 34.62, lng: 127.72 }],
  "경상남도|통영시": [{ name: "통영항방파제", type: "BREAKWATER", lat: 34.84, lng: 128.42 }, { name: "사량도갯바위", type: "ROCK", lat: 34.82, lng: 128.22 }],
  "경상남도|거제시": [{ name: "지세포방파제", type: "BREAKWATER", lat: 34.85, lng: 128.71 }, { name: "구조라해변", type: "BEACH", lat: 34.82, lng: 128.7 }],
  "경상북도|포항시": [{ name: "구룡포방파제", type: "BREAKWATER", lat: 35.99, lng: 129.55 }, { name: "호미곶갯바위", type: "ROCK", lat: 36.08, lng: 129.57 }],
  "강원특별자치도|속초시": [{ name: "속초항방파제", type: "BREAKWATER", lat: 38.21, lng: 128.6 }, { name: "속초해변", type: "BEACH", lat: 38.19, lng: 128.6 }],
  "강원특별자치도|강릉시": [{ name: "사천방파제", type: "BREAKWATER", lat: 37.83, lng: 128.88 }, { name: "경포해변", type: "BEACH", lat: 37.8, lng: 128.9 }],
  "부산광역시|기장군": [{ name: "대변항방파제", type: "BREAKWATER", lat: 35.24, lng: 129.22 }, { name: "학리갯바위", type: "ROCK", lat: 35.27, lng: 129.24 }],
  "부산광역시|사하구": [{ name: "다대포방파제", type: "BREAKWATER", lat: 35.05, lng: 128.97 }],
  "제주특별자치도|제주시": [{ name: "이호테우방파제", type: "BREAKWATER", lat: 33.5, lng: 126.45 }, { name: "용담갯바위", type: "ROCK", lat: 33.51, lng: 126.5 }],
  "제주특별자치도|서귀포시": [{ name: "서귀포항방파제", type: "BREAKWATER", lat: 33.24, lng: 126.56 }, { name: "사계갯바위", type: "ROCK", lat: 33.22, lng: 126.31 }],
  "대전광역시|대덕구": [{ name: "대청호(대전)", type: "LAKE", lat: 36.48, lng: 127.49 }],
  "충청북도|청주시": [{ name: "대청호(문의)", type: "LAKE", lat: 36.48, lng: 127.49 }],
  "경상남도|창원시": [{ name: "주남저수지", type: "RESERVOIR", lat: 35.31, lng: 128.68 }, { name: "마산방파제", type: "BREAKWATER", lat: 35.2, lng: 128.57 }],
  "서울특별시|광진구": [{ name: "한강(뚝섬)", type: "RIVER", lat: 37.53, lng: 127.07 }],
  "서울특별시|송파구": [{ name: "한강(잠실)", type: "RIVER", lat: 37.52, lng: 127.09 }],
};

// 결정적 의사난수 (좌표 기반)
function seeded(n: number) { const x = Math.sin(n) * 10000; return x - Math.floor(x); }

// 시군구에 대한 명소형 포인트 후보 생성 (override 우선 + 유형별 합성)
export function genSpots(sidoName: string, sg: Sigungu): NamedSpot[] {
  const key = `${sidoName}|${sg.name}`;
  const out: NamedSpot[] = [...(OVERRIDES[key] || [])];
  const base = sg.name.replace(/(시|군|구)$/, "");
  const off = (i: number, axis: number) => (seeded(sg.lat * 100 + sg.lng + i * 7 + axis * 3) - 0.5) * 0.04;
  const push = (name: string, type: SpotType, i: number) => {
    if (out.some((s) => s.name === name)) return;
    out.push({ name, type, lat: sg.lat + off(i, 0), lng: sg.lng + off(i, 1) + (sg.sea ? 0.02 : 0) });
  };
  if (sg.sea) {
    push(`${base} 방파제`, "BREAKWATER", 1);
    push(`${base} 갯바위`, "ROCK", 2);
    push(`${base} 해변`, "BEACH", 3);
  } else {
    push(`${base} 저수지`, "RESERVOIR", 1);
    push(`${base}천`, "RIVER", 2);
    push(`${base} 수로`, "RESERVOIR", 3);
  }
  return out.slice(0, 5);
}

export function findSido(name: string) {
  return KOREA_REGIONS.find((s) => s.name === name) || null;
}
export function findSigungu(sidoName: string, sgName: string) {
  const sido = findSido(sidoName);
  return sido?.sigungu.find((g) => g.name === sgName) || null;
}
