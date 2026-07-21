"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Anchor, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { SocialButtons } from "@/components/SocialButtons";
import { Button } from "@/components/ui";

const INTERESTS = ["배스", "쏘가리", "감성돔", "돌돔", "참돔", "광어", "우럭", "농어", "무늬오징어", "갑오징어", "붕어", "송어", "선상낚시", "루어낚시", "찌낚시", "에깅"];

const FIELD_CLASS =
  "w-full rounded-[16px] px-3.5 py-3 text-[15px] bg-white/[0.06] border border-white/[0.12] text-white placeholder-white/40 outline-none focus:border-aqua-400 focus:ring-2 focus:ring-aqua-400/30";

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "", nickname: "" });
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (i: string) =>
    setInterests((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, interests }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "가입 실패");
      toast("가입을 환영합니다!", "success");
      router.push("/");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-end bg-gradient-to-b from-navy-950 via-navy-900 to-navy-700 px-6 pb-8 pt-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/[0.08]">
            <Anchor size={32} className="text-aqua-400" />
          </div>
          <h1 className="mb-1.5 text-[32px] font-extrabold tracking-[-0.02em] text-white">회원가입</h1>
          <p className="text-[13px] text-white/45">입낚과 함께 어복 가득한 하루를</p>
        </div>

        <form onSubmit={submit} className="mb-4">
          <input
            type="email" required placeholder="이메일" autoComplete="email"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={`${FIELD_CLASS} mb-2.5`}
          />
          <input
            type="password" required placeholder="비밀번호 (6자 이상)" autoComplete="new-password"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={`${FIELD_CLASS} mb-2.5`}
          />
          <input
            type="text" required placeholder="닉네임"
            value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            className={FIELD_CLASS}
          />

          <div className="mt-4">
            <p className="mb-2 text-[13px] font-semibold text-white/70">
              관심 낚시 분야 <span className="text-white/35">(선택)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const active = interests.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggle(i)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-medium outline-none transition-all active:scale-[0.97] ${
                      active
                        ? "bg-aqua-400 text-navy-900"
                        : "border border-white/[0.12] bg-white/[0.06] text-white/60"
                    }`}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="submit" variant="secondary" full disabled={loading}
            className="mt-5"
            leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
          >
            가입하기
          </Button>
        </form>

        <div className="mb-4 flex items-center gap-2.5">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[12px] text-white/30">또는</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <SocialButtons />

        <p className="mt-4 text-center text-[12px] text-white/30">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-aqua-300">로그인</Link>
        </p>
      </div>
    </div>
  );
}
