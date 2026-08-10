import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 입낚 Capacitor 앱 설정
 *
 * 앱 패키징 방식: Live URL (서버 기반)
 * - 입낚은 서버 인증(Session)과 API Routes를 사용하므로 정적 빌드 불가
 * - Capacitor WebView가 프로덕션 서버 URL을 직접 로드하는 방식으로 동작
 * - 모든 API 호출, 인증, 데이터는 서버에서 처리됨
 *
 * 패키징 준비 순서:
 * 1. npm install (아래 플러그인은 package.json 에 이미 포함됨)
 *    @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
 *    @capacitor/status-bar @capacitor/splash-screen @capacitor/app
 *    @capacitor/push-notifications @capacitor/local-notifications
 *    @capacitor/camera @capacitor/haptics @capacitor/geolocation
 *    @capacitor/share @capacitor/network
 *    (선택) @capacitor-community/nfc, @capacitor-community/background-geolocation
 * 2. npx cap add android
 * 3. npx cap add ios
 * 4. PROD_URL 을 실제 프로덕션 도메인으로 교체
 * 5. npx cap sync
 * 6. Android: npx cap open android  →  Android Studio에서 빌드
 * 7. iOS: npx cap open ios  →  Xcode에서 빌드 (NFC 엔타이틀먼트 필요, 아래 참고)
 *
 * iOS Xcode 추가 설정:
 * - Signing & Capabilities → "+ Capability" → "Near Field Communication Tag Reading" 추가
 * - Info.plist 에 NFCReaderUsageDescription 추가 (아래 값 참고)
 *   <key>NFCReaderUsageDescription</key>
 *   <string>입낚볼 NFC 태그를 읽어 볼을 등록합니다.</string>
 *
 * Android AndroidManifest.xml 추가 설정:
 * - android/app/src/main/AndroidManifest.xml 에 아래 추가
 *   <uses-permission android:name="android.permission.NFC" />
 *   <uses-feature android:name="android.hardware.nfc" android:required="false" />
 */

const PROD_URL = "https://ipnak.com"; // ← 실제 도메인으로 교체

const config: CapacitorConfig = {
  appId: "com.ipnak.app",
  appName: "입낚",
  webDir: "out", // next build 결과물 (서버 모드에서는 사용 안 되지만 Capacitor 필수값)
  server: {
    // 프로덕션 서버 URL — WebView가 이 주소를 로드함
    url: PROD_URL,
    // 개발 중 로컬 서버를 쓸 때는 아래 주석 해제 (배포 전 반드시 PROD_URL로 원복)
    // url: "http://192.168.x.x:3000",  // 로컬 IP:포트
    cleartext: false, // HTTPS 사용 시 false
    androidScheme: "https",
  },
  plugins: {
    // NFC 플러그인 설정
    NFC: {
      // iOS: NDEF 메시지 형식으로 볼 ID를 읽음
      // Android: Web NFC(NDEFReader) 또는 플러그인 중 NfcService가 자동 선택
    },
    // 앱 내 브라우저 설정 (링크 처리)
    Browser: {
      presentationStyle: "popover",
    },
    // 상태바 — 앱 본문 배경(#0d1b2a, layout.tsx viewport.themeColor 와 동일)에 맞춰
    // 다크 배경 + 밝은 아이콘(style: "Dark")으로 고정한다.
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d1b2a",
      overlaysWebView: false,
    },
    // 스플래시 스크린 — 네이티브 리소스(android/ios 의 splash)를 사용한다.
    // launchAutoHide: false 로 두고 앱 첫 화면 렌더 후 hideSplash() 로 직접 감춘다
    // (Live URL 방식이라 서버 응답까지 흰 화면이 보이는 것을 막는다).
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: "#0d1b2a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    // 푸시 알림 — 앱 실행 시 배지/사운드/알림 표시
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // 로컬 알림 — 물때 타이머 등 예약 알림용
    // smallIcon: android/app/src/main/res/drawable/ic_stat_ipnak.png (흰색 실루엣 + 투명 배경)
    // ※ 해당 drawable 이 없으면 안드로이드 기본 정보 아이콘으로 폴백된다 (크래시 없음)
    LocalNotifications: {
      smallIcon: "ic_stat_ipnak",
      iconColor: "#eab308",
    },
  },
  android: {
    // 딥링크 처리
    // - https://ipnak.com|ipnak.kr /ball, /keyring  (NFC 태그 URL·QR 공용)
    // - NFC 태그는 https://ipnak.kr/ball?id=BALL-000001 형식으로 기록한다
    intentFilters: [
      {
        action: "android.intent.action.VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "ipnak.com", pathPrefix: "/ball" },
          { scheme: "https", host: "ipnak.com", pathPrefix: "/keyring" },
          { scheme: "https", host: "ipnak.kr", pathPrefix: "/ball" },
          { scheme: "https", host: "ipnak.kr", pathPrefix: "/keyring" },
        ],
        categories: [
          "android.intent.category.DEFAULT",
          "android.intent.category.BROWSABLE",
        ],
      },
    ],
  },
  ios: {
    // 딥링크 처리: Universal Links (Associated Domains 엔타이틀먼트 필요)
    // Xcode → Signing & Capabilities → Associated Domains →
    //   applinks:ipnak.com, applinks:ipnak.kr 추가 (태그 URL 도메인 포함)
    scheme: "ipnak",
    // 화면 회전: 세로 고정
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
