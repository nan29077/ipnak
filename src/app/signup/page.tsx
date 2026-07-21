"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { SocialButtons } from "@/components/SocialButtons";
import { Button } from "@/components/ui";

/* ── 낚시 방식 목록 ─────────────────────────────────────────── */
const FISHING_METHODS = [
  "루어낚시", "지깅낚시", "선상낚시", "좌대낚시", "찌낚시",
  "원투낚시", "플라이낚시", "에깅낚시", "타이라바낚시", "트롤링낚시",
];

/* ── 관심 어종 목록 ─────────────────────────────────────────── */
const FISH_SPECIES = [
  "배스", "쏘가리", "감성돔", "돌돔", "참돔", "광어", "우럭", "농어",
  "무늬오징어", "갑오징어", "문어", "붕어", "잉어", "송어", "연어",
  "삼치", "부시리", "참치",
];

const FIELD_CLASS =
  "w-full rounded-[16px] px-3.5 py-3 text-[15px] bg-white/[0.06] border border-white/[0.12] text-white placeholder-white/40 outline-none focus:border-aqua-400 focus:ring-2 focus:ring-aqua-400/30 transition-colors";

/* 비밀번호 정책: 영문 + 숫자 + 특수문자 모두 포함, 8자 이상 */
const PW_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (!PW_REGEX.test(pw)) return "영문, 숫자, 특수문자를 모두 포함해야 합니다.";
  return null;
}

