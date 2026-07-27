/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // lucide-react 아이콘을 사용된 것만 번들에 포함 → 초기 JS 크기 대폭 감소
    optimizePackageImports: ["lucide-react"],
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
