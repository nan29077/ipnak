"use client";

import { useState } from "react";
import { Bot, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, MessageSquare, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type ApiTab = "chatgpt" | "naver" | "sms";
type Props = {
  initial: {
    openaiConfigured: boolean;
    naverConfigured: boolean;
    smsConfigured: boolean;
    smsSender: string;
  };
};

export function AiApiConnection({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ApiTab>("chatgpt");
  const [openai, setOpenai] = useState("");
  const [naverClientId, setNaverClientId] = useState("");
  const [naverClientSecret, setNaverClientSecret] = useState("");
  // 발신번호는 비밀값이 아니라 현재 설정된 값을 그대로 보여주고 수정하게 한다.
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsApiSecret, setSmsApiSecret] = useState("");
  const [smsSender, setSmsSender] = useState(initial.smsSender ?? "");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    const payload = activeTab === "chatgpt"
      ? { type: "AI_CONNECTION_SAVE", openai }
      : activeTab === "naver"
      ? { type: "AI_CONNECTION_SAVE", naverClientId, naverClientSecret }
      : { type: "AI_CONNECTION_SAVE", smsApiKey, smsApiSecret, smsSender };

    if (activeTab === "chatgpt" && !openai.trim()) {
      return toast("ChatGPT API 키를 입력해 주세요.", "info");
    }
    if (activeTab === "naver" && (!naverClientId.trim() || !naverClientSecret.trim())) {
      return toast("NAVER Client ID와 Client Secret을 모두 입력해 주세요.", "error");
    }
    if (activeTab === "sms" && !smsApiKey.trim() && !smsApiSecret.trim() && !smsSender.trim()) {
      return toast("저장할 SMS 연동 정보를 입력해 주세요.", "info");
    }
    if (activeTab === "sms" && (Boolean(smsApiKey.trim()) !== Boolean(smsApiSecret.trim()))) {
      return toast("SMS API 키와 Secret은 함께 입력해 주세요.", "error");
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장하지 못했습니다.");

      if (activeTab === "chatgpt") setOpenai("");
      else if (activeTab === "naver") {
        setNaverClientId("");
        setNaverClientSecret("");
      } else {
        // 발신번호는 화면에 계속 보여줘야 하므로 비우지 않는다.
        setSmsApiKey("");
        setSmsApiSecret("");
      }
      toast(`${activeTab === "chatgpt" ? "ChatGPT" : activeTab === "naver" ? "NAVER 검색" : "SMS"} API 연결 정보를 저장했습니다.`, "success");
      router.refresh();
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "저장하지 못했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 pr-10 text-[13px] text-navy-800 placeholder:text-navy-400 outline-none transition focus:border-aqua-400 focus:ring-1 focus:ring-aqua-400/30";
  const isChatGpt = activeTab === "chatgpt";

  return (
    <form onSubmit={save} className="card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aqua-400 to-blue-500 text-white shadow-soft">
          <Bot size={20} />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-navy-800">외부 API 연결</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-navy-400">서비스별 API 정보를 탭에서 각각 입력하고 저장할 수 있습니다.</p>
        </div>
      </div>

      <div className="mt-5 flex border-b border-navy-100" role="tablist" aria-label="외부 API 종류">
        <ApiTabButton active={isChatGpt} icon={<Bot size={15} />} label="ChatGPT API" configured={initial.openaiConfigured} onClick={() => setActiveTab("chatgpt")} />
        <ApiTabButton active={activeTab === "naver"} icon={<Search size={15} />} label="NAVER 검색 API" configured={initial.naverConfigured} onClick={() => setActiveTab("naver")} />
        <ApiTabButton active={activeTab === "sms"} icon={<MessageSquare size={15} />} label="휴대폰 인증(SMS)" configured={initial.smsConfigured} onClick={() => setActiveTab("sms")} />
      </div>

      <div className="mt-5">
        {isChatGpt ? (
          <SecretInput label="OpenAI API Key" value={openai} onChange={setOpenai} visible={visible} className={inputClass} configured={initial.openaiConfigured} />
        ) : activeTab === "sms" ? (
          <div className="space-y-3">
            <SecretInput label="SMS 서비스 API 키" value={smsApiKey} onChange={setSmsApiKey} visible={visible} className={inputClass} configured={initial.smsConfigured} />
            <SecretInput label="SMS 서비스 Secret" value={smsApiSecret} onChange={setSmsApiSecret} visible={visible} className={inputClass} configured={initial.smsConfigured} />
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-navy-600">발신 번호 (선택)</span>
              <input
                type="tel"
                autoComplete="off"
                value={smsSender}
                onChange={(e) => setSmsSender(e.target.value)}
                placeholder="예: 01012345678 (사전 등록된 발신번호)"
                className={inputClass}
              />
            </label>
            <p className="rounded-xl bg-amber-400/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-500 ring-1 ring-amber-400/20">
              현재는 <b>키 저장까지만</b> 지원합니다. 실제 문자 발송 연동은 아직 되어 있지 않습니다.
              알리고·CoolSMS 등 사용하실 서비스의 키를 미리 등록해 두세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <SecretInput label="NAVER Search Client ID" value={naverClientId} onChange={setNaverClientId} visible={visible} className={inputClass} configured={initial.naverConfigured} />
            <SecretInput label="NAVER Search Client Secret" value={naverClientSecret} onChange={setNaverClientSecret} visible={visible} className={inputClass} configured={initial.naverConfigured} />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-navy-400">등록한 키는 마스킹되며 서버에서 암호화해 보관합니다.</p>
        <button type="button" onClick={() => setVisible((current) => !current)} className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-navy-500">
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}{visible ? "숨기기" : "표시"}
        </button>
      </div>

      <button disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} 연결 정보 저장
      </button>
    </form>
  );
}

function ApiTabButton({ active, icon, label, configured, onClick }: { active: boolean; icon: React.ReactNode; label: string; configured: boolean; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors ${active ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400 hover:text-navy-700"}`}>
      {icon}{label}
      {configured && <CheckCircle2 size={14} className="text-aqua-600" aria-label="연결됨" />}
    </button>
  );
}

function SecretInput({ label, value, onChange, visible, className, configured }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; className: string; configured?: boolean }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[12px] font-semibold text-navy-600">{label}</span>
        {configured && !value && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={11} /> 등록됨
          </span>
        )}
      </div>
      {configured && !value ? (
        <div className="flex items-center gap-2 rounded-xl border border-navy-200 bg-navy-50 px-3 py-2.5">
          <span className="flex-1 font-mono text-[13px] tracking-widest text-navy-500 select-none">
            {visible ? "（현재 키 확인 불가 — 새로 입력해야 변경됩니다）" : "••••••••••••••••••••••••••••••••"}
          </span>
        </div>
      ) : (
        <input
          type={visible ? "text" : "password"}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={configured ? "새 키를 입력하면 덮어씁니다" : "키를 입력하세요"}
          className={className}
        />
      )}
    </label>
  );
}
