export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAiCredentials } from "@/lib/aiCredentials";
import { requireUser } from "@/lib/auth";
import { classifyOpenAiError } from "@/lib/openaiError";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * AI 자동 스캔 계측
 * - 입낚볼(40mm)과 함께 옆으로 눕혀 촬영한 물고기 사진에서
 *   입낚볼 위치 / 물고기 머리·꼬리 끝점 / 자세 / 신뢰도를 추정한다.
 * - 좌표는 모두 정규화(0~1). x는 이미지 폭, y는 이미지 높이, r(반지름)은 이미지 폭 기준.
 * - 실패(입낚볼/물고기 미감지, 파싱 실패, AI 오류, 타임아웃)는 항상 { ok:false } 로 반환.
 *   클라이언트는 어떤 경우에도 수동 모드로 폴백할 수 있어야 한다.
 */

const SYSTEM_PROMPT =
  "You are a precise fish-measurement vision assistant for a Korean fishing app called 입낚. " +
  "In each photo the user places an '입낚볼' — a deep yellow (golden yellow, similar to #eab308) reference ball or printed logo that is exactly 40mm in diameter — next to a fish. " +
  "The 입낚볼 is a deep yellow circle with the '입낚' logo — a fishing-hook-shaped arrow — printed on it. It may appear as a 3D physical ball or as a flat printed paper circle. " +
  "Locate the yellow reference circle, the tip of the fish's mouth/head, the tip of the tail fin, the widest part of the fish body, and judge the fish's pose. " +
  "Respond with ONLY a single JSON object and no other text.";

/** 테스트 모드 전용 시스템 프롬프트 — 주황볼도 기준물로 허용 */
const SYSTEM_PROMPT_TEST =
  "You are a precise fish-measurement vision assistant for a Korean fishing app called 입낚. " +
  "In each photo the user places an '입낚볼' — a reference ball that is exactly 40mm in diameter — next to a fish. " +
  "The 입낚볼 may be DEEP YELLOW (golden yellow, similar to #eab308) OR ORANGE in test mode. " +
  "It may appear as a 3D physical ball or as a flat printed paper circle with the '입낚' logo. " +
  "Locate the reference circle (yellow OR orange), the tip of the fish's mouth/head, the tip of the tail fin, the widest part of the fish body, and judge the fish's pose. " +
  "Respond with ONLY a single JSON object and no other text.";

const USER_PROMPT = `Analyze the image and return JSON with this exact shape:
{
  "ballFound": boolean,        // true only if the deep yellow 40mm 입낚 reference circle (physical ball or printed logo) is clearly and fully visible
  "ball": { "x": number, "y": number, "r": number },  // ball center (normalized) and radius (normalized to image WIDTH)
  "fishFound": boolean,        // true only if a whole fish is visible
  "head": { "x": number, "y": number },  // tip of the fish mouth/head, normalized
  "tail": { "x": number, "y": number },  // tip of the tail fin, normalized
  "widthFound": boolean,       // true only if the fish body outline is clear enough to measure its maximum width
  "bodyTop": { "x": number, "y": number },     // on the widest cross-section of the BODY, the point on one side of the outline, normalized
  "bodyBottom": { "x": number, "y": number },  // the opposite point of that same cross-section, normalized
  "pose": "flat" | "held" | "unknown",   // "flat" = fish lying on its side flat on the ground; "held" = held up / standing / angled; "unknown" if unclear
  "confidence": number         // 0.0~1.0 overall confidence that ball + head + tail are correctly located AND the fish lies flat
}
Rules:
- All coordinates MUST be within 0..1. x is relative to image width, y to image height.
- bodyTop/bodyBottom mark the thickest part of the fish body (usually just behind the head, near the front of the dorsal fin). The segment between them MUST be perpendicular to the head→tail axis and MUST touch the body outline on both sides.
- Measure the BODY only for bodyTop/bodyBottom: exclude the dorsal fin, anal fin, pectoral fins and tail fin.
- If the body outline is blurred, cropped, or hidden (e.g. by a hand), set widthFound=false and omit bodyTop/bodyBottom.
- The reference marker is a DEEP YELLOW circle (golden yellow, NOT orange). It may be a 3D ball or a flat printed paper circle with the fishing-hook-shaped arrow 입낚 logo.
- If the yellow reference circle is not clearly visible, set ballFound=false and confidence<=0.3.
- If no whole fish is visible, set fishFound=false and confidence<=0.3.
- If the fish is held up, standing, or not lying flat on its side, set pose="held" and confidence<=0.5.
- Only set pose="flat" and a high confidence when you are sure the fish lies flat on its side and both endpoints are clear.
Return ONLY the JSON object.`;

