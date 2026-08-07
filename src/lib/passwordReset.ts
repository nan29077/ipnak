import "server-only";
import { randomBytes, randomInt } from "crypto";
import { prisma } from "./prisma";
import { sendSMS, getAligoSettings } from "./aligo";

/**
 * 비밀번호 찾기(휴대폰 인증) 공통 로직.
 * SMS 발송은 Aligo를 통해 이루어진다 (lib/aligo.ts).
 * 관리자 > 알림톡 관리 > 설정 탭에서 Aligo API 키를 등록하면 isSmsReady()가 true가 된다.
 */

const KEY_PREFIX = "pwreset_";
export const CODE_TTL_MS = 5 * 60 * 1000; // 인증번호 5분 유효
export const MAX_ATTEMPTS = 3;            // 3회 실패 시 무효화
const TOKEN_TTL_MS = 10 * 60 * 1000;      // 인증 성공 후 새 비밀번호 설정까지 10분

type ResetRecord = {
  code: string;
  userId: string | null;   // 존재하지 않는 이메일도 동일하게 처리하기 위해 null 허용
  expiresAt: number;
  attempts: number;
  token: string | null;    // 인증 성공 시 발급되는 1회용 토큰
  tokenExpiresAt: number;
};

/** 이메일은 소문자로 정규화해 키를 만든다. */
function storeKey(email: string) {
  return `${KEY_PREFIX}${email.trim().toLowerCase()}`;
}

/** SMS 연동 여부 — Aligo API 키가 설정돼 있어야 발송 가능으로 본다. */
export async function isSmsReady(): Promise<boolean> {
  const settings = await getAligoSettings();
  return Boolean(settings);
}

/** 회원의 휴대폰 번호를 찾는다 (User.phone 우선, 없으면 최근 주문 buyerPhone 사용) */
export async function resolveUserPhone(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }).catch(() => null);
  if (user?.phone?.trim()) return user.phone.trim();
  // 폴백: 최근 주문 구매자 연락처
  const order = await prisma.ballOrder.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { buyerPhone: true },
  }).catch(() => null);
  return order?.buyerPhone?.trim() || null;
}

/** 비밀번호 재설정 인증번호 SMS 발송 (Aligo) */
export async function sendResetCodeSms(phone: string, code: string): Promise<void> {
  const result = await sendSMS(phone, `[입낚] 비밀번호 재설정 인증번호: ${code} (5분간 유효)`);
  if (!result.success) {
    console.error(`[비밀번호 찾기] SMS 발송 실패 → ${maskPhone(phone)}: ${result.message}`);
  }
}

/** 로그·화면 노출용 마스킹 (010-****-1234) */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return "***";
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

/** 만료된 인증번호 레코드 정리 — 요청 처리를 막지 않도록 실패는 무시한다. */
export function purgeExpiredResetCodes() {
  const now = Date.now();
  prisma.setting
    .findMany({ where: { key: { startsWith: KEY_PREFIX } } })
    .then(async (rows) => {
      const stale = rows.filter((r) => {
        try {
          const rec = JSON.parse(r.value) as ResetRecord;
          return Math.max(rec.expiresAt, rec.tokenExpiresAt || 0) < now;
        } catch {
          return true; // 파싱 불가 = 손상된 레코드도 정리
        }
      });
      if (stale.length > 0) {
        await prisma.setting.deleteMany({ where: { key: { in: stale.map((r) => r.key) } } });
      }
    })
    .catch(() => {});
}

async function read(email: string): Promise<ResetRecord | null> {
  const row = await prisma.setting.findUnique({ where: { key: storeKey(email) } }).catch(() => null);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as ResetRecord;
  } catch {
    return null;
  }
}

async function write(email: string, rec: ResetRecord) {
  const key = storeKey(email);
  const value = JSON.stringify(rec);
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

async function clear(email: string) {
  await prisma.setting.deleteMany({ where: { key: storeKey(email) } });
}

/**
 * 인증번호를 새로 발급하고 저장한다.
 * userId가 null이면(=가입되지 않은 이메일) 저장만 하고 발송은 하지 않는다.
 * 응답을 동일하게 유지해 이메일 존재 여부가 드러나지 않도록 하기 위함이다.
 */
export async function issueResetCode(email: string, userId: string | null): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await write(email, {
    code,
    userId,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
    token: null,
    tokenExpiresAt: 0,
  });

  if (!userId) return;
  const phone = await resolveUserPhone(userId);
  if (!phone) {
    console.info(`[비밀번호 찾기] 등록된 휴대폰 번호가 없어 발송을 건너뜁니다 (userId=${userId})`);
    return;
  }
  await sendResetCodeSms(phone, code);
}

export type VerifyResult =
  | { ok: true; token: string }
  | { ok: false; reason: "expired" | "mismatch" | "locked" };

/** 인증번호 검증 — 5분 초과 시 만료, 3회 실패 시 무효화 */
export async function verifyResetCode(email: string, code: string): Promise<VerifyResult> {
  const rec = await read(email);
  if (!rec) return { ok: false, reason: "expired" };
  if (rec.expiresAt < Date.now()) {
    await clear(email);
    return { ok: false, reason: "expired" };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    await clear(email);
    return { ok: false, reason: "locked" };
  }

  // 가입되지 않은 이메일도 실패 횟수를 동일하게 소모시켜 응답 차이를 없앤다.
  if (!rec.userId || rec.code !== code) {
    const attempts = rec.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await clear(email);
      return { ok: false, reason: "locked" };
    }
    await write(email, { ...rec, attempts });
    return { ok: false, reason: "mismatch" };
  }

  const token = randomBytes(32).toString("hex");
  await write(email, { ...rec, token, tokenExpiresAt: Date.now() + TOKEN_TTL_MS, attempts: 0 });
  return { ok: true, token };
}

/** 인증 완료 토큰 확인 후 대상 회원 id를 돌려준다. 실패 시 null. */
export async function consumeResetToken(email: string, token: string): Promise<string | null> {
  const rec = await read(email);
  if (!rec || !rec.token || !rec.userId) return null;
  if (rec.tokenExpiresAt < Date.now()) {
    await clear(email);
    return null;
  }
  if (rec.token !== token) return null;
  await clear(email); // 1회용 — 사용 즉시 폐기
  return rec.userId;
}
