"use client";
import { createContext, useContext, useCallback, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; msg: string; kind: ToastKind };

const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

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
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#1a1a1a] px-3.5 py-3 text-sm font-medium text-white shadow-card"
            role="status"
          >
            <span
              className={
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
                (t.kind === "success"
                  ? "bg-aqua-400/20 text-aqua-300"
                  : t.kind === "error"
                  ? "bg-red-400/20 text-red-300"
                  : "bg-aqua-300/20 text-aqua-200")
              }
            >
              {t.kind === "success" && <CheckCircle2 size={17} />}
              {t.kind === "error" && <AlertCircle size={17} />}
              {t.kind === "info" && <Info size={17} />}
            </span>
            <span className="min-w-0 flex-1">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
