import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="animate-fadein flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-navy-50 p-5">
        <Compass className="text-navy-300" size={44} strokeWidth={1.5} />
      </div>
      <h1 className="text-lg font-bold text-navy-800">페이지를 찾을 수 없어요</h1>
      <p className="max-w-xs text-sm leading-relaxed text-navy-400">
        요청하신 페이지가 없거나 이동되었어요. 주소를 다시 확인해 주세요.
      </p>
      <div className="mt-3">
        <LinkButton href="/">홈으로</LinkButton>
      </div>
    </div>
  );
}
