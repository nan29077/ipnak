import "server-only";
import { randomBytes, randomInt } from "crypto";
import { prisma } from "./prisma";
import { getAiCredentials } from "./aiCredentials";

/**
 * 비밀번호 찾기(휴대폰 인증) 공통 로직.
 *
 * 현재 상태: SMS 발송은 연동되어 있지 않다.
 * 관리자 > 사이트 관리 > "AI API 연결" > 휴대폰 인증(SMS) 탭에서 키를 등록하면
 * isSmsReady()가 true가 되고, 아래 sendResetCodeSms()의 TODO 지점만 채우면
 * 이메일 입력 → 인증번호 발송 → 검증 → 새 비밀번호 설정 흐름이 그대로 동작한다.
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

/** SMS 연동 여부 — 키와 시크릿이 모두 등록돼 있어야 발송 가능으로 본다. */
export async function isSmsReady(): Promise<boolean> {
  const { smsApiKey, smsApiSecret } = await getAiCredentials();
  return Boolean(smsApiKey && smsApiSecret);
}

/**
 * 회원의 휴대폰 번호를 찾는다.
 *
 * 주의: User 모델에는 아직 휴대폰 번호 필드가 없다.
 * 지금은 회원이 남긴 주문의 구매자 연락처를 사용하며, 없으면 null이다.
 * 회원가입에 휴대폰 입력이 추가되면 이 함수만 User.phone을 읽도록 바꾸면 된다.
 */
export async function resolveUserPhone(userId: string): Promise<string | null> {
  const order = await prisma.ballOrder.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { buyerPhone: true },
  }).catch(() => null);
  return order?.buyerPhone?.trim() || null;
}

/**
 * 인증번호 SMS 발송 지점.
 * 지금은 실제 발송을 하지 않고 발송 대상만 기록한다.
 * SMS 서비스(알리고·CoolSMS 등) 연동 시 이 함수 안에서 호출하면 된다.
 */
export async function sendResetCodeSms(phone: string, code: string): Promise<void> {
  const { smsSender } = await getAiCredentials();
  // TODO(SMS 연동): 아래 로그를 실제 발송 API 호출로 교체
  //   await fetch("https://api.coolsms.co.kr/...", { ... 발신번호 smsSender, 수신 phone, 본문 code ... })
  console.info(
    `[비밀번호 찾기] SMS 발송 예정 (미연동) — 발신 ${smsSender || "(미설정)"} → 수신 ${maskPhone(phone)} / 인증번호 ${code}`
  );
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
