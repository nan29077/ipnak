import "server-only";
import crypto from "crypto";
import { getSettings } from "@/lib/settings";

const KEY_PREFIX = "ai_connection_";

// 암호화 키는 SESSION_SECRET 환경변수에서만 파생한다.
let cachedKey: Buffer | null = null;
function secretKey() {
  if (cachedKey) return cachedKey;
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다. 배포 전 반드시 설정하세요.");
    }
    console.warn("[ipnak] SESSION_SECRET 미설정 — 개발용 임시 키를 사용합니다.");
  }
  cachedKey = crypto.createHash("sha256").update(secret || "ipnak-local-ai-key").digest();
  return cachedKey;
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
  } catch { return ""; }
}

/**
 * 외부 연동 자격증명 이름.
 * tideApiKey/weatherApiKey 는 AI 포인트 추천의 해양·기상 보강용 공공 API 키다.
 * (국립해양조사원 조석예보·수온 / 기상청 단기예보) — 없으면 해당 데이터만 비고 추천은 그대로 동작한다.
 * SMS/알림톡 연동은 Aligo로 분리됨 (lib/aligo.ts, Setting 테이블의 aligo_* 키).
 */
export type AiCredentialName =
  | "openai"
  | "naverClientId"
  | "naverClientSecret"
  | "tideApiKey"
  | "weatherApiKey";

export const AI_CREDENTIAL_NAMES: AiCredentialName[] = [
  "openai", "naverClientId", "naverClientSecret",
  "tideApiKey", "weatherApiKey",
];

export function aiSettingKey(name: AiCredentialName) {
  return `${KEY_PREFIX}${name}`;
}

export function protectAiCredential(value: string) { return encrypt(value.trim()); }

export async function getAiCredentials() {
  const saved = await getSettings(AI_CREDENTIAL_NAMES.map(aiSettingKey));
  return {
    openai: decrypt(saved[aiSettingKey("openai")]) || process.env.OPENAI_API_KEY || "",
    naverClientId: decrypt(saved[aiSettingKey("naverClientId")]) || process.env.NAVER_SEARCH_CLIENT_ID || "",
    naverClientSecret: decrypt(saved[aiSettingKey("naverClientSecret")]) || process.env.NAVER_SEARCH_CLIENT_SECRET || "",
    tideApiKey: decrypt(saved[aiSettingKey("tideApiKey")]) || process.env.TIDE_API_KEY || "",
    weatherApiKey: decrypt(saved[aiSettingKey("weatherApiKey")]) || process.env.WEATHER_API_KEY || "",
  };
}

/** 해양·기상 공공 API 키만 따로 조회 (marineData 전용) */
export async function getMarineCredentials() {
  const c = await getAiCredentials();
  return { tideApiKey: c.tideApiKey, weatherApiKey: c.weatherApiKey };
}

export async function getAiConnectionStatus() {
  const credentials = await getAiCredentials();
  return {
    openaiConfigured: Boolean(credentials.openai),
    naverConfigured: Boolean(credentials.naverClientId && credentials.naverClientSecret),
    tideConfigured: Boolean(credentials.tideApiKey),
    weatherConfigured: Boolean(credentials.weatherApiKey),
  };
}
