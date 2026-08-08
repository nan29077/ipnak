"use client";
/**
 * 공유 훅 (앱/웹 통합)
 *
 * 우선순위
 * 1) 앱(Capacitor): @capacitor/share → OS 네이티브 공유 시트
 * 2) 웹: navigator.share (모바일 브라우저 공유 시트)
 * 3) 둘 다 안 되면: 클립보드에 링크 복사 (최종 폴백)
 *
 * 반환값으로 어떤 경로가 쓰였는지 알려주므로, 호출부에서
 * "링크가 복사되었습니다" 같은 안내를 구분해서 띄울 수 있다.
 *
 * 사용 예
 *   const { share } = useNativeShare();
 *   const r = await share({ title: "입낚", text: "이 조황 보세요", url: link });
 *   if (r.method === "clipboard") toast("링크를 복사했어요", "success");
 */
import { useCallback } from "react";
import { isNativeRuntime, importShare } from "@/lib/capacitorPlugins";

export type ShareInput = {
  title?: string;
  text?: string;
  url?: string;
  /** 네이티브 공유 시트 제목 (Android) */
  dialogTitle?: string;
};

export type ShareResult = {
  ok: boolean;
  /** 실제로 사용된 경로 */
  method: "native" | "web" | "clipboard" | "none";
  /** 사용자가 공유 시트를 닫은 경우 true */
  cancelled?: boolean;
};

/** 클립보드 복사 — execCommand 폴백까지 포함 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 execCommand 폴백 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 훅 없이도 호출 가능한 공유 함수 */
export async function shareContent(input: ShareInput): Promise<ShareResult> {
  const { title, text, url, dialogTitle } = input;

  // 1) 네이티브 공유 시트
  if (isNativeRuntime()) {
    const { Share } = await importShare();
    if (Share) {
      try {
        await Share.share({
          title,
          text,
          url,
          dialogTitle: dialogTitle ?? title ?? "공유",
        });
        return { ok: true, method: "native" };
      } catch (e) {
        // 사용자가 취소한 경우도 여기로 온다 → 클립보드로 넘기지 않고 종료
        const msg = e instanceof Error ? e.message : "";
        if (/cancel|abort|dismiss/i.test(msg)) {
          return { ok: false, method: "native", cancelled: true };
        }
        // 그 외 오류는 아래 웹/클립보드 폴백으로 진행
      }
    }
  }

  // 2) Web Share API
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return { ok: true, method: "web" };
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "AbortError") return { ok: false, method: "web", cancelled: true };
      // 그 외 오류는 클립보드 폴백
    }
  }

  // 3) 클립보드 복사
  const copied = await copyToClipboard(url || text || title || "");
  return copied ? { ok: true, method: "clipboard" } : { ok: false, method: "none" };
}

export function useNativeShare() {
  const share = useCallback((input: ShareInput) => shareContent(input), []);
  return {
    /** 앱 네이티브 공유 시트를 쓸 수 있는 환경인지 */
    isNativeShare: isNativeRuntime(),
    /** Web Share API 사용 가능 여부 */
    canWebShare:
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    share,
    copyToClipboard,
  };
}
