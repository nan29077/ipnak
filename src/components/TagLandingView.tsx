"use client";
/**
 * NFC 태그 URL 랜딩 화면 (/ball?id=XXX, /keyring?id=XXX)
 *
 * 서버 컴포넌트가 판별한 상태에 따라 두 가지 화면만 그린다.
 * - status "new"   : "이 볼(키링)을 등록하시겠습니까?" 확인 → 등록 후 계측 화면으로 이동
 * - status "taken" : "다른 사용자의 볼입니다" 안내
 *
 * ("mine"/"invalid" 은 서버에서 곧장 리디렉션하므로 여기까지 오지 않는다)
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDashed, KeyRound, Loader2, ShieldAlert, Check, ChevronLeft } from "lucide-react";
import { useToast } from "@/components/Toast";
import type { TagKind } from "@/lib/nfcTag";

type Props = {
  kind: TagKind;
  id: string;
  status: "new" | "taken";
};

export function TagLandingView({ kind, id, status }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [registering, setRegistering] = useState(false);

  const label = kind === "ball" ? "입낚볼" : "입낚키링";
  const shortLabel = kind === "ball" ? "볼" : "키링";
  const Icon = kind === "ball" ? CircleDashed : KeyRound;
  /** 등록 후 이동할 계측 화면 — 태그한 ID 가 선택된 상태로 열린다 */
  const measureHref = `/measure?${kind === "ball" ? "ballId" : "keyringId"}=${encodeURIComponent(id)}&fromTag=1`;

  async function register() {
    setRegistering(true);
    try {
      const res = await fetch(kind === "ball" ? "/api/balls" : "/api/keyrings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "ball" ? { ballId: id } : { keyringId: id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error || `${shortLabel} 등록에 실패했어요.`, "error");
        return;
      }
      toast(`${label}(${id}) 연동 완료`, "success");
      router.replace(measureHref);
    } catch {
      toast("네트워크 오류가 발생했어요.", "error");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="animate-fadein mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <span
        className={
          "flex h-[72px] w-[72px] items-center justify-center rounded-[22px] ring-4 " +
          (status === "taken"
            ? "bg-red-500/12 text-red-400 ring-red-500/10"
            : "bg-orange-500/15 text-orange-500 ring-orange-500/10")
        }
      >
        {status === "taken" ? <ShieldAlert size={30} strokeWidth={1.6} /> : <Icon size={30} strokeWidth={1.6} />}
      </span>

      <h1 className="mt-5 text-[18px] font-extrabold tracking-tight text-navy-900">
        {status === "taken" ? `다른 사용자의 ${shortLabel}입니다` : `이 ${label}을 등록하시겠습니까?`}
      </h1>

      <div className="mt-3 rounded-xl border border-navy-100 bg-surface-200 px-4 py-2.5">
        <p className="text-[11px] font-semibold text-navy-300">{shortLabel} ID</p>
        <p className="font-mono text-[16px] font-extrabold tracking-widest text-aqua-300">{id}</p>
      </div>

      <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-navy-400">
        {status === "taken" ? (
          <>
            이 {shortLabel}은 이미 다른 계정에 연동되어 있어요.
            <br />
            본인의 {label}이라면 기존 계정에서 연동을 해제한 뒤 다시 태그해 주세요.
          </>
        ) : (
          <>
            내 계정에 이 {label}을 연결하면
            <br />
            앞으로 태그할 때마다 바로 AI 계측 화면이 열려요.
          </>
        )}
      </p>

      <div className="mt-6 w-full space-y-2">
        {status === "new" ? (
          <>
            <button
              type="button"
              onClick={register}
              disabled={registering}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-3 text-[14px] font-bold text-gray-900 transition-colors hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
            >
              {registering ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.4} />}
              {registering ? "등록 중..." : "등록하기"}
            </button>
            <button
              type="button"
              onClick={() => router.replace("/measure")}
              disabled={registering}
              className="flex w-full items-center justify-center rounded-[14px] border border-navy-100 py-3 text-[14px] font-semibold text-navy-400 transition-colors hover:text-navy-600 disabled:opacity-60"
            >
              나중에 하기
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => router.replace("/measure")}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-3 text-[14px] font-bold text-gray-900 transition-colors hover:bg-orange-600 active:scale-[0.98]"
            >
              AI 측정 화면으로 가기
            </button>
            <button
              type="button"
              onClick={() => router.replace("/me")}
              className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-navy-100 py-3 text-[14px] font-semibold text-navy-400 transition-colors hover:text-navy-600"
            >
              <ChevronLeft size={15} strokeWidth={2.2} />
              마이페이지에서 연동 관리
            </button>
          </>
        )}
      </div>
    </div>
  );
}
