"use client";
import { Fish } from "lucide-react";
import { useAppSettings } from "@/lib/appSettingsContext";
import { cn } from "@/lib/utils";

/**
 * 배스낚시 전용 모드 안내 배너.
 * 모드가 OFF 이면 아무것도 렌더링하지 않으므로 기존 화면에는 영향이 없다.
 */
export function BassOnlyBanner({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { bassOnlyMode } = useAppSettings();
  if (!bassOnlyMode) return null;

  return (
    <div
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2.5 text-[13px] font-semibold text-orange-400 ring-1 ring-orange-500/20",
        className
      )}
    >
      <Fish size={15} className="shrink-0" />
      <span>{text}</span>
    </div>
  );
}
