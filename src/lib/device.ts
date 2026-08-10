"use client";
/**
 * 클라이언트 기기 판별 유틸
 *
 * NFC 안내 문구는 iOS / 안드로이드가 서로 달라야 한다.
 * - iOS  : 앱 안에서 NFC 를 직접 읽을 수 없으므로 "볼을 폰에 대고 상단 배너를 탭" 안내
 * - 그 외: 기존 NFC 태그 버튼 흐름 유지
 *
 * SSR 에서는 항상 false 를 돌려준다 (hydration 불일치 방지 — 호출부는 useEffect 안에서 쓴다).
 */
import { getNativePlatform } from "@/lib/capacitorPlugins";

/** 아이폰 / 아이패드 / 아이팟 여부 */
export function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor 앱이면 플랫폼 값을 그대로 신뢰한다.
  if (getNativePlatform() === "ios") return true;

  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ 는 데스크톱 Safari 로 위장한다 → 터치 포인트로 구분
  if (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}
