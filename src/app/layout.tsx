import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { ToastProvider } from "@/components/Toast";
import { RecordingProvider } from "@/components/RecordingProvider";
import { getCurrentUser } from "@/lib/auth";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { AppShell } from "@/components/AppShell";
import { AppSettingsProvider } from "@/lib/appSettingsContext";

const SHARE_TITLE = "입낚 — 낚시인의 모든 순간을 기록하다";
const SHARE_DESCRIPTION = "조황 기록, 피싱포인트, 스마트 계측, 낚시 커뮤니티를 입낚에서 한 번에 만나보세요.";
const SHARE_IMAGE = "/og-ipnak-share-v3.png";

// 카카오톡 등 외부 크롤러가 개발 미리보기 주소에서도 이미지를 찾을 수 있도록
// 현재 요청 호스트를 기준으로 OG 이미지와 공유 URL을 절대경로로 만든다.
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = headers();
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const forwardedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") || (forwardedHost?.includes("localhost") ? "http" : "https");
  const siteUrl = configuredUrl || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "https://ipnak.com");
  const metadataBase = new URL(siteUrl);
  const imageUrl = new URL(SHARE_IMAGE, metadataBase).toString();

  return {
    metadataBase,
    title: { default: SHARE_TITLE, template: "%s | 입낚" },
    description: SHARE_DESCRIPTION,
    keywords: ["입낚", "낚시", "낚시 커뮤니티", "조황", "피싱 포인트", "낚시 대회", "낚시 예약"],
    icons: { icon: "/favicon-ipnak.png", apple: "/favicon-ipnak.png", shortcut: "/favicon-ipnak.png" },
    alternates: { canonical: metadataBase },
    openGraph: {
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
      url: metadataBase,
      type: "website",
      siteName: "입낚",
      locale: "ko_KR",
      images: [{ url: imageUrl, width: 1730, height: 909, alt: "입낚 — 낚시인의 모든 순간을 기록하다", type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
      images: [imageUrl],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale: 1 제거 — iOS Safari에서 스크롤·당겨서새로고침 차단하는 원인
  // 입력 필드 포커스 시 자동 확대는 globals.css input font-size:16px 으로 방지
  themeColor: "#161616",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [shopEnabled, bassOnlyMode, reservationEnabled, walkingFeedEnabled, pointsEnabledSetting] = await Promise.all([
    getBoolSetting("shop_menu_enabled"),
    getBoolSetting("bass_only_mode"),
    getBoolSetting("reservation_enabled"),
    getBoolSetting("walking_feed_enabled"),
    getBoolSetting("points_enabled"),
  ]);
  // 관리자 설정값이 없으면 AppShell의 로컬 배스 앵글러 배경을 사용한다.
  const pcMarginBg =
    (await getSetting("pcMarginBgImage")) || undefined;
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased font-sans">
        <ToastProvider>
          <RecordingProvider>
            <AppSettingsProvider value={{ bassOnlyMode, reservationEnabled, shopMenuEnabled: shopEnabled, walkingFeedEnabled, pointsEnabled: pointsEnabledSetting }}>
              <AppShell user={user} shopEnabled={shopEnabled} reservationEnabled={reservationEnabled} pointsEnabled={pointsEnabledSetting} pcMarginBg={pcMarginBg}>{children}</AppShell>
            </AppSettingsProvider>
          </RecordingProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
