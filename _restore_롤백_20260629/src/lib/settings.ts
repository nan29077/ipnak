import "server-only";
import { prisma } from "./prisma";

// 사이트 운영 설정 기본값
export const SETTING_DEFAULTS: Record<string, string> = {
  shop_menu_enabled: "true", // true: 쇼핑 노출 / false: 중고피싱 노출
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
