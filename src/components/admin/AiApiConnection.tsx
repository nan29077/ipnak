"use client";
import { useState } from "react";
import { Bot, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type Props = { initial: { openaiConfigured: boolean; naverConfigured: boolean } };

export function AiApiConnection({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [openai, setOpenai] = useState("");
  const [naverClientId, setNaverClientId] = useState("");
  const [naverClientSecret, setNaverClientSecret] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!openai && !naverClientId && !naverClientSecret) return toast("입력한 API 키가 없습니다.", "info");
    if ((naverClientId && !naverClientSecret) || (!naverClientId && naverClientSecret)) return toast("네이버 Client ID와 Secret을 모두 입력해 주세요.", "error");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "AI_CONNECTION_SAVE", openai, naverClientId, naverClientSecret }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setOpenai(""); setNaverClientId(""); setNaverClientSecret("");
      toast("AI API 연결 정보를 안전하게 저장했습니다.", "success");
      router.refresh();
    } catch (error: any) { toast(error.message || "저장하지 못했습니다.", "error"); }
    finally { setSaving(false); }
  }

  const input = "w-full rounded-xl border border-navy-100 bg-navy-50/60 px-3 py-2.5 pr-10 text-[13px] text-navy-800 outline-none transition focus:border-aqua-400 focus:bg-white";
  return <form onSubmit={save} className="card p-5">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aqua-400 to-blue-500 text-white shadow-soft"><Bot size={20} /></span>
      <div><h2 className="text-[15px] font-bold text-navy-800">AI API 연결</h2><p className="mt-1 text-[12px] leading-relaxed text-navy-400">키를 등록하면 AI 포인트 추천에서 최신 네이버 블로그 조황과 AI 요약을 활용합니다.</p></div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <Status icon={<Bot size={14} />} label="ChatGPT API" configured={initial.openaiConfigured} />
      <Status icon={<Search size={14} />} label="NAVER 검색 API" configured={initial.naverConfigured} />
    </div>
    <div className="mt-4 space-y-3">
      <SecretInput label="OpenAI API Key" value={openai} onChange={setOpenai} visible={visible} className={input} />
      <SecretInput label="NAVER Search Client ID" value={naverClientId} onChange={setNaverClientId} visible={visible} className={input} />
      <SecretInput label="NAVER Search Client Secret" value={naverClientSecret} onChange={setNaverClientSecret} visible={visible} className={input} />
    </div>
    <div className="mt-4 flex items-center justify-between gap-3"><p className="text-[11px] text-navy-400">등록된 키는 마스킹되며 서버에서 암호화해 보관합니다.</p><button type="button" onClick={() => setVisible(!visible)} className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-navy-500">{visible ? <EyeOff size={14} /> : <Eye size={14} />}{visible ? "숨기기" : "표시"}</button></div>
    <button disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-800 py-3 text-[13px] font-bold text-white transition hover:bg-navy-700 disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}연결 정보 저장</button>
  </form>;
}

function Status({ icon, label, configured }: { icon: React.ReactNode; label: string; configured: boolean }) {
  return <div className="flex items-center gap-2 rounded-xl bg-navy-50 px-3 py-2.5 text-[12px] font-semibold text-navy-600">{icon}<span className="flex-1">{label}</span>{configured ? <span className="flex items-center gap-1 text-aqua-600"><CheckCircle2 size={14} />연결됨</span> : <span className="text-navy-300">미연결</span>}</div>;
}
function SecretInput({ label, value, onChange, visible, className }: { label: string; value: string; onChange: (v: string) => void; visible: boolean; className: string }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-navy-600">{label}</span><input type={visible ? "text" : "password"} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder="새 키 입력 시에만 변경됩니다" className={className} /></label>;
}
