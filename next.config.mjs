/** @type {import('next').NextConfig} */
const nextConfig = {
  // 같은 저장소에서 dev 서버를 2개 띄우면 .next 를 공유해 서로 빌드 산출물을 덮어쓴다.
  // NEXT_DIST_DIR 를 주면 별도 디렉터리를 쓴다 (미지정 시 기본값 .next — 기존 동작과 동일).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  experimental: {
    // lucide-react 아이콘 / date-fns 함수를 사용된 것만 번들에 포함 → 초기 JS 크기 감소
    optimizePackageImports: ["lucide-react", "date-fns"],
    // src/instrumentation.ts 의 register() 실행 — 가상회원 활동 스케줄러 기동에 사용
    instrumentationHook: true,
  },
  images: {
    // AVIF 우선(WebP 폴백) — 같은 화질에서 전송량이 더 작다
    formats: ["image/avif", "image/webp"],
    // 최적화된 이미지 재사용 기간(초). 기본 60초라 같은 썸네일을 반복 재인코딩한다.
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.pravatar.cc" }
    ]
  }
};
export default nextConfig;
