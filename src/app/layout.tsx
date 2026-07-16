import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { ToastProvider } from "@/components/Toast";
import { RecordingProvider } from "@/components/RecordingProvider";
import { getCurrentUser } from "@/lib/auth";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { AppShell } from "@/components/AppShell";
import { AppSettingsProvider } from "@/lib/appSettingsContext";

export const metadata: Metadata = {
  title: "입낚 — 낚시 커뮤니티",
  description: "GPS 낚시 동선, 스마트 자 계측, 피싱 포인트, 온라인 대회, 예약까지. 입낚.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#161616",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [shopEnabled, bassOnlyMode, reservationEnabled] = await Promise.all([
    getBoolSetting("shop_menu_enabled"),
    getBoolSetting("bass_only_mode"),
    getBoolSetting("reservation_enabled"),
  ]);
  // PC 여백 배경 이미지(관리자 설정값). 없으면 기본 바다 낚시 사진(Unsplash)으로 폴백.
  const pcMarginBg =
    (await getSetting("pcMarginBgImage")) ||
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920&q=80";
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
            <AppSettingsProvider value={{ bassOnlyMode, reservationEnabled }}>
              <AppShell user={user} shopEnabled={shopEnabled} pcMarginBg={pcMarginBg}>{children}</AppShell>
            </AppSettingsProvider>
          </RecordingProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
