"use client";

import { useState } from "react";
import { Bot, CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Search, Waves } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type ApiTab = "chatgpt" | "naver" | "marine";
type Props = {
  initial: {
    openaiConfigured: boolean;
    naverConfigured: boolean;
    /** 해양·기상 공공 API — 이전 버전 데이터에는 없을 수 있어 선택 필드로 둔다 */
    tideConfigured?: boolean;
    weatherConfigured?: boolean;
  };
};

export function AiApiConnection({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ApiTab>("chatgpt");
  const [openai, setOpenai] = useState("");
  const [naverClientId, setNaverClientId] = useState("");
  const [naverClientSecret, setNaverClientSecret] = useState("");
  // 해양·기상 공공 API (AI 포인트 추천의 물때/수온/바람/기압 보강용)
  const [tideApiKey, setTideApiKey] = useState("");
  const [weatherApiKey, setWeatherApiKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    // 해양·기상 키는 저장 엔드포인트가 따로라 먼저 처리한다.
    if (activeTab === "marine") return saveMarine();

    const payload = activeTab === "chatgpt"
      ? { type: "AI_CONNECTION_SAVE", openai }
      : { type: "AI_CONNECTION_SAVE", naverClientId, naverClientSecret };

    if (activeTab === "chatgpt" && !openai.trim()) {
      return toast("ChatGPT API 키를 입력해 주세요.", "info");
    }
    if (activeTab === "naver" && (!naverClientId.trim() || !naverClientSecret.trim())) {
      return toast("NAVER Client ID와 Client Secret을 모두 입력해 주세요.", "error");
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
      }
      toast(`${activeTab === "chatgpt" ? "ChatGPT" : "NAVER 검색"} API 연결 정보를 저장했습니다.`, "success");
      router.refresh();
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "저장하지 못했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveMarine() {
    if (!tideApiKey.trim() && !weatherApiKey.trim()) {
      return toast("저장할 해양·기상 API 키를 입력해 주세요.", "info");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marine-api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tideApiKey: tideApiKey.trim(), weatherApiKey: weatherApiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setTideApiKey("");
      setWeatherApiKey("");
      toast("해양·기상 API 연결 정보를 저장했습니다.", "success");
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

      <div className="mt-5 flex overflow-x-auto border-b border-navy-100" role="tablist" aria-label="외부 API 종류">
        <ApiTabButton active={isChatGpt} icon={<Bot size={15} />} label="ChatGPT API" configured={initial.openaiConfigured} onClick={() => setActiveTab("chatgpt")} />
        <ApiTabButton active={activeTab === "naver"} icon={<Search size={15} />} label="NAVER 검색 API" configured={initial.naverConfigured} onClick={() => setActiveTab("naver")} />
        <ApiTabButton active={activeTab === "marine"} icon={<Waves size={15} />} label="해양·기상 API" configured={Boolean(initial.tideConfigured && initial.weatherConfigured)} onClick={() => setActiveTab("marine")} />
      </div>

      <div className="mt-5">
        {isChatGpt ? (
          <SecretInput label="OpenAI API Key" value={openai} onChange={setOpenai} visible={visible} className={inputClass} configured={initial.openaiConfigured} />
        ) : activeTab === "marine" ? (
          <div className="space-y-3">
            <SecretInput
              label="국립해양조사원 조석예보 API 키 (물때 · 수온 · 기압)"
              value={tideApiKey} onChange={setTideApiKey} visible={visible} className={inputClass}
              configured={Boolean(initial.tideConfigured)}
            />
            <SecretInput
              label="기상청 단기예보 API 키 (기온 · 풍향 · 풍속)"
              value={weatherApiKey} onChange={setWeatherApiKey} visible={visible} className={inputClass}
              configured={Boolean(initial.weatherConfigured)}
            />
            <div className="rounded-xl bg-aqua-500/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-aqua-600 ring-1 ring-aqua-500/20">
              <p className="font-semibold">AI 포인트 추천 정확도 보강용 공공 API입니다.</p>
              <p className="mt-1">
                키를 등록하면 추천 화면에 물때 타임라인·수온·풍향·기압 카드가 함께 표시되고, AI가 그 데이터를 근거로 추천 사유를 씁니다.
                <b> 등록하지 않아도 기존 추천은 그대로 동작</b>하며 해당 카드만 표시되지 않습니다.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <a href="https://www.khoa.go.kr/oceangrid/gis/category/reference/distribution.do" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
                  바다누리 해양정보 신청 <ExternalLink size={11} />
                </a>
                <a href="https://www.data.go.kr/data/15084084/openapi.do" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
                  기상청 단기예보 신청 <ExternalLink size={11} />
                </a>
              </div>
            </div>
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

      <button disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-gray-900 transition hover:bg-orange-600 disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} 연결 정보 저장
      </button>
    </form>
  );
}

function ApiTabButton({ active, icon, label, configured, onClick }: { active: boolean; icon: React.ReactNode; label: string; configured: boolean; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`flex flex-1 min-w-fit items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors ${active ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400 hover:text-navy-700"}`}>
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
      <input
        type={visible ? "text" : "password"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={configured ? "새 키를 입력하면 덮어씁니다" : "키를 입력하세요"}
        className={className}
      />
    </label>
  );
}
