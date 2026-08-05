"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Coins } from "lucide-react";
import Link from "next/link";
import { useAppSettings } from "@/lib/appSettingsContext";

const CATEGORIES = ["어종별", "지역별", "장르별", "동행", "기타"];
const FISH_SPECIES = ["배스", "송어", "잉어", "숭어", "광어", "우럭", "참돔", "감성돔", "기타"];
const REGIONS = ["서울", "경기", "강원", "충청", "전라", "경상", "제주"];

export default function NewGroupPage() {
  const router = useRouter();
  // 낚시단 유료 개설(포인트 제도 ON + 유료 개설 ON)일 때만 개설 비용 안내
  const { pointsEnabled, groupPointsRequired } = useAppSettings();
  const showCreateCost = pointsEnabled && groupPointsRequired;
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
    // replace: 생성 완료 후 뒤로가기 시 작성 폼으로 되돌아가지 않도록
    router.replace(`/groups/${data.group.id}`);
  }

  return (
    <div className="bg-[#0d1b2a] pb-20">
      <div className="flex items-center gap-3 border-b border-navy-100/20 px-3.5 py-3">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.replace("/groups"); }} aria-label="뒤로" className="rounded-full p-1 text-navy-400 hover:bg-navy-50/10 active:bg-navy-50/20"><ArrowLeft size={20} /></button>
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

        {showCreateCost && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-300">
            <Coins size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <span>개설 시 <b className="font-extrabold">10,000P</b>가 차감됩니다. (해산 시 환불 불가)</span>
          </div>
        )}

        <button type="submit" disabled={loading}
          className={`${showCreateCost ? "mt-2" : "mt-4"} w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-extrabold text-white shadow-soft disabled:opacity-60`}>
          {loading ? "생성 중..." : "낚시단 만들기"}
        </button>
      </form>

      <style jsx global>{`
        .input-base {
          width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #e8eaf6; outline: none;
        }
        .input-base:focus { border-color: rgba(245,124,0,0.5); }
        .input-base option { background: #162538; color: #e8eaf6; }
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
