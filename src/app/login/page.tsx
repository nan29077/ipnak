"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Loader2, Eye, EyeOff, ShieldOff } from "lucide-react";
import { useToast } from "@/components/Toast";
import { SocialButtons } from "@/components/SocialButtons";
import { Button } from "@/components/ui";
import { useAnglerLabel } from "@/lib/appSettingsContext";

/** 활동정지 안내 팝업 */
function SuspendedAlert({ onClose }: { onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-5 backdrop-blur-[3px]">
      <div className="w-full max-w-[320px] overflow-hidden rounded-[24px] shadow-2xl ring-1 ring-red-500/20"
        style={{ background: "linear-gradient(160deg,#1f0d10 0%,#1e1a1e 100%)" }}>
        <div className="h-[3px] w-full bg-gradient-to-r from-red-700/40 via-red-400 to-red-700/40" />
        <div className="flex flex-col items-center px-6 pb-6 pt-7">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-red-500/12 ring-1 ring-red-500/25">
            <ShieldOff size={23} strokeWidth={1.7} className="text-red-400" />
          </div>
          <p className="mt-4 text-center text-[16px] font-bold leading-snug text-white">
            활동이 정지되셨습니다
          </p>
          <p className="mt-2 text-center text-[13px] leading-relaxed text-white/50">
            관리자에게 문의바랍니다.
          </p>
        </div>
        <div className="h-px bg-white/[0.07]" />
        <button
          type="button"
          onClick={onClose}
          className="w-full py-4 text-[14px] font-bold text-red-400 transition-colors active:opacity-70"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}

const FIELD_CLASS =
  "w-full rounded-[16px] px-3.5 py-3 text-[15px] bg-white/[0.06] border border-white/[0.12] text-white placeholder-white/40 outline-none focus:border-aqua-400 focus:ring-2 focus:ring-aqua-400/30 transition-colors";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export default function LoginPage() {
  const router = useRouter();
  const anglerLabel = useAnglerLabel();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [suspendedAlert, setSuspendedAlert] = useState(false);

  // 소셜 로그인 콜백에서 넘어온 에러 안내 (useSearchParams 대신 window 사용 — Suspense 불필요)
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err === "social_email_exists") {
      toast("이미 해당 이메일로 가입된 계정이 있습니다. 일반 로그인을 이용해주세요.", "error");
      window.history.replaceState(null, "", "/login");
    } else if (err === "suspended") {
      setSuspendedAlert(true);
      window.history.replaceState(null, "", "/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(em: string, pw: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw }),
      });
      const data = await res.json();
      if (res.status === 403) { setSuspendedAlert(true); return; }
      if (!res.ok) throw new Error(data.error || "로그인 실패");
      toast("로그인 되었습니다", "success");
      // replace: 로그인 페이지가 뒤로가기 히스토리에 남지 않도록
      router.replace(data.role === "SUPER_ADMIN" ? "/admin" : "/home");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    /* 뷰포트 전체 고정 — 스크롤 없이 항상 중앙 */
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#0d1626] via-[#0d1b2a] to-[#243a63]">
      {suspendedAlert && <SuspendedAlert onClose={() => setSuspendedAlert(false)} />}
      <div className="mx-auto w-full max-w-md px-6 py-10">

        {/* 로고 */}
        <div className="mb-10 text-center">
          <Image
            src="/logo-ipnak-master-transparent-v2.png"
            alt="입낚"
            width={1569}
            height={625}
            priority
            className="mx-auto mb-4 h-[70px] w-auto"
          />
          <p className="text-[13px] text-white/45">나만의 낚시 기록을 시작하세요</p>
        </div>

        {/* 이메일 로그인 폼 */}
        <form
          onSubmit={(e) => { e.preventDefault(); login(email, password); }}
          className="mb-4 space-y-2.5"
        >
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일" autoComplete="email"
            className={FIELD_CLASS}
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호" autoComplete="current-password"
              className={`${FIELD_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          </div>
          <Button
            type="submit" variant="secondary" full disabled={loading}
            className="mt-1"
            leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
          >
            로그인
          </Button>
        </form>

        {/* 테스트 계정 빠른 로그인 — 개발 환경 전용.
            NODE_ENV는 빌드 시점에 상수로 치환되므로 운영 빌드에서는 이 블록과
            테스트 계정 비밀번호가 번들에서 통째로 제거된다. */}
        {!IS_PRODUCTION && (
          <div className="mb-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => login("admin@ipnak.test", "Admin1234!")}
              disabled={loading}
              className="rounded-[14px] border border-white/[0.12] bg-white/[0.04] py-2.5 text-[12px] font-semibold text-white/70 outline-none transition-all active:scale-[0.97] disabled:opacity-50"
            >
              관리자 테스트 로그인
            </button>
            <button
              type="button"
              onClick={() => login("angler@ipnak.test", "Angler1234!")}
              disabled={loading}
              className="rounded-[14px] border border-white/[0.12] bg-white/[0.04] py-2.5 text-[12px] font-semibold text-white/70 outline-none transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {anglerLabel} 테스트 로그인
            </button>
          </div>
        )}

        {/* 구분선 */}
        <div className="mb-5 flex items-center gap-2.5">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[12px] text-white/30">또는 소셜 로그인</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <SocialButtons />

        <p className="mt-6 text-center text-[12px] text-white/30">
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="font-semibold text-aqua-300 hover:text-aqua-200">
            회원가입
          </Link>
        </p>
        <p className="mt-2 text-center text-[12px]">
          <Link href="/forgot-password" className="text-white/30 hover:text-white/60">
            비밀번호를 잊으셨나요?
          </Link>
        </p>
      </div>
    </div>
  );
}
