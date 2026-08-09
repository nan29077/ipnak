import { NextResponse } from "next/server";
import { stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * YOLO 모델 배포 여부 확인 (공개)
 * GET /api/models/status  →  { available: boolean, size, updatedAt }
 *
 * AI 카메라가 "YOLO 를 켤지" 판단할 때 쓴다.
 * 모델 파일에 직접 HEAD 를 날리면 모델이 없을 때마다 브라우저 콘솔에 404 가 찍히므로,
 * 항상 200 을 돌려주는 이 라우트로 확인한다.
 *
 * ⚠️ 정적 세그먼트라 같은 폴더의 [filename] 동적 라우트보다 우선 매칭된다.
 */
export async function GET() {
  const filePath = join(process.cwd(), "public", "models", "best.onnx");
  if (!existsSync(filePath)) {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }
  const s = await stat(filePath).catch(() => null);
  return NextResponse.json(
    {
      available: true,
      size: s?.size ?? 0,
      updatedAt: s?.mtime.toISOString() ?? "",
      url: "/api/models/best.onnx",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
