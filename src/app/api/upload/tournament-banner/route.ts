import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 대회 배너는 파일로 저장하지 않고 base64 data URI 로 돌려준다 (Tournament.bannerImage 에 그대로 저장).
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};
// 브라우저가 MIME 을 비워 보내는 경우가 있어 확장자로도 판별한다.
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); }
  catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  if (user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "파일 파싱에 실패했습니다." }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "이미지 크기가 5MB를 초과합니다." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = ALLOWED[file.type.toLowerCase()] ?? EXT_MIME[ext];
  if (!mime) {
    return NextResponse.json({ error: "jpg, png, webp, gif 형식만 업로드할 수 있습니다." }, { status: 400 });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return NextResponse.json({ url: `data:${mime};base64,${base64}` });
  } catch (e) {
    console.error("Tournament banner encode error:", e);
    return NextResponse.json({ error: "이미지 변환에 실패했습니다." }, { status: 500 });
  }
}
