/**
 * 등록되지 않은 입낚볼 / 입낚키링 안내
 * - /ball?id=XXX, /keyring?id=XXX, /ball/XXX 에서 레지스트리 검증에 실패하면 여기로 온다.
 * - ?type=keyring 이면 키링 문구로 바뀐다 (기본값은 기존과 동일한 볼).
 */
import { CircleDashed, KeyRound } from "lucide-react";
import { LinkButton } from "@/components/ui";

export default function BallNotFoundPage({
  searchParams,
}: {
  searchParams?: { ballId?: string; type?: string };
}) {
  const isKeyring = searchParams?.type === "keyring";
  const label = isKeyring ? "입낚키링" : "입낚볼";
  const shortLabel = isKeyring ? "키링" : "볼";
  const scannedId = (searchParams?.ballId ?? "").trim();
  const Icon = isKeyring ? KeyRound : CircleDashed;

  return (
    <div className="animate-fadein flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-navy-50 p-5">
        <Icon className="text-navy-300" size={44} strokeWidth={1.5} />
      </div>
      <h1 className="text-lg font-bold text-navy-800">등록되지 않은 {label}이에요</h1>
      {scannedId && (
        <p className="rounded-lg border border-navy-100 bg-surface-200 px-3 py-1.5 font-mono text-[13px] font-bold tracking-wider text-navy-400">
          {scannedId}
        </p>
      )}
      <p className="max-w-xs text-sm leading-relaxed text-navy-400">
        유효하지 않거나 아직 활성화되지 않은 {shortLabel}입니다.
        공식 채널을 통해 구매한 {shortLabel}인지 확인하고, 문제가 지속되면 관리자에게 문의해 주세요.
      </p>
      <div className="mt-3">
        <LinkButton href="/settings">설정으로 돌아가기</LinkButton>
      </div>
    </div>
  );
}
