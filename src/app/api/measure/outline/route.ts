export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAiCredentials } from "@/lib/aiCredentials";
import { requireUser } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * AI 정밀 윤곽 추출
 * - 스캔 성공 직후 캡처 프레임을 받아 물고기 정밀 외곽선(20~24점)과 볼 위치를 반환한다.
 * - 기존 scan API(gpt-4.1-mini + 색상 기반 FishContourDetector)보다 정밀한 폴리곤을 목표로 한다.
 * - 실패 시 { ok:false } 반환 → 클라이언트는 기존 FishContourDetector 결과를 유지한다.
 */

const SYSTEM_PROMPT =
  "You are a precise image segmentation assistant for a Korean fishing measurement app called 입낚. " +
  "Your task is to trace the exact outline of a fish and locate the yellow reference ball in fishing photos. " +
  "Return polygon points that closely follow the actual fish body boundary, including all fins. " +
  "All coordinates must be normalized to [0, 1] where x is relative to image width, y to image height. " +
  "Respond with ONLY a single JSON object and no other text.";

const USER_PROMPT = `Analyze this fishing photo and return a precise fish outline polygon and ball circle.

Return JSON with this exact shape:
{
  "contour": [{"x": number, "y": number}, ...],
  "ball": {"x": number, "y": number, "r": number}
}

Rules for "contour":
- Return 20-24 points tracing the COMPLETE fish outline CLOCKWISE
- Start from the fish snout/mouth tip and go clockwise around the entire fish body
- Include: snout, forehead, dorsal fin peak, tail fin tips (upper & lower), belly curve, pectoral fin area
- Points must closely hug the actual fish/fin edges — NOT a rough bounding box
- All coordinate values MUST be strictly within [0, 1]
- x is normalized to image WIDTH, y to image HEIGHT

Rules for "ball":
- x, y = center of the deep yellow (golden, #eab308) reference ball, normalized
- r = radius of the ball normalized to image WIDTH (not diameter)
- The ball has the 입낚 fishing-hook logo on it

Return ONLY the JSON object, no other text.`;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export async function POST(req: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  // 분당 20회 제한 — 스캔 성공마다 1회 호출, 정상 사용에서도 충분하다
  if (!rateLimit(`outline:${ip}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  const imageBase64: string = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  if (!imageBase64 || !imageBase64.startsWith("data:image")) {
    return NextResponse.json({ ok: false, reason: "no-image" }, { status: 400 });
  }
  if (imageBase64.length > 8 * 1024 * 1024) {
    return NextResponse.json({ ok: false, reason: "image-too-large" }, { status: 413 });
  }

  const { openai } = await getAiCredentials();
  if (!openai) {
    return NextResponse.json({ ok: false, reason: "no-ai-key" });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openai}` },
      body: JSON.stringify({
        model: process.env.OPENAI_OUTLINE_MODEL || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: imageBase64, detail: "high" } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: "api-error" });
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

    // 윤곽 검증 — 최소 8점 이상이어야 의미있는 폴리곤
    const rawContour = parsed?.contour;
    if (!Array.isArray(rawContour) || rawContour.length < 8) {
      return NextResponse.json({ ok: false, reason: "no-contour" });
    }

    const contour = rawContour
      .map((p: any) => {
        const x = num(p?.x);
        const y = num(p?.y);
        if (x == null || y == null) return null;
        return { x: clamp01(x), y: clamp01(y) };
      })
      .filter(Boolean) as { x: number; y: number }[];

    if (contour.length < 8) {
      return NextResponse.json({ ok: false, reason: "invalid-contour" });
    }

    // 볼 위치 (선택 — 실패해도 윤곽만 반환)
    const bx = num(parsed?.ball?.x);
    const by = num(parsed?.ball?.y);
    const br = num(parsed?.ball?.r);
    const ball =
      bx != null && by != null && br != null && br > 0
        ? { x: clamp01(bx), y: clamp01(by), r: clamp01(br) }
        : null;

    return NextResponse.json({ ok: true, contour, ball });
  } catch (e: any) {
    const reason = e?.name === "TimeoutError" ? "timeout" : "exception";
    return NextResponse.json({ ok: false, reason });
  }
}
