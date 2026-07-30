/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // lucide-react 아이콘을 사용된 것만 번들에 포함 → 초기 JS 크기 대폭 감소
    optimizePackageImports: ["lucide-react"],
    // src/instrumentation.ts 의 register() 실행 — 가상회원 활동 스케줄러 기동에 사용
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.pravatar.cc" }
    ]
  }
};
export default nextConfig;
