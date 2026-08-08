import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { awardPostReward } from "@/lib/points";
import { getBoolSetting } from "@/lib/settings";

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
  const shopTagEnabled = await getBoolSetting("shop_tag_enabled");
  const b = await req.json().catch(() => ({}));
  // 쇼핑 태그 OFF 시: 403 대신 태그만 무효화해 글 작성 자체는 정상 처리
  if (!shopTagEnabled) { b.productTags = []; b.productIds = []; }
  const kind = b.kind === "LOG" ? "LOG" : b.kind === "WALKING" ? "WALKING" : b.kind === "GENERAL" ? "GENERAL" : "FEED";

  // 사진이 없으면 이미지 레코드를 만들지 않고 화면에서 공용 노이미지 에셋을 표시한다.
  const rawImages: string[] = Array.isArray(b.images) ? b.images.filter(Boolean) : [];
  const images: string[] = rawImages;

  if (kind === "LOG" && !String(b.title || "").trim()) {
    return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }

  // 피싱 피드(FEED) / 일상 피드(GENERAL)는 사진 1장 이상 + 내용이 모두 있어야 등록 가능.
  // (조행기 LOG는 제목·본문 기준, 워킹 피드 WALKING은 시스템 자동 생성이라 제외)
  if (kind === "FEED" || kind === "GENERAL") {
    if (!images.length) {
      return NextResponse.json({ error: "사진을 1장 이상 첨부해주세요." }, { status: 400 });
    }
    if (!String(b.caption || "").trim()) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }
  }

  // 일반 회원은 WALKING_FEED / FISHING_POINT 타입을 직접 지정할 수 없다.
  // (워킹 피드는 스마트피싱 기록 종료 시 시스템이 자동 생성, 낚시 포인트도 별도 API에서만 생성)
  const ALLOWED_POST_TYPES = ["GENERAL", "TOURNAMENT"];
  const requestedType = b.postType || "GENERAL";
  if (!ALLOWED_POST_TYPES.includes(requestedType) && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "허용되지 않는 글 종류입니다." }, { status: 400 });
  }

  const altText = b.title || b.caption || "낚시 사진";
  // 신규 스키마 필드(kind/title/body/boardCategory) 포함 — 빌드 시 prisma generate 이후 타입 일치
  const data: any = {
    authorId: user.id, postType: requestedType, kind,
    title: b.title || null, body: b.body || null,
    // 게시판 미지정은 null 로 둔다. "FREE" 는 LOG_CATEGORIES 에 없는 값이라
    // 저장되면 어떤 게시판 탭에도 잡히지 않고 라벨도 "조행기"로 뭉개진다.
    boardCategory: kind === "LOG" ? (b.boardCategory || null) : null,
    caption: b.caption || null,
    speciesName: b.speciesName || null, fishingType: b.fishingType || null,
    categoryPath: b.categoryPath || null, sizeCm: b.sizeCm ? Number(b.sizeCm) : null,
    region: b.region || null, lat: b.lat ?? null, lng: b.lng ?? null,
    // 글쓰기 폼 지역(도 단위)·어종 선택값 (둘 다 선택사항)
    location: b.location || null, fishSpecies: b.fishSpecies || null,
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
    const { kind: _k, title: _t, body: _b, boardCategory: _bc, location: _loc, fishSpecies: _fs, ...legacy } = data;
    try {
      const post = await prisma.post.create({ data: legacy });
      const earned = await awardPostReward(user.id, post.id);
      return NextResponse.json({ ok: true, id: post.id, pointsEarned: earned ?? 0 });
    } catch {
      // 레거시 재시도까지 실패(FK 위반 등) → 원시 500 대신 정돈된 에러 응답
      return NextResponse.json({ error: "글 작성 중 오류가 발생했습니다." }, { status: 500 });
    }
  }
}
