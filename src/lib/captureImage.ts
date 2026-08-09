"use client";
/**
 * DOM → PNG 캡처 유틸 (html2canvas)
 *
 * 왜 복제본을 만드나
 * - 기록 화면은 바텀시트의 스크롤 영역 안에 있어서, 있는 그대로 캡처하면
 *   보이는 만큼만 찍히고 아래가 잘린다.
 * - 화면 밖 홀더에 복제본을 붙여 스크롤 클리핑을 없앤 뒤, 그 홀더의
 *   scrollHeight 를 width/height 로 명시해 "전체 길이"를 캡처한다.
 *
 * html2canvas 는 번들 크기가 커서 동적 import 로 필요할 때만 불러온다.
 */

export type CaptureOptions = {
  /** 캡처본에서 제외할 요소 셀렉터 (버튼 등) */
  ignoreSelector?: string;
  /** 캡처 배경색 (투명 PNG 를 피하기 위해 기본값을 시트 배경과 맞춘다) */
  backgroundColor?: string;
  /** 캡처본 바깥 여백(px) */
  padding?: number;
  /** 최대 픽셀 배율 — 기기 DPR 이 3 이상이어도 파일이 과도하게 커지지 않게 제한 */
  maxScale?: number;
};

/** 지정한 요소를 잘림 없이 전부 캡처해 PNG Blob 으로 돌려준다 */
export async function captureElementToPngBlob(
  node: HTMLElement,
  opts: CaptureOptions = {}
): Promise<Blob> {
  const {
    ignoreSelector,
    backgroundColor = "#162538",
    padding = 16,
    maxScale = 2,
  } = opts;

  const html2canvas = (await import("html2canvas")).default;

  const rectWidth = Math.ceil(node.getBoundingClientRect().width) || node.scrollWidth || 360;

  // 화면 밖(왼쪽 바깥) 홀더 — 눈에 보이지 않지만 레이아웃은 정상적으로 잡힌다.
  // opacity/visibility 로 숨기면 html2canvas 가 투명하게 그려버리므로 위치로만 숨긴다.
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = [
    "position:fixed",
    "top:0",
    "left:-99999px",
    "z-index:-1",
    "pointer-events:none",
    `width:${rectWidth}px`,
    `padding:${padding}px`,
    `background:${backgroundColor}`,
    "box-sizing:content-box",
  ].join(";");

  const clone = node.cloneNode(true) as HTMLElement;
  // 복제본은 스크롤 컨테이너 밖에 있으므로 높이 제한을 모두 푼다.
  clone.style.height = "auto";
  clone.style.maxHeight = "none";
  clone.style.overflow = "visible";
  if (ignoreSelector) {
    clone.querySelectorAll(ignoreSelector).forEach((el) => el.remove());
  }
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    // 전체 길이 — 잘림 방지를 위해 scrollHeight 를 그대로 height 옵션에 넘긴다.
    const fullWidth = Math.ceil(holder.scrollWidth);
    const fullHeight = Math.ceil(holder.scrollHeight);

    const canvas = await html2canvas(holder, {
      backgroundColor,
      useCORS: true,
      logging: false,
      scale: Math.min(maxScale, Math.max(1, window.devicePixelRatio || 1)),
      scrollX: 0,
      scrollY: 0,
      width: fullWidth,
      height: fullHeight,
      windowWidth: fullWidth,
      windowHeight: fullHeight,
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
    if (!blob) throw new Error("이미지를 만들지 못했어요.");
    return blob;
  } finally {
    holder.remove();
  }
}

/** a[download] 로 실제 파일을 내려받는다 (PC 등 공유 API 미지원 환경용) */
function saveBlobViaAnchor(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Blob 을 이미지로 저장한다.
 *
 * 모바일(iOS/Android)에서는 a[download] 가 Safari 다운로드 바로만 떨어져서
 * 카메라롤에 바로 담기지 않는다. 파일 공유를 지원하면 공유 시트를 띄워
 * "사진에 저장" 을 고를 수 있게 하고, 미지원 환경(PC 등)에서는 기존
 * a[download] 방식으로 폴백한다.
 */
export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type || "image/png" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: "입낚 피싱 기록" });
      return;
    } catch (e) {
      // 사용자가 공유 시트를 닫은 경우 — 실패가 아니므로 폴백도 하지 않는다.
      if (e instanceof DOMException && e.name === "AbortError") return;
      // 그 외 오류는 아래 a[download] 로 폴백한다.
    }
  }

  saveBlobViaAnchor(blob, fileName);
}

/** 파일명에 쓸 수 없는 문자를 정리한다 */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "ipnak";
}
