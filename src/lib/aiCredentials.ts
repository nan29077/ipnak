import "server-only";
import crypto from "crypto";
import { getSettings } from "@/lib/settings";

const KEY_PREFIX = "ai_connection_";

// 암호화 키는 SESSION_SECRET 환경변수에서만 파생한다.
// 운영에서 미설정이면 사용 시점에 에러 — 빌드는 막지 않도록 지연 평가한다.
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

export function aiSettingKey(name: "openai" | "naverClientId" | "naverClientSecret") {
  return `${KEY_PREFIX}${name}`;
}

export function protectAiCredential(value: string) { return encrypt(value.trim()); }

export async function getAiCredentials() {
  const saved = await getSettings([
    aiSettingKey("openai"), aiSettingKey("naverClientId"), aiSettingKey("naverClientSecret"),
  ]);
  return {
    openai: decrypt(saved[aiSettingKey("openai")]) || process.env.OPENAI_API_KEY || "",
    naverClientId: decrypt(saved[aiSettingKey("naverClientId")]) || process.env.NAVER_SEARCH_CLIENT_ID || "",
    naverClientSecret: decrypt(saved[aiSettingKey("naverClientSecret")]) || process.env.NAVER_SEARCH_CLIENT_SECRET || "",
  };
}

export async function getAiConnectionStatus() {
  const credentials = await getAiCredentials();
  return {
    openaiConfigured: Boolean(credentials.openai),
    naverConfigured: Boolean(credentials.naverClientId && credentials.naverClientSecret),
  };
}
