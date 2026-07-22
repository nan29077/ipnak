import "server-only";
import crypto from "crypto";
import { getSettings } from "@/lib/settings";

const KEY_PREFIX = "ai_connection_";
const key = crypto.createHash("sha256").update(process.env.SESSION_SECRET || "ipnak-local-ai-key").digest();

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
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
