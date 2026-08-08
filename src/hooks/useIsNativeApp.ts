"use client";

import { useState, useEffect } from "react";

/**
 * 네이티브 앱 환경 감지 훅 (범용)
 *
 * 다음 조건 중 하나라도 true면 네이티브 앱으로 판단:
 * 1. NEXT_PUBLIC_IS_APP=true  — 앱 전용 빌드 시 환경변수로 세팅
 * 2. window.Capacitor?.isNativePlatform() === true  — Capacitor 패키징
 * 3. window.matchMedia('(display-mode: standalone)').matches  — PWA standalone
 * 4. navigator.standalone === true  — iOS Safari PWA (add to home screen)
 */
export function useIsNativeApp(): boolean {
  const [isNativeApp, setIsNativeApp] = useState<boolean>(
    // 빌드 환경변수는 서버/클라이언트 모두에서 즉시 읽을 수 있음
    process.env.NEXT_PUBLIC_IS_APP === "true"
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_IS_APP === "true") {
      setIsNativeApp(true);
      return;
    }

    // Capacitor
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      setIsNativeApp(true);
      return;
    }

    // PWA standalone (Android Chrome, Desktop PWA)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsNativeApp(true);
      return;
    }

    // iOS Safari PWA (add to home screen)
    if ((navigator as unknown as { standalone?: boolean }).standalone === true) {
      setIsNativeApp(true);
      return;
    }
  }, []);

  return isNativeApp;
}
