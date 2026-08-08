import "server-only";

/**
 * OpenAI 호출 실패 원인 구분.
 *
 * 기존에는 !res.ok 인 모든 응답을 "ai-error" 하나로 뭉뚱그려 반환해서,
 * 운영자가 "키가 잘못됨" / "크레딧 소진" / "모델 접근 불가" 를 구분할 수 없었다.
 * (키는 정상 등록됐는데 결제 잔액이 없어 전부 실패하는 상황이 대표적이다.)
 * 응답 본문의 error.code 를 읽어 원인을 나누고 서버 로그에도 남긴다.
 */
export type OpenAiFailReason = "quota" | "invalid-key" | "model-unavailable" | "ai-error";

/**
 * 실패 응답을 분류하고 서버 콘솔에 원인을 남긴다.
 * ⚠️ API 키 값은 절대 로그에 남기지 않는다 — 상태 코드·에러 코드·메시지만 기록한다.
 *
 * @param res   !res.ok 인 fetch 응답
 * @param where 로그 식별용 호출 지점 (예: "identify-species")
 */
export async function classifyOpenAiError(res: Response, where: string): Promise<OpenAiFailReason> {
  let code = "";
  let message = "";
  try {
    const body = await res.json();
    code = String(body?.error?.code ?? "");
    message = String(body?.error?.message ?? "");
  } catch {
    // 본문이 JSON 이 아니거나 비어 있으면 상태 코드만으로 판단한다.
  }

  const reason: OpenAiFailReason =
    code === "insufficient_quota" || code === "billing_hard_limit_reached"
      ? "quota"
      : res.status === 401 || res.status === 403 || code === "invalid_api_key"
        ? "invalid-key"
        : res.status === 404 || code === "model_not_found"
          ? "model-unavailable"
          : "ai-error";

  console.error(
    `[ipnak] OpenAI 호출 실패 (${where}) status=${res.status} code=${code || "-"} reason=${reason}` +
      (message ? ` :: ${message.slice(0, 200)}` : ""),
  );
  return reason;
}
