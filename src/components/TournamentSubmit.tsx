"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Camera, Images, ScanLine, Coins } from "lucide-react";
import { Sheet, Button } from "@/components/ui";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";

export function TournamentSubmit({ tournamentId, species, loggedIn, entryFee }: {
  tournamentId: string; species: string | null; loggedIn: boolean;
  /** 참가비 포인트 (null/0 이면 무료) — 실제 차감은 계측 제출 시점에 확인 모달을 거친다 */
  entryFee?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loginModal, setLoginModal] = useState(false);

  function handleOpen() {
    if (!loggedIn) { setLoginModal(true); return; }
    setOpen(true);
  }

  function goMeasure() {
    setOpen(false);
    const params = new URLSearchParams({ tournamentId, autoCamera: "1" });
    if (species) params.set("species", species);
    router.push(`/measure?${params.toString()}`);
  }

  return (
    <>
      <Button full size="lg" leftIcon={<Trophy size={18} />} onClick={handleOpen}>
        대회 참가 · 계측 기록 제출
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="계측 기록 제출">
        <div className="space-y-4">
          {/* 안내 배너 */}
          <div className="flex items-center gap-2 rounded-xl bg-aqua-500/10 px-3 py-2.5 text-[12px] text-aqua-400">
            <ScanLine size={15} className="shrink-0" strokeWidth={1.8} />
            <span>입낚볼(40mm)과 함께 촬영하면 길이가 자동 계측됩니다</span>
          </div>

          {/* 참가비 안내 — 첫 제출 1회만 차감 */}
          {!!entryFee && entryFee > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2.5 text-[12px] text-orange-400">
              <Coins size={15} className="shrink-0" strokeWidth={1.8} />
              <span>참가비 {entryFee.toLocaleString()}P — 첫 기록 제출 시 1회 차감됩니다</span>
            </div>
          )}

          {/* 카메라 / 갤러리 카드 — measure 페이지와 동일한 스타일 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={goMeasure}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-orange-500/50 bg-orange-500/5 py-6 text-orange-500 transition-colors hover:bg-orange-500/10 active:scale-[0.98]"
            >
              <Camera size={26} strokeWidth={1.7} />
              <span className="text-[13px] font-bold">AI 카메라 계측</span>
            </button>
            <button
              type="button"
              onClick={goMeasure}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-navy-200 py-6 text-navy-400 transition-colors hover:border-aqua-400 hover:text-aqua-400 active:scale-[0.98]"
            >
              <Images size={26} strokeWidth={1.7} />
              <span className="text-[13px] font-bold">갤러리 선택</span>
            </button>
          </div>

          <p className="text-center text-[11px] text-navy-300">
            제출 후 관리자 심사를 거쳐 랭킹 순위에 반영됩니다.
          </p>
        </div>
      </Sheet>

      <LoginRequiredModal open={loginModal} onClose={() => setLoginModal(false)} feature="대회 기록 제출" />
    </>
  );
}
