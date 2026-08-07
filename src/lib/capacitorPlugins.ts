/**
 * Capacitor 네이티브 플러그인 안전 로더
 *
 * 왜 필요한가
 * - 입낚은 하나의 Next.js 코드베이스로 웹과 앱을 동시에 서비스한다.
 *   (capacitor.config.ts 가 Live URL 방식이라 앱 WebView 도 같은 서버 번들을 로드한다)
 * - 따라서 네이티브 플러그인은 "런타임에 앱인지" 판별한 뒤에만 로드해야 하고,
 *   웹에서는 반드시 null 을 돌려주어 기존 웹 동작에 어떤 영향도 주지 않아야 한다.
 *
 * 규칙
 * - 모든 import* 함수는 웹/SSR 에서 { X: null } 을 반환한다 (throw 하지 않는다).
 * - 플러그인 미설치·번들 실패도 catch 로 흡수해 null 을 반환한다.
 * - 호출부는 항상 null 체크 후 사용하고, null 이면 기존 웹 fallback 을 쓴다.
 *
 * 사용 예
 *   const { StatusBar } = await importStatusBar();
 *   if (StatusBar) await StatusBar.setStyle({ style: Style.Dark });
 */

/** 앱(네이티브 WebView) 런타임인지 — 웹/PWA/SSR 에서는 false */
export function isNativeRuntime(): boolean {
  // 앱 전용 빌드 플래그 (.env.app)
  if (process.env.NEXT_PUBLIC_IS_APP === "true") return true;
  if (typeof window === "undefined") return false;
  // Capacitor 로 패키징된 WebView 안에서만 true
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  try {
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** 네이티브 플랫폼 문자열 — "android" | "ios" | "web" */
export function getNativePlatform(): "android" | "ios" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as {
    Capacitor?: { getPlatform?: () => string };
  }).Capacitor;
  try {
    const p = cap?.getPlatform?.();
    if (p === "android" || p === "ios") return p;
  } catch {
    /* noop */
  }
  return "web";
}

/** 앱이 아니면 즉시 null 을 담은 객체를 돌려주기 위한 헬퍼 */
async function loadIfNative<T extends Record<string, unknown>>(
  loader: () => Promise<T>,
  emptyKeys: (keyof T)[]
): Promise<Partial<T>> {
  const empty = Object.fromEntries(emptyKeys.map((k) => [k, null])) as Partial<T>;
  if (!isNativeRuntime()) return empty;
  try {
    return await loader();
  } catch {
    return empty;
  }
}

// ──────────────────────────────────────────────
// UI (상태바 / 스플래시)
// ──────────────────────────────────────────────

export async function importStatusBar() {
  return loadIfNative(() => import("@capacitor/status-bar"), ["StatusBar", "Style"]);
}

export async function importSplashScreen() {
  return loadIfNative(() => import("@capacitor/splash-screen"), ["SplashScreen"]);
}

// ──────────────────────────────────────────────
// 앱 라이프사이클 / 딥링크
// ──────────────────────────────────────────────

export async function importApp() {
  return loadIfNative(() => import("@capacitor/app"), ["App"]);
}

// ──────────────────────────────────────────────
// 알림
// ──────────────────────────────────────────────

export async function importPushNotifications() {
  return loadIfNative(() => import("@capacitor/push-notifications"), ["PushNotifications"]);
}

export async function importLocalNotifications() {
  return loadIfNative(() => import("@capacitor/local-notifications"), ["LocalNotifications"]);
}

// ──────────────────────────────────────────────
// 미디어
// ──────────────────────────────────────────────

export async function importCamera() {
  return loadIfNative(() => import("@capacitor/camera"), [
    "Camera",
    "CameraResultType",
    "CameraSource",
  ]);
}

// ──────────────────────────────────────────────
// 센서 / 위치 / 진동
// ──────────────────────────────────────────────

export async function importGeolocation() {
  return loadIfNative(() => import("@capacitor/geolocation"), ["Geolocation"]);
}

export async function importHaptics() {
  return loadIfNative(() => import("@capacitor/haptics"), [
    "Haptics",
    "ImpactStyle",
    "NotificationType",
  ]);
}

// ──────────────────────────────────────────────
// 공유 / 네트워크
// ──────────────────────────────────────────────

export async function importShare() {
  return loadIfNative(() => import("@capacitor/share"), ["Share"]);
}

export async function importNetwork() {
  return loadIfNative(() => import("@capacitor/network"), ["Network"]);
}

// ──────────────────────────────────────────────
// 선택 설치 플러그인 (미설치 시 자동으로 null)
// ──────────────────────────────────────────────

/**
 * Capacitor 런타임 플러그인 레지스트리에서 플러그인을 꺼낸다.
 *
 * 왜 import 가 아니라 레지스트리인가
 * - @capacitor-community/* 플러그인은 아직 설치하지 않은 선택 항목이다.
 *   npm 패키지를 import 하면 미설치 상태에서 webpack 빌드가 깨진다.
 * - Capacitor 는 네이티브에 설치된 모든 플러그인을 window.Capacitor.Plugins 에
 *   프록시로 등록한다. 레지스트리를 쓰면 JS 래퍼 패키지 없이도 호출할 수 있고
 *   미설치 시에는 그냥 undefined 라서 빌드/런타임 모두 안전하다.
 */
function getRegistryPlugin(name: string): any | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, any> } }).Capacitor;
  return cap?.Plugins?.[name] ?? null;
}

/**
 * NFC — @capacitor-community/nfc (플러그인 이름: "Nfc")
 * 미설치면 null → useNfc 가 Web NFC(NDEFReader) 로 폴백한다.
 */
export async function importNfc(): Promise<{ Nfc: any | null }> {
  if (!isNativeRuntime()) return { Nfc: null };
  return { Nfc: getRegistryPlugin("Nfc") };
}

/**
 * 백그라운드 위치 추적 — @capacitor-community/background-geolocation
 * (플러그인 이름: "BackgroundGeolocation")
 * 미설치면 null → useBackgroundGeolocation 이 @capacitor/geolocation 으로 폴백한다.
 */
export async function importBackgroundGeolocation(): Promise<{ BackgroundGeolocation: any | null }> {
  if (!isNativeRuntime()) return { BackgroundGeolocation: null };
  return { BackgroundGeolocation: getRegistryPlugin("BackgroundGeolocation") };
}
