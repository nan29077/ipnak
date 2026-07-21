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
 * 1. npm install @capacitor/core @capacitor/cli @capacitor-community/nfc
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
  },
  android: {
    // 딥링크 처리: ipnak://ball/BALL-ID 형식 URL 스킴
    intentFilters: [
      {
        action: "android.intent.action.VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "ipnak.com",
            pathPrefix: "/ball",
          },
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
    // Xcode → Signing & Capabilities → Associated Domains → applinks:ipnak.com 추가
    scheme: "ipnak",
    // 화면 회전: 세로 고정
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
