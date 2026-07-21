import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { ToastProvider } from "@/components/Toast";
import { RecordingProvider } from "@/components/RecordingProvider";
import { getCurrentUser } from "@/lib/auth";
import { getBoolSetting } from "@/lib/settings";
import { AppShell } from "@/components/AppShell";

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
  const shopEnabled = await getBoolSetting("shop_menu_enabled");
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
            <AppShell user={user} shopEnabled={shopEnabled}>{children}</AppShell>
          </RecordingProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
