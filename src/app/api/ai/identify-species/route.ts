export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAiCredentials } from "@/lib/aiCredentials";
import { requireUser } from "@/lib/auth";
import { classifyOpenAiError } from "@/lib/openaiError";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * 어종 자동 인식 (OpenAI Vision)
 * - 계측에 사용한 사진을 그대로 받아 물고기 어종명을 한국어로 추정한다.
 * - imageUrl 은 data URL(base64) 또는 http(s) 이미지 URL 을 받는다.
 * - 실패(키 미설정, AI 오류, 파싱 실패, 타임아웃)는 항상 { ok:false, reason } 으로 반환한다.
 *   호출부는 어떤 경우에도 어종을 직접 선택할 수 있어야 한다. (기존 어종 칩 선택 유지)
 */

const SYSTEM_PROMPT =
  "너는 한국 낚시 앱 '입낚'의 어종 판별 도우미다. 사진 속 물고기의 어종을 한국에서 통용되는 한국어 이름으로 판별한다. " +
  "반드시 JSON 객체 하나만 응답하고 다른 텍스트는 쓰지 않는다.";

const USER_PROMPT = `이 사진에 있는 물고기의 어종명을 한국어로 알려주세요. 어종명만 짧게 답해주세요. 물고기가 없거나 식별이 불가능하면 '불명'이라고 답하세요.

응답은 아래 형태의 JSON 객체 하나로만 작성하세요.
{
  "species": "어종명 (한국어, 10자 이내. 식별 불가면 '불명')",
  "confidence": "high" | "medium" | "low"
}
- confidence 는 판별 확신도입니다. 확실하면 "high", 비슷한 어종과 헷갈리면 "medium", 추측 수준이면 "low".
- species 가 '불명'이면 confidence 는 반드시 "low".
- 설명, 단위, 학명, 마크다운은 넣지 마세요.`;

type Confidence = "high" | "medium" | "low";

/**
 * 이미지 본문 상한 (data URL 문자열 길이 기준 ≈ 4.4MB 원본).
 * 클라이언트는 640px·품질 0.7 축소본(≈100KB)만 보내므로 정상 흐름에서는 걸리지 않는다.
 * 비정상적으로 큰 요청이 OpenAI 호출(=비용)까지 가지 않도록 미리 막는다.
 */
const MAX_IMAGE_CHARS = 6_000_000;

function normalizeConfidence(v: unknown): Confidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

/** 모델이 문장으로 답했을 때를 대비해 어종명만 짧게 정리한다. */
function normalizeSpecies(v: unknown): string {
  if (typeof v !== "string") return "";
  const cleaned = v
    .replace(/["'`*]/g, "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .split(/[\n,·]/)[0]
    .trim();
  return cleaned.slice(0, 20);
}

export async function POST(req: Request) {
  // 외부 AI(OpenAI Vision) 비용이 발생하므로 로그인한 회원만 호출할 수 있다.
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // 계측 1회당 1번 호출되는 흐름이라 계측 스캔(30회/분)보다 낮게 잡는다.
  // 집계는 회원 단위 — 프록시가 x-forwarded-for 를 주지 않는 환경에서는 모든 요청이
  // 같은 "unknown" 버킷에 몰려 회원끼리 서로의 한도를 깎아먹는다.
  const ip = getClientIp(req);
  if (!rateLimit(`species:${userId || ip}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  const imageUrl: string = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
  const isDataUrl = imageUrl.startsWith("data:image");
  const isHttpUrl = /^https?:\/\//i.test(imageUrl);
  if (!imageUrl || (!isDataUrl && !isHttpUrl)) {
    return NextResponse.json({ ok: false, reason: "no-image" }, { status: 400 });
  }
  if (imageUrl.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ ok: false, reason: "image-too-large" }, { status: 413 });
  }

  const { openai } = await getAiCredentials();
  if (!openai) {
    // AI 키 미설정 — 자동 인식 불가. 클라이언트는 안내 문구만 노출한다.
    return NextResponse.json({ ok: false, reason: "no-ai-key" });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openai}` },
      body: JSON.stringify({
        model: process.env.OPENAI_SPECIES_MODEL || "gpt-4o",
        temperature: 0,
        max_tokens: 100,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          },
        ],
      }),
      // 클라이언트 하드 타임아웃(15초)보다 짧게 — 클라이언트가 깔끔한 실패를 받도록
      signal: AbortSignal.timeout(12000),
    });

    // 크레딧 소진·키 오류 등 원인을 구분해서 내려준다 (클라이언트는 모르는 reason 도 실패로 처리).
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: await classifyOpenAiError(res, "identify-species") });
    }

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) return NextResponse.json({ ok: false, reason: "empty" });

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, reason: "parse" });
    }

    const species = normalizeSpecies(parsed?.species);
    if (!species) return NextResponse.json({ ok: false, reason: "parse" });

    const confidence: Confidence = species === "불명" ? "low" : normalizeConfidence(parsed?.confidence);
    return NextResponse.json({ ok: true, species, confidence });
  } catch (e: any) {
    // AbortSignal.timeout 포함 모든 예외 → 실패 처리 (사용자가 직접 어종 선택)
    const reason = e?.name === "TimeoutError" ? "timeout" : "exception";
    return NextResponse.json({ ok: false, reason });
  }
}
