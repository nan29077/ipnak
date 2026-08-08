/**
 * Aligo SMS / 알림톡 API 클라이언트
 * SMS: https://apis.aligo.in/send/
 * 알림톡: https://kakaoapi.aligo.in/akv10/alimtalk/send/
 *
 * 설정은 DB Setting 테이블에서 읽어온다:
 *   aligo_api_key      — Aligo API Key
 *   aligo_user_id      — Aligo 사용자 ID
 *   aligo_sender       — 발신 번호 (예: 01012345678)
 *   aligo_sender_key   — 알림톡 발신프로필 키 (카카오 채널 연결 후 발급)
 */

import { prisma } from "@/lib/prisma";

export interface AligoSettings {
  apiKey: string;
  userId: string;
  sender: string;
  senderKey: string; // 알림톡 발신프로필 키
}

/** DB에서 Aligo 설정 읽기 */
export async function getAligoSettings(): Promise<AligoSettings | null> {
  const keys = ["aligo_api_key", "aligo_user_id", "aligo_sender", "aligo_sender_key"];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const apiKey = map["aligo_api_key"] || process.env.ALIGO_API_KEY || "";
  const userId = map["aligo_user_id"] || process.env.ALIGO_USER_ID || "";
  const sender = map["aligo_sender"] || process.env.ALIGO_SENDER || "";
  const senderKey = map["aligo_sender_key"] || process.env.ALIGO_SENDER_KEY || "";

  if (!apiKey || !userId || !sender) return null;
  return { apiKey, userId, sender, senderKey };
}

export interface SMSResult {
  success: boolean;
  message: string;
  resultCode?: string;
}

/**
 * 단문 SMS 발송
 * @param to 수신 번호 (01012345678 형식)
 * @param msg 메시지 내용 (90바이트 이하 = SMS, 초과 시 LMS 자동 전환)
 */
export async function sendSMS(to: string, msg: string): Promise<SMSResult> {
  const settings = await getAligoSettings();
  if (!settings) {
    return { success: false, message: "Aligo 설정이 없습니다. 관리자 페이지에서 설정을 완료하세요." };
  }

  const body = new URLSearchParams({
    key: settings.apiKey,
    user_id: settings.userId,
    sender: settings.sender,
    receiver: to.replace(/-/g, ""),
    msg,
    msg_type: "SMS",
  });

  try {
    const res = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    // result_code: "1" = 성공, 음수 = 실패
    const success = String(data.result_code) === "1";
    return { success, message: data.message || "", resultCode: String(data.result_code) };
  } catch (e: any) {
    return { success: false, message: e.message || "SMS 발송 실패" };
  }
}

export interface AlimtalkTarget {
  phone: string;
  /** 템플릿 변수 치환 (선택) */
  params?: Record<string, string>;
}

export interface AlimtalkResult {
  success: boolean;
  message: string;
  resultCode?: string;
}

/**
 * 카카오 알림톡 발송 (단건 또는 다건)
 * @param targets 수신 대상 목록
 * @param templateCode 카카오 승인 템플릿 코드
 * @param msg 발송 메시지 (템플릿 변수 치환 완료된 텍스트)
 */
export async function sendAlimtalk(
  targets: AlimtalkTarget[],
  templateCode: string,
  msg: string
): Promise<AlimtalkResult> {
  const settings = await getAligoSettings();
  if (!settings) {
    return { success: false, message: "Aligo 설정이 없습니다." };
  }
  if (!settings.senderKey) {
    return { success: false, message: "알림톡 발신프로필 키가 설정되지 않았습니다." };
  }

  // 최대 1000건씩 분할 발송 (Aligo 제한)
  const chunks = chunk(targets, 1000);
  let lastResult: AlimtalkResult = { success: true, message: "발송 완료" };

  for (const group of chunks) {
    const body = new URLSearchParams({
      apikey: settings.apiKey,
      userid: settings.userId,
      senderkey: settings.senderKey,
      tpl_code: templateCode,
    });

    group.forEach((t, i) => {
      body.set(`receiver_${i + 1}`, t.phone.replace(/-/g, ""));
      body.set(`message_${i + 1}`, msg);
      // 실패 시 SMS 대체 발송 (failover)
      body.set(`subject_${i + 1}`, "입낚 알림");
      body.set(`smssender_${i + 1}`, settings.sender);
      body.set(`smsmessage_${i + 1}`, msg);
    });

    try {
      const res = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json();
      const success = String(data.code) === "0";
      lastResult = { success, message: data.message || "", resultCode: String(data.code) };
      if (!success) break;
    } catch (e: any) {
      lastResult = { success: false, message: e.message || "알림톡 발송 실패" };
      break;
    }
  }

  return lastResult;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
