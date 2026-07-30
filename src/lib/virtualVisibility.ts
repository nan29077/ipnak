import { prisma } from "@/lib/prisma";
import { getBoolSetting } from "@/lib/settings";

// AI 가상회원 글로벌 스위치.
//
// setting: virtual_member_active
//   ON  — 동적 활동 스케줄러가 돌고, 가상회원이 쓴 글·댓글·중고글이 일반 화면에 정상 노출된다.
//   OFF — 스케줄러가 완전히 멈추고, 가상회원 콘텐츠가 일반 화면에서 전부 숨는다.
//         데이터는 지우지 않고 조회 시점에 필터링만 한다(스위치를 다시 켜면 그대로 복귀).
//
// 관리자 화면(/admin/virtual)은 스위치와 무관하게 항상 전체를 본다 — 관리 대상이기 때문이다.
//
// 하위 스위치 virtual_member_enabled(활동 생성 on/off)와의 관계:
//   virtual_member_active 가 OFF 면 virtual_member_enabled 값과 상관없이 활동을 만들지 않는다.

export const VIRTUAL_ACTIVE_KEY = "virtual_member_active";

/** 가상회원 글로벌 스위치가 켜져 있는지 */
export async function virtualMembersActive(): Promise<boolean> {
  return getBoolSetting(VIRTUAL_ACTIVE_KEY);
}

/**
 * Prisma where 조각 — 가상회원 작성분을 제외한다.
 * 스위치가 켜져 있으면 빈 객체를 돌려주므로 조건이 추가되지 않는다.
 *
 * @param relation 작성자 관계 필드명. Post/Comment 는 "author", MarketListing 은 "seller".
 */
export async function excludeVirtualWhere(
  relation: "author" | "seller" = "author",
): Promise<Record<string, unknown>> {
  if (await virtualMembersActive()) return {};
  return { [relation]: { virtualMember: { is: null } } };
}

/** 관계 카운트(_count)에 쓸 조각 — 숨김 상태에서는 가상회원이 남긴 것을 세지 않는다. */
export async function excludeVirtualCountWhere(): Promise<
  { where: { author: { virtualMember: { is: null } } } } | true
> {
  if (await virtualMembersActive()) return true;
  return { where: { author: { virtualMember: { is: null } } } };
}

/** 좋아요 카운트용 조각 — Like 의 작성자 관계 필드는 user 다. */
export async function excludeVirtualLikeCountWhere(): Promise<
  { where: { user: { virtualMember: { is: null } } } } | true
> {
  if (await virtualMembersActive()) return true;
  return { where: { user: { virtualMember: { is: null } } } };
}

/**
 * 글 하나가 지금 일반 사용자에게 보여도 되는지.
 * 상세 페이지에서 직접 URL 로 들어오는 경우를 막는다(목록에서만 숨기면 링크로 뚫린다).
 * 본인 글은 스위치와 무관하게 볼 수 있어야 하므로 viewerId 를 함께 받는다.
 */
export async function isVirtualHiddenPost(
  post: { authorId: string } | null | undefined,
  viewerId?: string,
): Promise<boolean> {
  if (!post) return false;
  if (viewerId && post.authorId === viewerId) return false;
  if (await virtualMembersActive()) return false;
  const vm = await prisma.virtualMember
    .findUnique({ where: { userId: post.authorId }, select: { id: true } })
    .catch(() => null);
  return Boolean(vm);
}

/** 중고 판매글이 지금 숨김 대상인지 */
export async function isVirtualHiddenListing(
  listing: { sellerId: string } | null | undefined,
  viewerId?: string,
): Promise<boolean> {
  if (!listing) return false;
  if (viewerId && listing.sellerId === viewerId) return false;
  if (await virtualMembersActive()) return false;
  const vm = await prisma.virtualMember
    .findUnique({ where: { userId: listing.sellerId }, select: { id: true } })
    .catch(() => null);
  return Boolean(vm);
}
