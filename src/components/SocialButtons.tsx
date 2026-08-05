"use client";
import { useToast } from "@/components/Toast";

// 카카오/네이버/Google 로그인
// 네이버: /api/auth/naver 로 이동하면 OAuth 플로우 시작
// 카카오: 추후 연동 예정
const PROVIDERS = [
  { key: "kakao", label: "카카오로 시작하기", bg: "#FEE500", color: "#191919", href: null },
  { key: "naver", label: "네이버로 시작하기", bg: "#03C75A", color: "#ffffff", href: "/api/auth/naver" },
];

export function SocialButtons() {
  const toast = useToast();
  return (
    <div>
      {PROVIDERS.map((p) => (
        <button
          key={p.key}
          onClick={() => {
            if (p.href) {
              window.location.href = p.href;
            } else {
              toast(`${p.label.split("로")[0]} 로그인은 추후 연동 예정입니다`, "info");
            }
          }}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-[16px] py-3 text-[15px] font-semibold transition-transform active:scale-[0.97]"
          style={{ background: p.bg, color: p.color }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
