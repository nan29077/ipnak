"use client";

/**
 * ConsentSheet — 소셜 가입 사용자가 위치정보 이용약관 등에
 * 동의하지 않은 채로 앱에 진입한 경우 표시되는 필수 동의 바텀 시트.
 * locationConsent === false 인 로그인 유저에게만 표시.
 * 닫기 불가(필수 약관 동의 완료 전까지).
 */

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MapPin, Shield, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

// 이 페이지들에서는 ConsentSheet를 표시하지 않음 (약관 확인용 페이지 등)
const EXEMPT_PATHS = ["/terms", "/privacy", "/location-terms", "/login", "/signup"];

type Props = {
  /** true면 시트를 렌더링하지 않음 */
  alreadyConsented: boolean;
};

export function ConsentSheet({ alreadyConsented }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentLocation, setConsentLocation] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [saving, setSaving] = useState(false);
  // 동의 완료 후 즉시 시트를 닫기 위한 로컬 상태
  const [consented, setConsented] = useState(false);

  const allRequired = consentTerms && consentPrivacy && consentLocation;
  const allChecked = allRequired && consentMarketing;

  function toggleAll() {
    const next = !allChecked;
    setConsentTerms(next);
    setConsentPrivacy(next);
    setConsentLocation(next);
    setConsentMarketing(next);
  }

  async function submit() {
    if (!allRequired) {
      toast("필수 항목 3개(이용약관, 개인정보처리방침, 위치정보)에 모두 동의해 주세요.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsConsent: true,
          privacyConsent: true,
          locationConsent: true,
        }),
      });
      if (!res.ok) throw new Error("동의 처리에 실패했습니다.");
      toast("약관 동의가 완료됐습니다.", "success");
      // 즉시 닫기 (router.refresh()와 무관하게 바로 숨김)
      setConsented(true);
      router.refresh();
    } catch {
      toast("동의 처리 중 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  // 약관 확인 페이지 등에서는 시트 미표시
  const isExempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));
  if (alreadyConsented || consented || isExempt) return null;

  return (
    /* 전체 화면 오버레이 — 닫기 불가 */
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-[480px] rounded-t-3xl bg-[#0d1b2a] pb-safe">
        {/* 헤더 */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-aqua-400/20">
            <MapPin size={24} className="text-aqua-400" strokeWidth={1.8} />
          </div>
          <h2 className="text-center text-[17px] font-bold text-white">서비스 이용 약관 동의</h2>
          <p className="mt-1 text-center text-[13px] text-white/50">
            입낚 서비스를 이용하려면 아래 약관에 동의해 주세요.
          </p>
        </div>

        {/* 동의 항목 */}
        <div className="px-5 py-4 space-y-3">
          {/* 전체 동의 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="h-4 w-4 rounded accent-aqua-400"
            />
            <span className="text-[14px] font-bold text-white/80">전체 동의</span>
          </label>
          <div className="border-t border-white/10" />

          {/* 이용약관 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentTerms}
              onChange={(e) => setConsentTerms(e.target.checked)}
              className="h-4 w-4 rounded accent-aqua-400"
            />
            <FileText size={14} className="shrink-0 text-white/30" />
            <span className="flex-1 text-[13px] text-white/60">
              <span className="text-aqua-400 font-semibold">[필수]</span> 이용약관
            </span>
            <a href="/terms" target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-[11px] text-white/30 underline hover:text-white/50">
              보기
            </a>
          </label>

          {/* 개인정보처리방침 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentPrivacy}
              onChange={(e) => setConsentPrivacy(e.target.checked)}
              className="h-4 w-4 rounded accent-aqua-400"
            />
            <Shield size={14} className="shrink-0 text-white/30" />
            <span className="flex-1 text-[13px] text-white/60">
              <span className="text-aqua-400 font-semibold">[필수]</span> 개인정보처리방침
            </span>
            <a href="/privacy" target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-[11px] text-white/30 underline hover:text-white/50">
              보기
            </a>
          </label>

          {/* 위치정보 이용약관 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentLocation}
              onChange={(e) => setConsentLocation(e.target.checked)}
              className="h-4 w-4 rounded accent-aqua-400"
            />
            <MapPin size={14} className="shrink-0 text-white/30" />
            <span className="flex-1 text-[13px] text-white/60">
              <span className="text-aqua-400 font-semibold">[필수]</span> 위치정보 이용약관
            </span>
            <a href="/location-terms" target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-[11px] text-white/30 underline hover:text-white/50">
              보기
            </a>
          </label>

          {/* 마케팅 동의 (선택) */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentMarketing}
              onChange={(e) => setConsentMarketing(e.target.checked)}
              className="h-4 w-4 rounded accent-aqua-400"
            />
            <CheckCircle2 size={14} className="shrink-0 text-white/30" />
            <span className="flex-1 text-[13px] text-white/60">
              <span className="text-white/40 font-semibold">[선택]</span> 마케팅 정보 수신 동의
            </span>
          </label>
        </div>

        {/* 동의 버튼 */}
        <div className="px-5 pb-8">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-aqua-400 py-3.5 text-[14px] font-bold text-navy-900 transition disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            동의하고 시작하기
          </button>
          {!allRequired && (
            <p className="mt-2 text-center text-[11px] text-white/30">
              필수 항목 3개에 모두 동의해야 진행할 수 있습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
