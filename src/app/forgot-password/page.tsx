"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowLeft, ShieldAlert, Check, Mail, KeyRound, Lock } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";

const FIELD_CLASS =
  "w-full rounded-[16px] px-3.5 py-3 text-[15px] bg-white/[0.06] border border-white/[0.12] text-white placeholder-white/40 outline-none focus:border-aqua-400 focus:ring-2 focus:ring-aqua-400/30 transition-colors";
/* 회원가입 페이지와 동일한 오류 상태 스타일 */
const FIELD_ERROR = "border-red-500/60 focus:border-red-500 focus:ring-red-500/30";

// 회원가입·비밀번호 변경과 동일한 강도 기준
const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (!PW_REGEX.test(pw)) return "영문, 숫자, 특수문자를 모두 포함해야 합니다.";
  return null;
}

type Step = "email" | "code" | "password" | "done";

/* ── 3단계 진행 표시 ───────────────────────────────────────── */
const STEPS: { key: Step; label: string; icon: typeof Mail }[] = [
  { key: "email", label: "이메일", icon: Mail },
  { key: "code", label: "인증번호", icon: KeyRound },
  { key: "password", label: "비밀번호", icon: Lock },
];

function StepIndicator({ current }: { current: Step }) {
  // done 단계에서는 세 단계 모두 완료로 표시한다
  const activeIndex = current === "done" ? STEPS.length : STEPS.findIndex((s) => s.key === current);

  return (
    <div className="mb-7 flex items-start">
      {STEPS.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {/* 왼쪽 연결선 (첫 단계는 비움) */}
              <span className={`h-px flex-1 ${i === 0 ? "bg-transparent" : done || active ? "bg-aqua-400/50" : "bg-white/10"}`} />
              <span
                aria-current={active ? "step" : undefined}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                  done || active
                    ? "bg-aqua-400 text-navy-900"
                    : "border border-white/[0.12] bg-white/[0.06] text-white/40"
                } ${active ? "ring-4 ring-aqua-400/20" : ""}`}
              >
                {done ? <Check size={16} strokeWidth={3} /> : <Icon size={15} strokeWidth={2.2} />}
              </span>
              {/* 오른쪽 연결선 (마지막 단계는 비움) */}
              <span className={`h-px flex-1 ${i === STEPS.length - 1 ? "bg-transparent" : done ? "bg-aqua-400/50" : "bg-white/10"}`} />
            </div>
            <span
              className={`mt-2 truncate text-[11px] transition-colors ${
                active ? "font-semibold text-white/75" : done ? "text-white/45" : "text-white/30"
              }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  // SMS 미연동일 때 보여줄 안내 (API가 판단해서 내려준다)
  const [smsNotice, setSmsNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const pwError = password ? validatePassword(password) : null;
  const mismatch = Boolean(confirmPassword) && password !== confirmPassword;

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast("이메일을 입력해 주세요.", "error");
    setLoading(true);
    setSmsNotice(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "요청에 실패했습니다.");

      if (data.smsReady === false) {
        setSmsNotice(data.message || "현재 SMS 서비스가 연결되지 않았습니다. 관리자에게 문의해 주세요.");
        return;
      }
      toast(data.message || "인증번호를 보냈습니다.", "success");
      setStep("code");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "요청에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return toast("6자리 인증번호를 입력해 주세요.", "error");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "인증에 실패했습니다.");
      setResetToken(data.resetToken);
      setStep("password");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "인증에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    const err = validatePassword(password);
    if (err) return toast(err, "error");
    if (password !== confirmPassword) return toast("비밀번호가 일치하지 않습니다.", "error");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetToken, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "비밀번호를 변경하지 못했습니다.");
      setStep("done");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "비밀번호를 변경하지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }

  const SUBTITLE: Record<Step, string> = {
    email: "가입 시 등록한 이메일을 입력해 주세요.",
    code: "휴대폰으로 받은 6자리 인증번호를 입력해 주세요.",
    password: "새로 사용할 비밀번호를 입력해 주세요.",
    done: "비밀번호가 안전하게 변경되었습니다.",
  };

  return (
    /* 회원가입 페이지와 동일한 구조 — 배경만 담당하고, 내용이 길어지면 자연스럽게 스크롤된다 */
    <div className="min-h-screen bg-gradient-to-b from-[#0d1626] via-[#0d1b2a] to-[#243a63]">
      <div className="mx-auto w-full max-w-md px-6 pt-10 pb-16">

        {/* 헤더 */}
        <div className="mb-8 text-center">
          <Image
            src="/logo-ipnak-master-transparent-v2.png"
            alt="입낚"
            width={1569}
            height={625}
            priority
            className="mx-auto mb-4 h-[70px] w-auto"
          />
          <h1 className="mb-1 text-[26px] font-extrabold tracking-[-0.02em] text-white">비밀번호 찾기</h1>
          <p className="text-[13px] text-white/45">{SUBTITLE[step]}</p>
        </div>

        <StepIndicator current={step} />

        {/* 1단계 — 이메일 입력 */}
        {step === "email" && (
          <form onSubmit={requestCode} className="space-y-6">
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">계정 확인</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="가입한 이메일"
                autoComplete="email"
                className={FIELD_CLASS}
              />
              <p className="text-[12px] leading-relaxed text-white/30">
                가입 시 등록한 휴대폰으로 인증번호를 보내 드립니다.
              </p>
            </div>

            <Button
              type="submit" variant="secondary" full disabled={loading}
              leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
            >
              인증번호 받기
            </Button>

            {smsNotice && (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-400">
                    <ShieldAlert size={14} strokeWidth={2.2} />
                  </span>
                  <p className="text-[13px] font-bold text-amber-300">SMS 서비스 미연동</p>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-amber-100/70">{smsNotice}</p>
              </div>
            )}
          </form>
        )}

        {/* 2단계 — 인증번호 확인 */}
        {step === "code" && (
          <form onSubmit={verifyCode} className="space-y-6">
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">인증번호 입력</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoComplete="one-time-code"
                className={`${FIELD_CLASS} text-center text-[24px] font-extrabold tracking-[0.35em] placeholder-white/20`}
              />
              <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3">
                <p className="text-[12px] leading-relaxed text-white/45">
                  인증번호는 <span className="font-semibold text-white/70">5분간</span> 유효하며,
                  <span className="font-semibold text-white/70"> 3회</span> 틀리면 무효화됩니다.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <Button
                type="submit" variant="secondary" full disabled={loading || code.length !== 6}
                leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
              >
                인증 확인
              </Button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); }}
                className="w-full py-1 text-center text-[12px] text-white/30 transition-colors hover:text-white/60"
              >
                이메일 다시 입력하기
              </button>
            </div>
          </form>
        )}

        {/* 3단계 — 새 비밀번호 */}
        {step === "password" && (
          <form onSubmit={submitPassword} className="space-y-6">
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">새 비밀번호</p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="새 비밀번호 (영문+숫자+특수문자, 8자 이상)"
                autoComplete="new-password"
                className={`${FIELD_CLASS} ${pwError ? FIELD_ERROR : ""}`}
              />
              {pwError && <p className="text-[12px] text-red-400">{pwError}</p>}
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
                className={`${FIELD_CLASS} ${mismatch ? FIELD_ERROR : ""}`}
              />
              {mismatch && <p className="text-[12px] text-red-400">비밀번호가 일치하지 않습니다.</p>}
            </div>

            <Button
              type="submit" variant="secondary" full
              disabled={loading || Boolean(pwError) || mismatch || !password || !confirmPassword}
              leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
            >
              비밀번호 변경
            </Button>
          </form>
        )}

        {/* 완료 */}
        {step === "done" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-aqua-400/25 bg-aqua-400/[0.08] p-5 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-aqua-400 text-navy-900">
                <Check size={24} strokeWidth={3} />
              </span>
              <p className="text-[15px] font-bold text-white">비밀번호가 변경되었습니다</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/45">
                보안을 위해 기존 로그인은 모두 해제되었습니다.
                <br />새 비밀번호로 다시 로그인해 주세요.
              </p>
            </div>
            <Button variant="secondary" full onClick={() => router.replace("/login")}>
              로그인하러 가기
            </Button>
          </div>
        )}

        {/* 구분선 — 로그인/회원가입 페이지와 동일 */}
        <div className="my-5 flex items-center gap-2.5">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[12px] text-white/30">도움이 필요하신가요?</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <p className="text-center text-[12px] text-white/30">
          계정이 기억나셨나요?{" "}
          <Link href="/login" className="font-semibold text-aqua-300 hover:text-aqua-200">
            로그인
          </Link>
        </p>
        <p className="mt-2 text-center text-[12px]">
          <Link href="/signup" className="text-white/30 transition-colors hover:text-white/60">
            아직 계정이 없으신가요? 회원가입
          </Link>
        </p>

        <p className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/25 transition-colors hover:text-white/50"
          >
            <ArrowLeft size={13} /> 로그인으로 돌아가기
          </Link>
        </p>

        {/* 하단 여백 — 회원가입 페이지와 동일 */}
        <div className="h-8" />
      </div>
    </div>
  );
}
