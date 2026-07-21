"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 모니터링 연동을 위해 콘솔에 기록
    console.error(error);
  }, [error]);

  return (
    <div className="animate-fadein flex min-h-[70vh] items-center justify-center px-4">
      <Card className="flex w-full max-w-sm flex-col items-center gap-3 p-8 text-center">
        <div className="rounded-full bg-red-50 p-5">
          <TriangleAlert className="text-red-500" size={40} strokeWidth={1.6} />
        </div>
        <h1 className="text-lg font-bold text-navy-800">문제가 발생했어요</h1>
        <p className="max-w-xs text-sm leading-relaxed text-navy-400">
          페이지를 불러오는 중 오류가 생겼어요. 잠시 후 다시 시도해 주세요.
        </p>
        <Button onClick={reset} leftIcon={<RotateCcw size={18} />} className="mt-2">
          다시 시도
        </Button>
      </Card>
    </div>
  );
}
