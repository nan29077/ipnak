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
export function downloadBlobViaAnchor(blob: Blob, fileName: string): void {
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

/** 터치 기반 모바일 기기인지 — 데스크톱에서는 항상 파일 다운로드를 쓴다 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "")) return true;
  // iPadOS 13+ 는 데스크톱 Safari 로 위장한다 → 터치 포인트로 구분
  return (
    /Macintosh/i.test(navigator.userAgent || "") &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

/** Blob 을 PNG File 로 감싼다 (공유 시트에 넘길 때 파일명·MIME 이 필요하다) */
export function blobToPngFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

/**
 * 이 기기에서 "사진에 저장"(파일 공유 시트)을 쓸 수 있는지.
 * 데스크톱은 공유 시트 대신 항상 a[download] 를 쓴다.
 */
export function canShareImageFile(file: File): boolean {
  if (typeof navigator === "undefined") return false;
  if (!isMobileDevice()) return false;
  if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export type ShareImageResult = "shared" | "cancelled" | "unsupported";

/**
 * 이미지 파일을 OS 공유 시트로 넘긴다 (iOS "사진에 추가" → 카메라롤 저장).
 *
 * ⚠ 반드시 사용자 탭 핸들러에서 "await 없이" 곧바로 호출해야 한다.
 *   html2canvas 같은 비동기 작업을 먼저 기다리면 iOS 의 제스처 컨텍스트가 만료돼
 *   navigator.share() 가 NotAllowedError 로 거부된다.
 *   (그래서 캡처 → 미리보기 모달 → 모달 버튼 탭(새 제스처) → 이 함수 순서로 쓴다)
 */
export async function shareImageFile(file: File, title: string): Promise<ShareImageResult> {
  if (!canShareImageFile(file)) return "unsupported";
  try {
    // 이 await 앞에는 비동기 작업이 없어야 한다 — share() 호출 자체는 동기적으로 일어난다.
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (e) {
    // 사용자가 공유 시트를 닫은 경우 — 실패가 아니다.
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/** 파일명에 쓸 수 없는 문자를 정리한다 */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "ipnak";
}
