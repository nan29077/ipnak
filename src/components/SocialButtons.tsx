"use client";
import { useToast } from "@/components/Toast";

// 카카오/네이버/Google 로그인 — 추후 OAuth 연동 (현재는 mock/placeholder)
// 연동 포인트: .env.example의 *_CLIENT_ID / *_CLIENT_SECRET 참고
const PROVIDERS = [
  { key: "kakao", label: "카카오로 시작하기", bg: "#FEE500", color: "#191919" },
  { key: "naver", label: "네이버로 시작하기", bg: "#03C75A", color: "#ffffff" },
];

export function SocialButtons() {
  const toast = useToast();
  return (
    <div>
      {PROVIDERS.map((p) => (
        <button
          key={p.key}
          onClick={() => toast(`${p.label.split("로")[0]} 로그인은 추후 연동 예정입니다 (mock)`, "info")}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-[16px] py-3 text-[15px] font-semibold transition-transform active:scale-[0.97]"
          style={{ background: p.bg, color: p.color }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
