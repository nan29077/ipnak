"use client";

import { useState, useEffect } from "react";
import { Bell, Send, Settings, Users, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/Toast";

type Tab = "send" | "settings";

interface AligoSettings {
  apiKey: string;
  userId: string;
  sender: string;
  senderKey: string;
}

export default function AlimtalkPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("send");

  // ── 설정 탭 상태 ──────────────────────────────────────────
  const [settings, setSettings] = useState<AligoSettings>({ apiKey: "", userId: "", sender: "", senderKey: "" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // ── 발송 탭 상태 ──────────────────────────────────────────
  const [sendType, setSendType] = useState<"sms" | "alimtalk">("sms");
  const [target, setTarget] = useState<"all" | "specific">("all");
  const [phones, setPhones] = useState("");
  const [message, setMessage] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ successCount?: number; failCount?: number; total?: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/alimtalk/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.apiKey !== undefined) {
          setSettings(data);
          setSettingsLoaded(true);
        }
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings.apiKey.trim() || !settings.userId.trim() || !settings.sender.trim()) {
      toast("API Key, User ID, 발신번호는 필수입니다.", "error");
      return;
    }
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/alimtalk/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast("Aligo 설정이 저장되었습니다.", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) { toast("메시지를 입력하세요.", "error"); return; }
    if (target === "specific" && !phones.trim()) { toast("발송 대상 번호를 입력하세요.", "error"); return; }
    if (sendType === "alimtalk" && !templateCode.trim()) { toast("템플릿 코드를 입력하세요.", "error"); return; }

    const phoneList = phones.split(/[\n,]/).map((p) => p.replace(/-/g, "").trim()).filter(Boolean);

    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/alimtalk/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: sendType,
          target,
          phones: target === "specific" ? phoneList : undefined,
          message,
          templateCode: sendType === "alimtalk" ? templateCode : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발송 실패");
      setSendResult(data);
      toast(`발송 완료! 총 ${data.total || 0}건`, "success");
      setMessage("");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSending(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-[13px] text-navy-800 placeholder:text-navy-400 outline-none focus:border-aqua-400 focus:ring-1 focus:ring-aqua-400/30";

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-soft">
          <Bell size={20} />
        </span>
        <div>
          <h1 className="text-[18px] font-bold text-navy-800">알림톡 · SMS 관리</h1>
          <p className="text-[12px] text-navy-400">Aligo를 통해 회원에게 메시지를 발송합니다.</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-navy-100">
        <button
          type="button"
          onClick={() => setTab("send")}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors ${tab === "send" ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400 hover:text-navy-700"}`}
        >
          <Send size={14} /> 메시지 발송
        </button>
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors ${tab === "settings" ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400 hover:text-navy-700"}`}
        >
          <Settings size={14} /> Aligo 설정
        </button>
      </div>

      {/* ── 발송 탭 ── */}
      {tab === "send" && (
        <form onSubmit={handleSend} className="card space-y-4 p-5">
          {/* 발송 유형 */}
          <div>
            <p className="mb-2 text-[12px] font-semibold text-navy-600">발송 유형</p>
            <div className="flex gap-3">
              {(["sms", "alimtalk"] as const).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="sendType"
                    value={t}
                    checked={sendType === t}
                    onChange={() => setSendType(t)}
                    className="accent-orange-500"
                  />
                  <span className="flex items-center gap-1 text-[13px] text-navy-700">
                    {t === "sms" ? <><MessageSquare size={13} /> SMS</> : <><Bell size={13} /> 카카오 알림톡</>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 알림톡 템플릿 코드 */}
          {sendType === "alimtalk" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-navy-600">템플릿 코드 (카카오 승인 템플릿)</label>
              <input
                type="text"
                placeholder="예: IPNAK_NOTICE_001"
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-navy-400">카카오 비즈니스 채널에서 승인받은 템플릿 코드를 입력하세요.</p>
            </div>
          )}

          {/* 발송 대상 */}
          <div>
            <p className="mb-2 text-[12px] font-semibold text-navy-600">발송 대상</p>
            <div className="flex gap-3">
              {(["all", "specific"] as const).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="target"
                    value={t}
                    checked={target === t}
                    onChange={() => setTarget(t)}
                    className="accent-orange-500"
                  />
                  <span className="flex items-center gap-1 text-[13px] text-navy-700">
                    {t === "all" ? <><Users size={13} /> 전체 회원</> : "특정 번호"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 특정 번호 입력 */}
          {target === "specific" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-navy-600">수신 번호</label>
              <textarea
                rows={4}
                placeholder={"01012345678\n01087654321\n(줄바꿈 또는 쉼표로 구분)"}
                value={phones}
                onChange={(e) => setPhones(e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>
          )}

          {/* 메시지 */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-navy-600">메시지 내용</label>
            <textarea
              rows={5}
              placeholder="발송할 메시지를 입력하세요."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`${inputClass} resize-none`}
              required
            />
            <p className="mt-1 text-right text-[11px] text-navy-400">{message.length}자</p>
          </div>

          {/* 발송 결과 */}
          {sendResult && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 size={15} />
              <span>
                총 {sendResult.total}건 중 성공 {sendResult.successCount ?? sendResult.total}건
                {sendResult.failCount ? `, 실패 ${sendResult.failCount}건` : ""}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "발송 중..." : "발송하기"}
          </button>
        </form>
      )}

      {/* ── 설정 탭 ── */}
      {tab === "settings" && (
        <form onSubmit={saveSettings} className="card space-y-4 p-5">
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-700 ring-1 ring-amber-200">
            알리고(aligo.in) 계정의 API 정보를 입력하세요. 알림톡을 사용하려면 카카오 비즈니스 채널 연결 후 발신프로필 키도 입력해야 합니다.
          </p>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-navy-600">API Key <span className="text-red-500">*</span></label>
            <input type="text" placeholder="알리고 API Key" value={settings.apiKey} onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })} className={inputClass} autoComplete="off" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-navy-600">User ID <span className="text-red-500">*</span></label>
            <input type="text" placeholder="알리고 사용자 ID" value={settings.userId} onChange={(e) => setSettings({ ...settings, userId: e.target.value })} className={inputClass} autoComplete="off" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-navy-600">발신 번호 <span className="text-red-500">*</span></label>
            <input type="tel" placeholder="예: 01012345678 (사전 등록된 번호)" value={settings.sender} onChange={(e) => setSettings({ ...settings, sender: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-navy-600">알림톡 발신프로필 키 (선택)</label>
            <input type="text" placeholder="카카오 채널 연결 후 발급되는 senderkey" value={settings.senderKey} onChange={(e) => setSettings({ ...settings, senderKey: e.target.value })} className={inputClass} autoComplete="off" />
            <p className="mt-1 text-[11px] text-navy-400">SMS만 사용한다면 비워두세요. 알림톡 발송 시 필수입니다.</p>
          </div>

          <button
            type="submit"
            disabled={savingSettings || !settingsLoaded}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />}
            설정 저장
          </button>
        </form>
      )}
    </div>
  );
}
