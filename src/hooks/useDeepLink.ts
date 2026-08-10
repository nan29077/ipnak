"use client";
/**
 * 딥링크 처리 훅
 *
 * 지원 링크 형태
 * - 커스텀 스킴:  ipnak://ball/BALL-0001,  ipnak://post/abc123
 * - 유니버설 링크: https://ipnak.com/ball/BALL-0001  (Android App Links / iOS Universal Links)
 * - NFC 태그 URL: https://ipnak.kr/ball?id=BALL-000001, https://ipnak.kr/keyring?id=KRING-000001
 *   (쿼리스트링은 경로와 함께 그대로 넘겨 /ball 라우트가 처리한다)
 *
 * 동작
 * - 앱 실행 중 링크가 열리면 @capacitor/app 의 appUrlOpen 이벤트를 받아 경로를 파싱하고
 *   router.push() 로 앱 내 화면으로 이동한다.
 * - 앱이 죽어 있다가 링크로 실행된 경우도 getLaunchUrl() 로 처리한다.
 * - 웹에서는 아무것도 하지 않는다 (브라우저가 이미 해당 URL 을 열었기 때문).
 *
 * 사용 예 (한 곳에서만 마운트할 것 — 보통 AppShell 또는 layout)
 *   useDeepLink();
 *   useDeepLink({ onLink: (path) => console.log(path) });   // 직접 처리하고 싶을 때
 */
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isNativeRuntime, importApp } from "@/lib/capacitorPlugins";

/** 앱에서 허용하는 커스텀 스킴 */
const APP_SCHEME = "ipnak://";
/**
 * 유니버설 링크 호스트 화이트리스트 — 외부 도메인으로 이동하지 않도록 검증
 * (NFC 태그 URL 이 ipnak.kr 도메인을 쓰므로 함께 허용한다)
 */
const ALLOWED_HOSTS = ["ipnak.com", "www.ipnak.com", "ipnak.kr", "www.ipnak.kr"];

/**
 * 딥링크 URL 을 앱 내부 경로("/ball/XXX")로 변환한다.
 * 허용되지 않은 호스트거나 형식이 이상하면 null.
 */
export function parseDeepLink(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // 1) 커스텀 스킴: ipnak://ball/BALL-0001  →  /ball/BALL-0001
  if (trimmed.toLowerCase().startsWith(APP_SCHEME)) {
    const rest = trimmed.slice(APP_SCHEME.length);
    if (!rest) return "/home";
    // 스킴 뒤 첫 세그먼트가 host 로 파싱되는 것을 피하려고 직접 붙인다
    const path = rest.startsWith("/") ? rest : `/${rest}`;
    // 오픈 리다이렉트 방지 — "//" 나 "http" 로 시작하는 경로는 거부
    if (path.startsWith("//")) return null;
    return path;
  }

  // 2) 유니버설 링크: https://ipnak.com/ball/BALL-0001
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!ALLOWED_HOSTS.includes(u.hostname.toLowerCase())) return null;
    const path = `${u.pathname}${u.search}${u.hash}`;
    return path && path !== "/" ? path : "/home";
  } catch {
    return null;
  }
}

type Options = {
  /** 직접 처리하고 싶을 때 — 지정하면 자동 router.push 를 하지 않는다 */
  onLink?: (path: string, rawUrl: string) => void;
  enabled?: boolean;
};

export function useDeepLink(options: Options = {}) {
  const { enabled = true, onLink } = options;
  const router = useRouter();

  const onLinkRef = useRef(onLink);
  onLinkRef.current = onLink;
  /** 같은 URL 이 중복 처리되는 것을 막는다 */
  const lastUrlRef = useRef<string | null>(null);

  const handleUrl = useCallback(
    (rawUrl: string) => {
      if (!rawUrl || rawUrl === lastUrlRef.current) return;
      lastUrlRef.current = rawUrl;
      const path = parseDeepLink(rawUrl);
      if (!path) return;
      if (onLinkRef.current) onLinkRef.current(path, rawUrl);
      else router.push(path);
    },
    [router]
  );

  useEffect(() => {
    if (!enabled || !isNativeRuntime()) return;

    let cancelled = false;
    let remove: (() => void) | null = null;

    (async () => {
      const { App } = await importApp();
      if (!App || cancelled) return;

      // 앱이 실행 중일 때 열린 링크
      try {
        const handle = await App.addListener("appUrlOpen", (event: { url: string }) => {
          handleUrl(event?.url ?? "");
        });
        remove = () => {
          try {
            void handle.remove();
          } catch {
            /* noop */
          }
        };
      } catch {
        /* noop */
      }

      // 링크로 앱이 처음 실행된 경우
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url && !cancelled) handleUrl(launch.url);
      } catch {
        /* noop */
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [enabled, handleUrl]);

  return { isSupported: isNativeRuntime(), parseDeepLink };
}
