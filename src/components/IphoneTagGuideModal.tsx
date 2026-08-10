"use client";
/**
 * 아이폰 NFC 태그 사용법 1회성 안내 팝업
 *
 * 언제 뜨나
 * - 등록된 입낚볼/입낚키링을 태그해서 계측 화면(/measure?...&fromTag=1)으로 처음 진입한
 *   아이폰 사용자에게 딱 한 번.
 * - 확인을 누르면 localStorage 에 기록되어 다시 뜨지 않는다.
 *
 * 왜 필요한가
 * - 아이폰은 앱 안에서 NFC 를 직접 읽지 못하고, 폰에 태그를 대면 화면 상단에 배너가 뜬다.
 *   이 동작을 모르면 "왜 앱에 태그 버튼이 없지?" 하고 헤매게 된다.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Smartphone, Nfc, Hand, Check } from "lucide-react";

/** 안내를 이미 본 사용자 표시 (측정 페이지와 공유) */
export const IOS_TAG_GUIDE_KEY = "ipnak_ios_tag_guide_done";

export function IphoneTagGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // 팝업이 떠 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1b2a] shadow-2xl shadow-black/70">
        <div className="flex flex-col items-center bg-gradient-to-b from-[#0f2540] to-[#0d1b2a] px-6 pb-5 pt-7">
          <div className="relative mb-4">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[20px] border border-white/10 bg-white/5 ring-4 ring-white/5">
              <Smartphone size={28} strokeWidth={1.4} className="text-navy-300" />
            </div>
            <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/40 ring-2 ring-[#0d1b2a]">
              <Nfc size={14} strokeWidth={2.2} className="text-white" />
            </span>
          </div>
          <h3 className="text-[17px] font-extrabold tracking-tight text-white">
            아이폰에서 태그하는 방법
          </h3>
          <p className="mt-2 text-center text-[13px] leading-relaxed text-navy-400">
            아이폰에서는 볼을 가져다 대면 상단에 배너가 떠요.
            <br />
            배너를 탭하면 바로 계측 화면이 열립니다.
          </p>
        </div>

        <div className="space-y-3 border-t border-white/5 px-6 py-4">
          <GuideRow icon={<Hand size={15} strokeWidth={2} />} step="1">
            잠금 화면이나 홈 화면에서 <b className="font-bold text-white/80">입낚볼·키링을 아이폰 윗부분</b>에 가까이 대세요.
          </GuideRow>
          <GuideRow icon={<Nfc size={15} strokeWidth={2} />} step="2">
            화면 상단에 뜨는 <b className="font-bold text-white/80">입낚 배너를 탭</b>하세요.
          </GuideRow>
          <GuideRow icon={<Check size={15} strokeWidth={2.4} />} step="3">
            이 계측 화면이 바로 열려요. 볼 ID는 자동으로 선택됩니다.
          </GuideRow>
        </div>

        <div className="border-t border-white/5 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-[14px] bg-orange-500 py-3 text-[14px] font-bold text-gray-900 shadow-md shadow-orange-500/30 transition-all hover:bg-orange-600 active:scale-[0.97]"
          >
            확인했어요
          </button>
          <p className="mt-2 text-center text-[11px] text-navy-400">이 안내는 다시 표시되지 않아요.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GuideRow({ icon, step, children }: { icon: React.ReactNode; step: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-aqua-500/10 text-aqua-300">
        {icon}
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-aqua-500 text-[10px] font-extrabold text-[#0d1b2a]">
          {step}
        </span>
      </span>
      <p className="pt-1 text-[12px] leading-relaxed text-navy-400">{children}</p>
    </div>
  );
}
