import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  KEY_COLLECT_HISTORY,
  KEY_FEED_SELECTION,
  RAW_DIR,
  type CollectHistoryItem,
  ensureTrainingDirs,
  extFromUrl,
  readJson,
  requireSuperAdmin,
  saveRawImage,
  writeJson,
} from "@/lib/aiTraining";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, basename } from "path";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 60;

/** URL → raw 폴더에 쓸 안전한 파일명 (중복 판별 가능하도록 해시 기반) */
function fileNameForUrl(url: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  return `feed-${hash}${extFromUrl(url)}`;
}

/**
 * 유저 피드 이미지 목록
 * GET /api/admin/ai-training/feed-images?page=1
 *
 * 공개(PUBLIC) + 미숨김 게시물의 사진만 노출한다.
 * isTrainingCandidate 는 관리자가 선별 저장한 목록(Setting) 기준이다.
 */
export async function GET(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const onlySelected = searchParams.get("selected") === "1";

  const selection = await readJson<string[]>(KEY_FEED_SELECTION, []);
  const selectedSet = new Set(selection);

  const where = {
    post: { hidden: false, visibility: "PUBLIC" },
    ...(onlySelected ? { url: { in: selection.length ? selection : ["__none__"] } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.postImage.findMany({
      where,
      select: {
        id: true,
        url: true,
        postId: true,
        post: {
          select: {
            createdAt: true,
            speciesName: true,
            fishSpecies: true,
            author: { select: { nickname: true } },
          },
        },
      },
      orderBy: { post: { createdAt: "desc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.postImage.count({ where }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    url: r.url,
    postId: r.postId,
    nickname: r.post?.author?.nickname ?? "",
    species: r.post?.speciesName || r.post?.fishSpecies || "",
    createdAt: r.post?.createdAt?.toISOString() ?? "",
    isTrainingCandidate: selectedSet.has(r.url),
    /** 이미 raw 폴더로 복사된 사진인지 */
    imported: existsSync(join(RAW_DIR, fileNameForUrl(r.url))),
  }));

  return NextResponse.json({
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    selectedCount: selection.length,
  });
}

/** 로컬 업로드 경로(/uploads/x.jpg, /api/uploads/x.jpg)를 실제 파일 경로로 바꾼다 */
function localPathFor(url: string): string | null {
  const m = url.match(/^\/(?:api\/)?uploads\/(?:(avatars)\/)?([^/?#]+)$/);
  if (!m) return null;
  const name = basename(m[2]);
  if (!name || name.includes("..")) return null;
  return m[1] === "avatars"
    ? join(process.cwd(), "public", "uploads", "avatars", name)
    : join(process.cwd(), "public", "uploads", name);
}

/** 이미지 1장을 읽어온다 (로컬 파일 또는 원격 URL) */
async function loadImage(url: string): Promise<Buffer | null> {
  try {
    const local = localPathFor(url);
    if (local) {
      if (!existsSync(local)) return null;
      return await readFile(local);
    }
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    // 그 외 public 정적 경로
    if (url.startsWith("/")) {
      const p = join(process.cwd(), "public", url.replace(/^\//, ""));
      if (!p.startsWith(join(process.cwd(), "public"))) return null;
      if (!existsSync(p)) return null;
      return await readFile(p);
    }
  } catch {
    /* 개별 실패는 무시 */
  }
  return null;
}

/**
 * 선별 상태 변경 / 학습 폴더로 복사
 * POST /api/admin/ai-training/feed-images
 *   { action: "select" | "deselect" | "clear", urls: string[] }
 *   { action: "import" }                       — 선별된 사진을 training-data/raw 로 복사
 */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const urls: string[] = Array.isArray(body.urls) ? body.urls.filter((u: any) => typeof u === "string") : [];
  const selection = await readJson<string[]>(KEY_FEED_SELECTION, []);

  if (action === "select" || action === "deselect") {
    if (urls.length === 0) return NextResponse.json({ error: "선택된 사진이 없습니다." }, { status: 400 });
    const set = new Set(selection);
    for (const u of urls) (action === "select" ? set.add(u) : set.delete(u));
    const next = Array.from(set);
    await writeJson(KEY_FEED_SELECTION, next);
    return NextResponse.json({ ok: true, selectedCount: next.length });
  }

  if (action === "clear") {
    await writeJson(KEY_FEED_SELECTION, []);
    return NextResponse.json({ ok: true, selectedCount: 0 });
  }

  if (action === "import") {
    if (selection.length === 0) {
      return NextResponse.json({ error: "선별된 사진이 없습니다." }, { status: 400 });
    }
    await ensureTrainingDirs();
    const startedAt = new Date().toISOString();
    let saved = 0;
    let skipped = 0;
    let failed = 0;

    for (const url of selection) {
      const fileName = fileNameForUrl(url);
      if (existsSync(join(RAW_DIR, fileName))) {
        skipped += 1;
        continue;
      }
      const buf = await loadImage(url);
      if (!buf || buf.length < 512) {
        failed += 1;
        continue;
      }
      const ok = await saveRawImage(fileName, buf);
      if (ok) saved += 1;
      else skipped += 1;
    }

    const history = await readJson<CollectHistoryItem[]>(KEY_COLLECT_HISTORY, []);
    const item: CollectHistoryItem = {
      id: `${Date.now()}`,
      source: "feed",
      keyword: "유저 피드 선별",
      requested: selection.length,
      saved,
      skipped,
      failed,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
    await writeJson(KEY_COLLECT_HISTORY, [item, ...history].slice(0, 50));

    return NextResponse.json({ ok: true, saved, skipped, failed });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
