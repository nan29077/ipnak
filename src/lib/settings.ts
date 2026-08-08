import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";

export const PC_MARGIN_BG_DEFAULT = "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 PC화면 여백 이미지-화이트와펜.png";

const LEGACY_PC_MARGIN_BG_DEFAULTS = new Set([
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 PC화면 여백 이미지.png",
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 PC화면 여백 이미지-불곰로고.png",
  "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 PC화면 여백 이미지-v2.png",
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920&q=80",
  "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1920&q=80",
  "/pc-bg-bass-angler.png",
]);

function normalizeSettingValue(key: string, value: string): string {
  if (key === "pcMarginBgImage" && LEGACY_PC_MARGIN_BG_DEFAULTS.has(value)) {
    return PC_MARGIN_BG_DEFAULT;
  }
  return value;
}

// 사이트 운영 설정 기본값
export const SETTING_DEFAULTS: Record<string, string> = {
  shop_menu_enabled: "true", // true: 쇼핑 노출 / false: 중고마켓 노출
  // 쇼핑 태그(피싱태그) 기능: false 이면 글쓰기 태그 피커·태그 노출·리퍼럴 전체 비활성화
  shop_tag_enabled: "true",
  // PC(데스크톱 ≥1024px) 좌우 여백 배경 이미지. 이미지 URL 또는 업로드 Data URL.
  // 비어 있으면 프로젝의 기본 배스 앵글러 이미지로 폴백한다.
  pcMarginBgImage: PC_MARGIN_BG_DEFAULT,
  // 배스낚시 전용 모드: true 이면 앱 전체에서 배스 관련 콘텐츠만 표시
  bass_only_mode: "false",
  // 예약 기능 활성화: false 이면 예약 메뉴 진입 시 "서비스 준비 중" 페이지 표시
  reservation_enabled: "true",
  // 워킹 피드 노출: false 이면 메인 페이지 워킹 피드 영역 숨김
  walking_feed_enabled: "true",
  // 포인트 제도 사용: true 이면 포인트 적립/사용/워킹피드 잠금 등 전체 활성화
  points_enabled: "false",
  // 낚시단 유료 개설: true 이면 낚시단 개설 10,000P·가입 신청 1,000P 차감
  group_points_required: "false",
  // 입낚볼 / 입낚키링 판매 스위치 (구매 바텀시트의 상품 탭 노출 여부).
  // 판매가는 설정이 아니라 IpnakBallProduct.price 를 단일 기준으로 사용한다.
  ipnak_ball_enabled: "true",
  ipnak_keyring_enabled: "false",
  // ===== AI 가상회원 동적 활동 =====
  // 글로벌 스위치(마스터). OFF 면 스케줄러가 완전히 멈추고, 가상회원이 쓴 글·댓글·중고글이
  // 일반 사용자 화면에서 전부 숨는다(삭제가 아니라 조회 시 필터링).
  virtual_member_active: "false",
  // 활동 생성 on/off. 글로벌 스위치가 ON 이고 OpenAI 키가 등록되어 있을 때만 활동을 만든다.
  virtual_member_enabled: "false",
  // 활동 주기(시간). 1~24 사이 값만 허용한다.
  virtual_member_interval_hours: "2",
  // 일일 최대 OpenAI 호출 수. 초과하면 그날은 활동을 건너뛴다.
  virtual_member_daily_limit: "200",
  // 사용 모델 (비용 대비 품질 기준 기본값)
  virtual_member_model: "gpt-4o-mini",
  // 일일 호출 수 집계 (KST 날짜 + 카운트) — 관리자가 직접 수정할 수 없다.
  virtual_member_usage_date: "",
  virtual_member_usage_count: "0",
  // 마지막 실행 시각(ISO) — 관리자 화면 표시용
  virtual_member_last_run: "",
  // 쇼핑 상품 상세페이지 정책 안내
  refund_policy: "상품 수령 후 7일 이내 환불 가능합니다. 단, 사용/훼손된 상품은 환불이 불가합니다.",
  shipping_guide: "주문 후 1-3일 내 발송됩니다. 도서산간 지역은 추가 배송비가 발생할 수 있습니다.",
};

/**
 * 요청 단위 메모이제이션.
 * getSetting 은 한 번의 페이지 렌더/요청에서 수십 번(피드 쿼리 3회 + 각 컴포넌트) 호출되는데,
 * 그때마다 Setting 테이블을 조회하고 있었다. React cache 는 요청이 끝나면 폐기되므로
 * 관리자가 값을 바꾸면 다음 요청부터 즉시 반영된다(값이 굳지 않는다).
 * ⚠️ 같은 요청 안에서 쓰기 후 다시 읽는 경로에는 쓰면 안 된다 —
 *    그런 경로(가상회원 사용량 집계·비밀번호 재설정 코드)는 getSettings / 직접 조회를 쓰므로 영향이 없다.
 */
const readSettingRow = cache(async (key: string) =>
  prisma.setting.findUnique({ where: { key }, select: { value: true } }).catch(() => null),
);

export async function getSetting(key: string): Promise<string> {
  const row = await readSettingRow(key);
  return normalizeSettingValue(key, row?.value ?? SETTING_DEFAULTS[key] ?? "");
}

export async function getBoolSetting(key: string): Promise<boolean> {
  return (await getSetting(key)) === "true";
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } }).catch(() => []);
  const map: Record<string, string> = {};
  for (const k of keys) map[k] = SETTING_DEFAULTS[k] ?? "";
  for (const r of rows) map[r.key] = normalizeSettingValue(r.key, r.value);
  return map;
}
