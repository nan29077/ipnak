"use client";
import { useState } from "react";
import { KeyRound, Loader2, Check, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/Toast";

// 회원가입·서버(/api/me/password)와 동일한 강도 기준
const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

function validate(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (!PW_REGEX.test(pw)) return "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.";
  return null;
}

const FIELD =
  "w-full rounded-xl border border-navy-100 bg-[#162538] px-4 py-3 pr-11 text-[14px] text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20";

/**
 * 비밀번호 변경 섹션 (마이페이지 > 프로필 수정).
 * hasPassword=false 인 계정(소셜 로그인 전용)은 변경 폼 대신 안내만 보여준다.
 */
export function PasswordChangeSection({ hasPassword }: { hasPassword: boolean }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const nextError = next ? validate(next) : null;
  const mismatch = Boolean(confirm) && next !== confirm;

  if (!hasPassword) {
    return (
      <section className="mt-8 border-t border-navy-100 pt-6">
        <h2 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-navy-700">
          <KeyRound size={14} /> 비밀번호 변경
        </h2>
        <p className="rounded-xl bg-navy-50/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-navy-400">
          소셜 로그인으로 가입한 계정은 비밀번호가 없어 변경할 수 없습니다.
          가입에 사용하신 소셜 서비스에서 비밀번호를 관리해 주세요.
        </p>
      </section>
    );
  }

  async function submit() {
    if (!current) return toast("현재 비밀번호를 입력하세요.", "error");
    const err = validate(next);
    if (err) return toast(err, "error");
    if (next !== confirm) return toast("새 비밀번호가 일치하지 않습니다.", "error");

    setSaving(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "비밀번호를 변경하지 못했습니다.");
      toast("비밀번호를 변경했습니다.", "success");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "비밀번호를 변경하지 못했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 border-t border-navy-100 pt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-navy-700">
          <KeyRound size={14} /> 비밀번호 변경
        </h2>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-navy-400 hover:text-navy-600"
        >
          {visible ? <EyeOff size={13} /> : <Eye size={13} />} {visible ? "숨기기" : "표시"}
        </button>
      </div>

      <div className="space-y-2.5">
        <input
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="현재 비밀번호"
          className={FIELD}
        />
        <div>
          <input
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="새 비밀번호 (영문+숫자+특수문자, 8자 이상)"
            className={FIELD}
          />
          {nextError && <p className="mt-1 text-[12px] text-red-400">{nextError}</p>}
        </div>
        <div>
          <input
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="새 비밀번호 확인"
            className={FIELD}
          />
          {mismatch && <p className="mt-1 text-[12px] text-red-400">새 비밀번호가 일치하지 않습니다.</p>}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={saving || !current || !next || !confirm || Boolean(nextError) || mismatch}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-50 py-3 text-[14px] font-bold text-navy-700 transition-colors hover:bg-navy-100 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? "변경 중..." : "비밀번호 변경"}
        </button>
      </div>
    </section>
  );
}
