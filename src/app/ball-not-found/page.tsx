import { CircleDashed } from "lucide-react";
import { LinkButton } from "@/components/ui";

export default function BallNotFoundPage() {
  return (
    <div className="animate-fadein flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-navy-50 p-5">
        <CircleDashed className="text-navy-300" size={44} strokeWidth={1.5} />
      </div>
      <h1 className="text-lg font-bold text-navy-800">등록되지 않은 입낚볼이에요</h1>
      <p className="max-w-xs text-sm leading-relaxed text-navy-400">
        유효하지 않거나 아직 활성화되지 않은 볼입니다.
        공식 채널을 통해 구매한 볼인지 확인하고, 문제가 지속되면 관리자에게 문의해 주세요.
      </p>
      <div className="mt-3">
        <LinkButton href="/settings">설정으로 돌아가기</LinkButton>
      </div>
    </div>
  );
}
