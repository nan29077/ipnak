import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 페이지별 푸터 노출 기본값 (모두 OFF) */
const DEFAULT_FOOTER_VISIBILITY: Record<string, boolean> = {
  home: false,
  feed: false,
  general: false,
  map: false,
  me: true,
  diary: false,
  log: false,
  market: false,
  groups: false,
  tournaments: false,
  catch: false,
  explore: false,
  walking: false,
};

export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "footer_page_visibility" },
    });
    const stored = setting?.value ? JSON.parse(setting.value) : {};
    const visibility = { ...DEFAULT_FOOTER_VISIBILITY, ...stored };
    return NextResponse.json({ visibility });
  } catch {
    return NextResponse.json({ visibility: DEFAULT_FOOTER_VISIBILITY });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if ((user as { role?: string }).role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { visibility } = body as { visibility?: Record<string, boolean> };
  if (!visibility || typeof visibility !== "object") {
    return NextResponse.json({ error: "올바른 형식이 아닙니다." }, { status: 400 });
  }

  await prisma.setting.upsert({
    where: { key: "footer_page_visibility" },
    update: { value: JSON.stringify(visibility) },
    create: { key: "footer_page_visibility", value: JSON.stringify(visibility) },
  });

  return NextResponse.json({ ok: true });
}
