"use client";
import { createContext, useContext, useCallback, useState } from "react";
import { Fish, AlertCircle, Waves, type LucideIcon } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; msg: string; kind: ToastKind };

const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

const kindConfig: Record<
  ToastKind,
  { bar: string; iconWrap: string; Icon: LucideIcon }
> = {
  success: {
    bar: "bg-gradient-to-b from-aqua-300 via-aqua-500 to-aqua-600",
    iconWrap: "bg-aqua-500/15 text-aqua-400",
    Icon: Fish,
  },
  error: {
    bar: "bg-gradient-to-b from-red-400 via-red-500 to-red-600",
    iconWrap: "bg-red-500/15 text-red-400",
    Icon: AlertCircle,
  },
  info: {
    bar: "bg-gradient-to-b from-aqua-300/70 via-blue-400/70 to-aqua-600/60",
    iconWrap: "bg-aqua-400/10 text-aqua-300",
    Icon: Waves,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed left-1/2 bottom-24 z-[1000] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 md:bottom-8">
        {toasts.map((t) => {
          const { bar, iconWrap, Icon } = kindConfig[t.kind];
          return (
            <div
              key={t.id}
              className="animate-toast flex items-stretch overflow-hidden rounded-2xl shadow-lg ring-1 ring-aqua-500/[0.08]"
              style={{ background: "linear-gradient(135deg,#0d1e2c 0%,#18262e 100%)" }}
              role="status"
            >
              {/* 좌측 컬러 웨이브 바 */}
              <div className={`w-[3px] shrink-0 rounded-l-full ${bar}`} />

              <div className="flex flex-1 items-center gap-2.5 px-3.5 py-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconWrap}`}
                >
                  <Icon size={15} strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-white">
                  {t.msg}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
