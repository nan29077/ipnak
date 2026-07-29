"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowLeft, ShieldAlert, KeyRound, Check } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";

const FIELD_CLASS =
  "w-full rounded-[16px] px-3.5 py-3 text-[15px] bg-white/[0.06] border border-white/[0.12] text-white placeholder-white/40 outline-none focus:border-aqua-400 focus:ring-2 focus:ring-aqua-400/30 transition-colors";

// 회원가입·비밀번호 변경과 동일한 강도 기준
const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (!PW_REGEX.test(pw)) return "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.";
  return null;
}

type Step = "email" | "code" | "password" | "done";

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

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#0d1626] via-[#0d1b2a] to-[#243a63]">
      <div className="mx-auto w-full max-w-md px-6 py-10">
        <div className="mb-8 text-center">
          <Image
            src="/logo-ipnak-bear-exact.png"
            alt="입낚"
            width={1330}
            height={620}
            priority
            className="mx-auto mb-4 h-[60px] w-auto"
          />
          <h1 className="text-[17px] font-bold text-white">비밀번호 찾기</h1>
          <p className="mt-1 text-[13px] text-white/45">
            {step === "email" && "가입 시 등록한 이메일을 입력해 주세요."}
            {step === "code" && "휴대폰으로 받은 6자리 인증번호를 입력해 주세요."}
            {step === "password" && "새로 사용할 비밀번호를 입력해 주세요."}
            {step === "done" && "비밀번호가 변경되었습니다."}
          </p>
        </div>

        {/* 1단계 — 이메일 입력 */}
        {step === "email" && (
          <form onSubmit={requestCode} className="space-y-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="가입한 이메일"
              autoComplete="email"
              className={FIELD_CLASS}
            />
            <Button
              type="submit" variant="secondary" full disabled={loading}
              leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
            >
              인증번호 받기
            </Button>

            {smsNotice && (
              <div className="mt-4 flex items-start gap-2.5 rounded-[16px] border border-amber-400/25 bg-amber-400/10 px-4 py-3.5">
                <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-400" />
                <p className="text-[13px] leading-relaxed text-amber-200/90">{smsNotice}</p>
              </div>
            )}
          </form>
        )}

        {/* 2단계 — 인증번호 확인 */}
        {step === "code" && (
          <form onSubmit={verifyCode} className="space-y-2.5">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoComplete="one-time-code"
              className={`${FIELD_CLASS} text-center text-[22px] font-bold tracking-[0.4em]`}
            />
            <p className="text-[12px] text-white/35">인증번호는 5분간 유효하며, 3회 틀리면 무효화됩니다.</p>
            <Button
              type="submit" variant="secondary" full disabled={loading}
              leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={17} />}
            >
              인증 확인
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); }}
              className="w-full py-2 text-[12.5px] font-semibold text-white/40 hover:text-white/70"
            >
              이메일 다시 입력하기
            </button>
          </form>
        )}

        {/* 3단계 — 새 비밀번호 */}
        {step === "password" && (
          <form onSubmit={submitPassword} className="space-y-2.5">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="새 비밀번호 (영문+숫자+특수문자, 8자 이상)"
              autoComplete="new-password"
              className={FIELD_CLASS}
            />
            {pwError && <p className="text-[12px] text-red-400">{pwError}</p>}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 확인"
              autoComplete="new-password"
              className={FIELD_CLASS}
            />
            {mismatch && <p className="text-[12px] text-red-400">비밀번호가 일치하지 않습니다.</p>}
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
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-[16px] border border-aqua-400/25 bg-aqua-400/10 px-4 py-3.5">
              <Check size={17} className="mt-0.5 shrink-0 text-aqua-300" />
              <p className="text-[13px] leading-relaxed text-aqua-100/90">
                비밀번호가 변경되었습니다. 보안을 위해 기존 로그인은 모두 해제되었습니다.
              </p>
            </div>
            <Button variant="secondary" full onClick={() => router.replace("/login")}>
              로그인하러 가기
            </Button>
          </div>
        )}

        <p className="mt-6 text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/35 hover:text-white/60">
            <ArrowLeft size={13} /> 로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
