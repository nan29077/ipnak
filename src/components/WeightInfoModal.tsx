"use client";
import { useState } from "react";
import { HelpCircle, AlertTriangle } from "lucide-react";
import { Sheet } from "@/components/ui";

/** 무게 표시 옆 ? 버튼 — 무게 산출 방법 안내 시트를 연다 */
export function WeightInfoModal({ size = 13, className = "" }: { size?: number; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="무게 산출 방법 안내"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        className={`inline-flex shrink-0 items-center text-navy-300 transition-colors hover:text-aqua-500 ${className}`}
      >
        <HelpCircle size={size} strokeWidth={1.8} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="무게 산출 방법" size="md">
        <div className="space-y-3 pb-4">
          <div className="rounded-xl border border-navy-100 bg-navy-50/40 px-4 py-3.5 text-center">
            <p className="text-[18px] font-extrabold tracking-tight text-aqua-500">W = a × L<sup className="text-[12px]">b</sup></p>
            <p className="mt-1 text-[12px] text-navy-300">어류 길이-무게 상관관계</p>
          </div>
          <ul className="space-y-2 text-[13px] leading-relaxed text-navy-500">
            <li>· W = a × L^b 공식을 사용합니다 (어류 길이-무게 상관관계)</li>
            <li>· L = 측정된 물고기 전장(cm), a·b = 어종별 상수</li>
            <li>· 어종을 선택할수록 정확도가 높아집니다</li>
            <li>· 오차 범위: 약 ±15~20% (참고용 수치)</li>
          </ul>
          {/* 중요 안내 — 회원 참여가 쌓일수록 정확도가 올라간다는 점을 강조 */}
          <div className="flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 py-3">
            <AlertTriangle size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-orange-500" />
            <p className="text-[12.5px] leading-relaxed text-navy-500">
              <span className="font-bold text-orange-500">중요</span>
              {" — 무게는 입낚 회원들의 참여가 많아질수록 AI가 점점 더 정확하게 만들어 갑니다."}
            </p>
          </div>
        </div>
      </Sheet>
    </>
  );
}
