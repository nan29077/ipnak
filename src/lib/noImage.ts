/** 피드, 중고마켓, 상품 등에서 공통으로 사용하는 이미지 없음 에셋. */
export const NO_IMAGE_SRC = "/ipnak-no-image-hardbait.png";

/** 기존 호출부의 API를 유지하면서 모든 화면에 같은 공용 에셋을 반환한다. */
export function noImageSrc(_id?: string | null): string {
  return NO_IMAGE_SRC;
}
