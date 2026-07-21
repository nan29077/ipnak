import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { awardPostReward } from "@/lib/points";

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));

// 새 형태(b.productTags: {productId,posX,posY}[]) 우선, 없으면 기존 productIds 자동 배치로 폴백
function buildProductTags(b: any) {
  if (Array.isArray(b.productTags) && b.productTags.length) {
    return {
      create: b.productTags
        .filter((t: any) => t && t.productId)
        .map((t: any) => ({ productId: t.productId, posX: clamp01(t.posX), posY: clamp01(t.posY) })),
    };
  }
  if (Array.isArray(b.productIds) && b.productIds.length) {
    return { create: b.productIds.map((pid: string, i: number) => ({ productId: pid, posX: 0.3 + (i % 3) * 0.2, posY: 0.4 })) };
  }
  return undefined;
}

export async function POST(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "LOG" ? "LOG" : b.kind === "WALKING" ? "WALKING" : "FEED";

  // LOG·WALKING은 사진 없이도 가능. 피싱 피드(FEED)는 사진이 없으면 더미 1장 보강.
  const rawImages: string[] = Array.isArray(b.images) ? b.images.filter(Boolean) : [];
  const images: string[] = rawImages.length
    ? rawImages
    : kind === "FEED"
      ? [`https://picsum.photos/seed/post-${Date.now()}/800/800`]
      : [];

  if (kind === "LOG" && !String(b.title || "").trim()) {
    return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }

  const altText = b.title || b.caption || "낚시 사진";
  // 신규 스키마 필드(kind/title/body/boardCategory) 포함 — 빌드 시 prisma generate 이후 타입 일치
  const data: any = {
    authorId: user.id, postType: b.postType || "GENERAL", kind,
    title: b.title || null, body: b.body || null,
    boardCategory: kind === "LOG" ? (b.boardCategory || "FREE") : null,
    caption: b.caption || null,
    speciesName: b.speciesName || null, fishingType: b.fishingType || null,
    categoryPath: b.categoryPath || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
    region: b.region || null, lat: b.lat ?? null, lng: b.lng ?? null,
    visibility: b.visibility || "PUBLIC", hashtags: b.hashtags ? JSON.stringify(b.hashtags) : null,
    images: images.length ? { create: images.map((url: string, i: number) => ({ url, alt: altText, order: i })) } : undefined,
    productTags: buildProductTags(b),
  };
  try {
    const post = await prisma.post.create({ data });
    // 피드 글 작성 적립 (하루 5회 한도, 포인트 제도 ON 일 때만) — 실패해도 글 작성은 성공 처리
    const earned = await awardPostReward(user.id, post.id);
    return NextResponse.json({ ok: true, id: post.id, pointsEarned: earned ?? 0 });
  } catch (e) {
    // prisma db push 전: kind/title/body/boardCategory 컬럼·필드 미존재
    if (kind === "LOG") {
      return NextResponse.json({ error: "조행기는 DB 업데이트가 필요합니다. 터미널에서 npm run db:push 실행 후 다시 시도해주세요." }, { status: 503 });
    }
    const { kind: _k, title: _t, body: _b, boardCategory: _bc, ...legacy } = data;
    const post = await prisma.post.create({ data: legacy });
    const earned = await awardPostReward(user.id, post.id);
    return NextResponse.json({ ok: true, id: post.id, pointsEarned: earned ?? 0 });
  }
}
