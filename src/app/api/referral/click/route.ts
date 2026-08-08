import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { recordReferralClick } from "@/lib/referral";
import { getBoolSetting } from "@/lib/settings";

// 피싱태그 클릭 추적 + (MOCK 시) 구매 전환 시뮬레이션 → 작성자 리퍼럴 적립
export async function POST(req: Request) {
  const shopTagEnabled = await getBoolSetting("shop_tag_enabled");
  if (!shopTagEnabled) return NextResponse.json({ error: "쇼핑 태그 기능이 비활성화되어 있습니다." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const postId = String(b.postId || "");
  const productId = String(b.productId || "");
  if (!postId || !productId) return NextResponse.json({ error: "postId/productId 필요" }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  const visitor = await getCurrentUser();
  const result = await recordReferralClick({
    postId, productId, earnerId: post.authorId, visitorId: visitor?.id ?? null,
  });
  return NextResponse.json(result);
}
