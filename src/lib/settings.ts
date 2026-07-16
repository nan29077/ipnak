import "server-only";
import { prisma } from "./prisma";

// 사이트 운영 설정 기본값
export const SETTING_DEFAULTS: Record<string, string> = {
  shop_menu_enabled: "true", // true: 쇼핑 노출 / false: 중고피싱 노출
  // PC(데스크톱 ≥1024px) 좌우 여백 배경 이미지. 이미지 URL 또는 업로드 Data URL.
  // 비어 있으면 기본 바다 낚시 사진(Unsplash)으로 폴백한다.
  pcMarginBgImage: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920&q=80",
  // 배스낚시 전용 모드: true 이면 앱 전체에서 배스 관련 콘텐츠만 표시
  bass_only_mode: "false",
  // 예약 기능 활성화: false 이면 예약 메뉴 진입 시 "서비스 준비 중" 페이지 표시
  reservation_enabled: "true",
};

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  return row?.value ?? SETTING_DEFAULTS[key] ?? "";
}

export async function getBoolSetting(key: string): Promise<boolean> {
  return (await getSetting(key)) === "true";
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } }).catch(() => []);
  const map: Record<string, string> = {};
  for (const k of keys) map[k] = SETTING_DEFAULTS[k] ?? "";
  for (const r of rows) map[r.key] = r.value;
  return map;
}
