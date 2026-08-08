/**
 * 앱 버전 정책 API
 * - GET /api/app-version
 *   { minVersion, currentVersion, forceUpdate, storeUrl: { android, ios }, releaseNote }
 *
 * 값은 환경변수로 덮어쓸 수 있어 재배포 없이 조정 가능하다.
 *   APP_MIN_VERSION      — 이 버전보다 낮으면 강제 업데이트
 *   APP_CURRENT_VERSION  — 스토어 최신 버전
 *   APP_ANDROID_STORE_URL / APP_IOS_STORE_URL
 *   APP_RELEASE_NOTE
 */
import { NextResponse } from "next/server";

const DEFAULT_MIN_VERSION = "1.0.0";
const DEFAULT_CURRENT_VERSION = "1.0.0";
const DEFAULT_ANDROID_STORE = "https://play.google.com/store/apps/details?id=com.ipnak.app";
const DEFAULT_IOS_STORE = "https://apps.apple.com/app/id0000000000";

export const dynamic = "force-dynamic";

export async function GET() {
  const minVersion = process.env.APP_MIN_VERSION?.trim() || DEFAULT_MIN_VERSION;
  const currentVersion = process.env.APP_CURRENT_VERSION?.trim() || DEFAULT_CURRENT_VERSION;

  return NextResponse.json(
    {
      /** 이 버전 미만이면 앱 사용 불가 (강제 업데이트) */
      minVersion,
      /** 스토어에 올라간 최신 버전 (권장 업데이트 안내용) */
      currentVersion,
      storeUrl: {
        android: process.env.APP_ANDROID_STORE_URL?.trim() || DEFAULT_ANDROID_STORE,
        ios: process.env.APP_IOS_STORE_URL?.trim() || DEFAULT_IOS_STORE,
      },
      releaseNote: process.env.APP_RELEASE_NOTE?.trim() || "",
    },
    {
      // 앱 실행마다 호출되므로 짧게 캐시한다
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    }
  );
}