/** 테스트 모드 전용 유저 프롬프트 — 주황볼도 기준물로 허용 */
const USER_PROMPT_TEST = `Analyze the image and return JSON with this exact shape:
{
  "ballFound": boolean,        // true only if the 40mm 입낚 reference circle (deep yellow OR orange, physical ball or printed logo) is clearly and fully visible
  "ball": { "x": number, "y": number, "r": number },  // ball center (normalized) and radius (normalized to image WIDTH)
  "fishFound": boolean,        // true only if a whole fish is visible
  "head": { "x": number, "y": number },  // tip of the fish mouth/head, normalized
  "tail": { "x": number, "y": number },  // tip of the tail fin, normalized
  "widthFound": boolean,       // true only if the fish body outline is clear enough to measure its maximum width
  "bodyTop": { "x": number, "y": number },     // on the widest cross-section of the BODY, the point on one side of the outline, normalized
  "bodyBottom": { "x": number, "y": number },  // the opposite point of that same cross-section, normalized
  "pose": "flat" | "held" | "unknown",   // "flat" = fish lying on its side flat on the ground; "held" = held up / standing / angled; "unknown" if unclear
  "confidence": number         // 0.0~1.0 overall confidence that ball + head + tail are correctly located AND the fish lies flat
}
Rules:
- All coordinates MUST be within 0..1. x is relative to image width, y to image height.
- bodyTop/bodyBottom mark the thickest part of the fish body (usually just behind the head, near the front of the dorsal fin). The segment between them MUST be perpendicular to the head→tail axis and MUST touch the body outline on both sides.
- Measure the BODY only for bodyTop/bodyBottom: exclude the dorsal fin, anal fin, pectoral fins and tail fin.
- If the body outline is blurred, cropped, or hidden (e.g. by a hand), set widthFound=false and omit bodyTop/bodyBottom.
- [TEST MODE] The reference marker may be DEEP YELLOW (golden yellow, #eab308) OR ORANGE. Accept both colors as valid 입낚볼.
- If the reference circle is not clearly visible, set ballFound=false and confidence<=0.3.
- If no whole fish is visible, set fishFound=false and confidence<=0.3.
- If the fish is held up, standing, or not lying flat on its side, set pose="held" and confidence<=0.5.
- Only set pose="flat" and a high confidence when you are sure the fish lies flat on its side and both endpoints are clear.
Return ONLY the JSON object.`;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function pt(o: any): { x: number; y: number } | null {
  const x = num(o?.x);
  const y = num(o?.y);
  if (x == null || y == null) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

export async function POST(req: Request) {
  // 외부 AI(OpenAI Vision) 비용이 발생하므로 로그인한 회원만 호출할 수 있다.
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // IP당 분당 30회 제한 — 라이브 스캐너가 2초 간격 폴링(분당 최대 ~30회)이므로 이에 맞춘 상한.
  // (기존 5회 제한은 폴링 6번째부터 전부 429가 되어 기준물 미감지 판정이 불가능했음)
  const ip = getClientIp(req);
  if (!rateLimit(`scan:${ip}`, 30, 60_000)) {
    return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  // 테스트 모드 플래그 — 주황볼도 기준물로 허용 (프로덕션에서는 항상 false)
  const testBall: boolean = body?.testBall === true;

  const imageBase64: string = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  if (!imageBase64 || !imageBase64.startsWith("data:image")) {
    return NextResponse.json({ ok: false, reason: "no-image" }, { status: 400 });
  }
  // 8MB(base64) 초과 이미지는 거부 — OpenAI Vision 전송 전에 차단
  if (imageBase64.length > 8 * 1024 * 1024) {
    return NextResponse.json({ ok: false, reason: "image-too-large" }, { status: 413 });
  }

  const { openai } = await getAiCredentials();
  if (!openai) {
    // AI 키 미설정 — 자동 스캔 불가. 클라이언트는 수동 모드로 폴백.
    return NextResponse.json({ ok: false, reason: "no-ai-key" });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openai}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MEASURE_MODEL || "gpt-4.1-mini",
        temperature: 0,
        max_tokens: 400, // 너비(bodyTop/bodyBottom) 필드 추가분 여유
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: testBall ? SYSTEM_PROMPT_TEST : SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: testBall ? USER_PROMPT_TEST : USER_PROMPT },
              { type: "image_url", image_url: { url: imageBase64, detail: "auto" } },
            ],
          },
        ],
      }),
      // 서버 타임아웃은 클라이언트 12초보다 짧게 — 클라이언트가 깔끔한 실패를 받도록
      signal: AbortSignal.timeout(10000),
    });

    // 크레딧 소진·키 오류 등 원인을 구분해서 내려준다 (클라이언트는 모두 수동 폴백으로 처리).
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: await classifyOpenAiError(res, "measure/scan") });
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

    const ballFound = parsed?.ballFound === true;
    const fishFound = parsed?.fishFound === true;
    if (!ballFound || !fishFound) {
      // ballFound / fishFound 플래그 동봉 — 클라이언트가
      // "아무것도 없음"과 "물고기는 있는데 기준물만 없음"을 구분할 수 있게 한다.
      // (reason 값은 기존 그대로 유지 — measure 페이지 no-ball 분기 호환)
      return NextResponse.json({
        ok: false,
        reason: !ballFound ? "no-ball" : "no-fish",
        ballFound,
        fishFound,
      });
    }

    const bx = num(parsed?.ball?.x);
    const by = num(parsed?.ball?.y);
    const br = num(parsed?.ball?.r);
    const head = pt(parsed?.head);
    const tail = pt(parsed?.tail);
    if (bx == null || by == null || br == null || br <= 0 || !head || !tail) {
      return NextResponse.json({ ok: false, reason: "incomplete" });
    }

    const pose: string =
      parsed?.pose === "flat" || parsed?.pose === "held" ? parsed.pose : "unknown";
    const confidence = num(parsed?.confidence);

    // 몸통 최대 너비 (선택) — 감지 실패해도 길이 측정은 그대로 성공 처리
    const bodyTop = pt(parsed?.bodyTop);
    const bodyBottom = pt(parsed?.bodyBottom);
    const width =
      parsed?.widthFound === true && bodyTop && bodyBottom ? { top: bodyTop, bottom: bodyBottom } : null;

    return NextResponse.json({
      ok: true,
      ball: { x: clamp01(bx), y: clamp01(by), r: clamp01(br) },
      head,
      tail,
      width,
      pose,
      confidence: confidence == null ? 0 : Math.max(0, Math.min(1, confidence)),
    });
  } catch (e: any) {
    // AbortSignal.timeout 포함 모든 예외 → 실패 처리 (수동 폴백)
    const reason = e?.name === "TimeoutError" ? "timeout" : "exception";
    return NextResponse.json({ ok: false, reason });
  }
}
