"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Anchor, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { SocialButtons } from "@/components/SocialButtons";
import { Button } from "@/components/ui";

const FIELD_CLASS =
  "w-full rounded-[16px] px-3.5 py-3 text-[15px] bg-white/[0.06] border border-white/[0.12] text-white placeholder-white/40 outline-none focus:border-aqua-400 focus:ring-2 focus:ring-aqua-400/30";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(em: string, pw: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "로그인 실패");
      toast("로그인 되었습니다", "success");
      router.push(data.role === "SUPER_ADMIN" ? "/admin" : "/");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-end bg-gradient-to-b from-[#0d1626] via-[#161616] to-[#243a63] px-6 pb-8 pt-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/[0.08]">
            <Anchor size={32} className="text-aqua-400" />
          </div>
          <h1 className="mb-1.5 text-[32px] font-extrabold tracking-[-0.02em] text-white">입낚</h1>
          <p className="text-[13px] text-white/45">나만의 낚시 기록을 시작하세요</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); login(email, password); }}
          className="mb-4"
        >
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일" autoComplete="email"
            className={`${FIELD_CLASS} mb-2.5`}
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호" autoComplete="current-password"
            className={FIELD_CLASS}
          />
          <Button
            type="submit" variant="secondary" full disabled={loading}
            className="mb-3 mt-4"
            leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
          >
            로그인
          </Button>
        </form>

        {/* 테스트 계정 빠른 로그인 */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => login("admin@ipnak.test", "Admin1234!")}
            disabled={loading}
            className="rounded-[14px] border border-white/[0.12] bg-white/[0.04] py-2.5 text-[12px] font-semibold text-white/70 outline-none transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            관리자 테스트 로그인
          </button>
          <button
            type="button"
            onClick={() => login("angler@ipnak.test", "Angler1234!")}
            disabled={loading}
            className="rounded-[14px] border border-white/[0.12] bg-white/[0.04] py-2.5 text-[12px] font-semibold text-white/70 outline-none transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            낚시꾼 테스트 로그인
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2.5">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[12px] text-white/30">또는</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <SocialButtons />

        <p className="mt-4 text-center text-[12px] text-white/30">
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="text-aqua-300">회원가입</Link>
        </p>
      </div>
    </div>
  );
}
