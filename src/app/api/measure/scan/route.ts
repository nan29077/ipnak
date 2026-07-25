export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAiCredentials } from "@/lib/aiCredentials";

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
  "The 입낚볼 is a deep yellow circle with the 입낚 fishing-hook logo printed on it. It may appear as a 3D physical ball or as a flat printed paper circle. " +
  "Locate the yellow reference circle, the tip of the fish's mouth/head, and the tip of the tail fin, and judge the fish's pose. " +
  "Respond with ONLY a single JSON object and no other text.";

const USER_PROMPT = `Analyze the image and return JSON with this exact shape:
{
  "ballFound": boolean,        // true only if the deep yellow 40mm 입낚 reference circle (physical ball or printed logo) is clearly and fully visible
  "ball": { "x": number, "y": number, "r": number },  // ball center (normalized) and radius (normalized to image WIDTH)
  "fishFound": boolean,        // true only if a whole fish is visible
  "head": { "x": number, "y": number },  // tip of the fish mouth/head, normalized
  "tail": { "x": number, "y": number },  // tip of the tail fin, normalized
  "pose": "flat" | "held" | "unknown",   // "flat" = fish lying on its side flat on the ground; "held" = held up / standing / angled; "unknown" if unclear
  "confidence": number         // 0.0~1.0 overall confidence that ball + head + tail are correctly located AND the fish lies flat
}
Rules:
- All coordinates MUST be within 0..1. x is relative to image width, y to image height.
- The reference marker is a DEEP YELLOW circle (golden yellow, NOT orange). It may be a 3D ball or a flat printed paper circle with the 입낚 logo.
- If the yellow reference circle is not clearly visible, set ballFound=false and confidence<=0.3.
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
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: imageBase64, detail: "auto" } },
            ],
          },
        ],
      }),
      // 서버 타임아웃은 클라이언트 12초보다 짧게 — 클라이언트가 깔끔한 실패를 받도록
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return NextResponse.json({ ok: false, reason: "ai-error" });

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
      return NextResponse.json({ ok: false, reason: !ballFound ? "no-ball" : "no-fish" });
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

    return NextResponse.json({
      ok: true,
      ball: { x: clamp01(bx), y: clamp01(by), r: clamp01(br) },
      head,
      tail,
      pose,
      confidence: confidence == null ? 0 : Math.max(0, Math.min(1, confidence)),
    });
  } catch (e: any) {
    // AbortSignal.timeout 포함 모든 예외 → 실패 처리 (수동 폴백)
    const reason = e?.name === "TimeoutError" ? "timeout" : "exception";
    return NextResponse.json({ ok: false, reason });
  }
}
