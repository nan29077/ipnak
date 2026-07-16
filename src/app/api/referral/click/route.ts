import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { recordReferralClick } from "@/lib/referral";

// 피싱태그 클릭 추적 + (MOCK 시) 구매 전환 시뮬레이션 → 작성자 리퍼럴 적립
export async function POST(req: Request) {
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
