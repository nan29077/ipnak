// 이미지가 없는 썸네일 자리에 쓰는 "노이미지" 에셋.
// public/ 의 입낚 전용 플레이스홀더 3종(물고기·바늘·찌)으로, 각 SVG 안에 크림색 배경과
// 점선 테두리가 포함되어 있어 별도 배경을 깔지 않아도 카드 형태로 보인다.
//
// FeedCard / FeedList / CurationHome 이 같은 배열을 각자 들고 있던 것을 여기로 모았다.

export const NO_IMAGE_STICKERS = [
  "/입낚_NoImage_물고기.svg",
  "/입낚_NoImage_바늘.svg",
  "/입낚_NoImage_찌.svg",
] as const;

/**
 * 글 id 로 노이미지 이미지를 하나 고른다.
 * 같은 글이면 항상 같은 이미지가 나오도록 id 전체의 문자 코드 합을 사용한다
 * (목록을 다시 그려도 이미지가 바뀌지 않는다).
 *
 * 첫 글자만 쓰면 안 된다 — Prisma 의 cuid 는 모두 'c'(코드 99)로 시작해서
 * 99 % 3 === 0 이 되어 항상 같은 이미지 하나만 나온다. avatarUtils 의
 * getCharacterAvatar 와 같은 방식으로 id 전체를 합산해 3종이 고르게 섞이게 한다.
 */
export function noImageSrc(id: string | null | undefined): string {
  if (!id) return NO_IMAGE_STICKERS[0];
  const sum = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return NO_IMAGE_STICKERS[sum % NO_IMAGE_STICKERS.length];
}