/* ── 멀티셀렉트 칩 + 직접입력 컴포넌트 ─────────────────────── */
function TagSelector({
  label, items, selected, onToggle, customPlaceholder, customItems, onAddCustom, onRemoveCustom,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  customPlaceholder: string;
  customItems: string[];
  onAddCustom: (v: string) => void;
  onRemoveCustom: (v: string) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (!v) return;
    onAddCustom(v);
    setInput("");
  }

  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-white/70">
        {label} <span className="text-white/35">(선택, 다중)</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const active = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => onToggle(item)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium outline-none transition-all active:scale-[0.97] ${
                active
                  ? "bg-aqua-400 text-navy-900"
                  : "border border-white/[0.12] bg-white/[0.06] text-white/60 hover:border-white/25"
              }`}
            >
              {item}
            </button>
          );
        })}
        {/* 직접입력한 커스텀 항목 */}
        {customItems.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-aqua-400 pl-3 pr-1.5 py-1.5 text-[12px] font-medium text-navy-900"
          >
            {item}
            <button
              type="button"
              onClick={() => onRemoveCustom(item)}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-navy-900/20 hover:bg-navy-900/40"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}
      </div>
      {/* 기타 직접 입력 */}
      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={customPlaceholder}
          maxLength={30}
          className="min-w-0 flex-1 rounded-[12px] border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:border-aqua-400/60"
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.12] bg-white/[0.04] text-white/50 transition-colors hover:border-aqua-400/50 hover:text-aqua-400 disabled:opacity-30"
        >
          <Plus size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* ── 메인 회원가입 페이지 ──────────────────────────────────── */
export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", nickname: "" });
  const [methods, setMethods] = useState<string[]>([]);
  const [customMethods, setCustomMethods] = useState<string[]>([]);
  const [species, setSpecies] = useState<string[]>([]);
  const [customSpecies, setCustomSpecies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleMethod = (v: string) =>
    setMethods((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const toggleSpecies = (v: string) =>
    setSpecies((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const addCustomMethod = (v: string) => {
    if (!customMethods.includes(v) && !methods.includes(v))
      setCustomMethods((s) => [...s, v]);
  };
  const removeCustomMethod = (v: string) =>
    setCustomMethods((s) => s.filter((x) => x !== v));

  const addCustomSpecies = (v: string) => {
    if (!customSpecies.includes(v) && !species.includes(v))
      setCustomSpecies((s) => [...s, v]);
  };
  const removeCustomSpecies = (v: string) =>
    setCustomSpecies((s) => s.filter((x) => x !== v));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pwError = validatePassword(form.password);
    if (pwError) { toast(pwError, "error"); return; }
    if (form.password !== form.confirmPassword) {
      toast("비밀번호가 일치하지 않습니다.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nickname: form.nickname,
          fishingMethods: [...methods, ...customMethods],
          fishSpecies: [...species, ...customSpecies],
        }),
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
    /* 외부 div: 배경만 담당. min-h-screen은 화면 짧을 때 배경 채우기용.
       overflow는 기본값(visible)이므로 콘텐츠가 길면 자연스럽게 스크롤됨. */
    <div className="min-h-screen bg-gradient-to-b from-[#0d1626] via-[#161616] to-[#243a63]">
      <div className="mx-auto w-full max-w-md px-6 pt-10 pb-16">

        {/* 헤더 */}
        <div className="mb-8 text-center">
          <Image
            src="/logo-ipnak-dark.png"
            alt="입낚"
            width={131}
            height={70}
            priority
            className="mx-auto mb-4 h-[70px] w-auto"
          />
          <h1 className="mb-1 text-[26px] font-extrabold tracking-[-0.02em] text-white">회원가입</h1>
          <p className="text-[13px] text-white/45">입낚과 함께 어복 가득한 하루를</p>
        </div>

        <form onSubmit={submit} className="space-y-6">

          {/* 기본 정보 */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">기본 정보</p>
            <input
              type="email" required placeholder="이메일" autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={FIELD_CLASS}
            />
            <input
              type="password" required placeholder="비밀번호 (영문+숫자+특수문자, 8자 이상)" autoComplete="new-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={`${FIELD_CLASS} ${
                form.password && validatePassword(form.password)
                  ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
                  : ""
              }`}
            />
            {form.password && validatePassword(form.password) && (
              <p className="text-[12px] text-red-400">{validatePassword(form.password)}</p>
            )}
            <input
              type="password" required placeholder="비밀번호 확인" autoComplete="new-password"
              value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className={`${FIELD_CLASS} ${
                form.confirmPassword && form.password !== form.confirmPassword
                  ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
                  : ""
              }`}
            />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-[12px] text-red-400">비밀번호가 일치하지 않습니다.</p>
            )}
            <input
              type="text" required placeholder="닉네임 (2자 이상)"
              value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className={FIELD_CLASS}
            />
          </div>

          {/* 낚시 방식 */}
          <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
            <TagSelector
              label="낚시 방식"
              items={FISHING_METHODS}
              selected={methods}
              onToggle={toggleMethod}
              customPlaceholder="기타 낚시 방식 직접 입력"
              customItems={customMethods}
              onAddCustom={addCustomMethod}
              onRemoveCustom={removeCustomMethod}
            />
          </div>

          {/* 관심 어종 */}
          <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
            <TagSelector
              label="관심 어종"
              items={FISH_SPECIES}
              selected={species}
              onToggle={toggleSpecies}
              customPlaceholder="기타 어종 직접 입력"
              customItems={customSpecies}
              onAddCustom={addCustomSpecies}
              onRemoveCustom={removeCustomSpecies}
            />
          </div>

          <Button
            type="submit" variant="secondary" full
            disabled={loading || !!validatePassword(form.password) || (!!form.confirmPassword && form.password !== form.confirmPassword)}
            leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
          >
            가입하기
          </Button>
        </form>

        {/* 구분선 */}
        <div className="my-5 flex items-center gap-2.5">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[12px] text-white/30">또는 소셜 가입</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <SocialButtons />

        <p className="mt-6 text-center text-[12px] text-white/30">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-aqua-300 hover:text-aqua-200">
            로그인
          </Link>
        </p>

        {/* 하단 여백 */}
        <div className="h-8" />
      </div>
    </div>
  );
}
