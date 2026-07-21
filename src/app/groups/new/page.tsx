"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";

const CATEGORIES = ["어종별", "지역별", "장르별", "동행", "기타"];
const FISH_SPECIES = ["배스", "송어", "잉어", "숭어", "광어", "우럭", "참돔", "감성돔", "기타"];
const REGIONS = ["서울", "경기", "강원", "충청", "전라", "경상", "제주"];

export default function NewGroupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", description: "", category: "어종별", region: "", fishSpecies: "", isPublic: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("낚시단 이름을 입력해주세요."); return; }
    setLoading(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "오류가 발생했습니다."); return; }
    router.push(`/groups/${data.group.id}`);
  }

  return (
    <div className="min-h-screen bg-[#161616] pb-20">
      <div className="flex items-center gap-3 border-b border-navy-100/20 px-3.5 py-3">
        <Link href="/groups"><ArrowLeft size={20} className="text-navy-400" /></Link>
        <h1 className="text-[16px] font-extrabold text-navy-900">낚시단 만들기</h1>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-400">{error}</div>
        )}

        <Field label="낚시단 이름 *">
          <input value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="ex) 제주 배스낚시 모임"
            className="input-base" maxLength={40} />
        </Field>

        <Field label="소개">
          <textarea value={form.description} onChange={e => set("description", e.target.value)}
            placeholder="낚시단 소개를 입력해주세요"
            rows={3} className="input-base resize-none" maxLength={200} />
        </Field>

        <Field label="카테고리 *">
          <div className="relative">
            <select value={form.category} onChange={e => set("category", e.target.value)}
              className="input-base appearance-none pr-8">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300" />
          </div>
        </Field>

        <Field label="지역">
          <div className="relative">
            <select value={form.region} onChange={e => set("region", e.target.value)}
              className="input-base appearance-none pr-8">
              <option value="">지역 선택 안함</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300" />
          </div>
        </Field>

        <Field label="주요 어종">
          <div className="relative">
            <select value={form.fishSpecies} onChange={e => set("fishSpecies", e.target.value)}
              className="input-base appearance-none pr-8">
              <option value="">어종 선택 안함</option>
              {FISH_SPECIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300" />
          </div>
        </Field>

        <Field label="공개 설정">
          <div className="flex gap-3">
            {[true, false].map(v => (
              <button key={String(v)} type="button" onClick={() => set("isPublic", v)}
                className={`flex-1 rounded-xl border py-2.5 text-[13px] font-semibold transition-all ${form.isPublic === v
                  ? "border-orange-500 bg-orange-500/10 text-orange-500"
                  : "border-navy-100/20 bg-navy-50/10 text-navy-400"}`}>
                {v ? "공개" : "비공개"}
              </button>
            ))}
          </div>
        </Field>

        <button type="submit" disabled={loading}
          className="mt-4 w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-extrabold text-white shadow-soft disabled:opacity-60">
          {loading ? "생성 중..." : "낚시단 만들기"}
        </button>
      </form>

      <style jsx global>{`
        .input-base {
          width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #e8eaf6; outline: none;
        }
        .input-base:focus { border-color: rgba(245,124,0,0.5); }
        .input-base option { background: #1e1e1e; color: #e8eaf6; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-bold text-navy-400">{label}</label>
      {children}
    </div>
  );
}
