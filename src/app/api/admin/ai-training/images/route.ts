import { NextResponse } from "next/server";
import { listRawImages, requireSuperAdmin } from "@/lib/aiTraining";

export const dynamic = "force-dynamic";

/**
 * 학습 원본 이미지 목록
 * GET /api/admin/ai-training/images?filter=all|labeled|unlabeled&page=1
 *
 * 라벨링 탭의 이미지 목록에 사용한다.
 */
const PAGE_SIZE = 60;

export async function GET(req: Request) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") ?? "all";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const all = await listRawImages();
    const filtered =
      filter === "labeled" ? all.filter((i) => i.labeled)
      : filter === "unlabeled" ? all.filter((i) => !i.labeled)
      : all;

    const total = filtered.length;
    const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts: {
        all: all.length,
        labeled: all.filter((i) => i.labeled).length,
        unlabeled: all.filter((i) => !i.labeled).length,
      },
    });
  } catch {
    // 디렉터리 접근 실패·DB 오류 등 — 라벨링 탭이 HTML 500 을 파싱하다 깨지지 않도록 JSON 으로 응답
    return NextResponse.json({ error: "이미지 목록을 불러오지 못했어요." }, { status: 500 });
  }
}
