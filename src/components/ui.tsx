"use client";
import Link from "next/link";
import { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, Inbox, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, back, right, sub,
}: { title: string; back?: boolean; right?: React.ReactNode; sub?: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-[52px] z-30 border-b border-navy-100 bg-[#161616]/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3">
        {back && (
          <button onClick={() => router.back()} aria-label="뒤로" className="-ml-1 rounded-full p-1.5 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold tracking-[-0.01em] text-navy-900">{title}</h1>
          {sub && <p className="truncate text-[11px] text-navy-300">{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="rounded-full bg-navy-50 p-4">
        <Inbox className="text-navy-300" size={36} strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold text-navy-900">{title}</p>
      {desc && <p className="max-w-[280px] text-[13px] leading-relaxed text-navy-300">{desc}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-navy-400">
      <Loader2 className="animate-spin text-aqua-500" size={22} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Chip({ children, active, onClick, as, size = "md" }: { children: React.ReactNode; active?: boolean; onClick?: () => void; as?: "button" | "span"; size?: "sm" | "md" }) {
  const cls = cn(
    "inline-flex items-center whitespace-nowrap rounded-full font-medium transition-all active:scale-[0.97]",
    size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
    active
      ? "bg-orange-500 text-white shadow-soft"
      : "bg-navy-50 text-navy-500 hover:bg-navy-100"
  );
  if (as === "span") return <span className={cls}>{children}</span>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function Sheet({ open, onClose, title, children, stickyContent, size = "lg" }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode;
  /** 제목 아래, 스크롤 영역 위에 고정되는 콘텐츠 (통계 카드 등) */
  stickyContent?: React.ReactNode;
  size?: "lg" | "md" | "diary";
}) {
  // createPortal은 클라이언트에서만 동작하므로 hydration 이후에만 렌더링
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 드래그 닫기 상태
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);
  // 스크롤 영역 ref — scrollTop > 0이면 드래그 닫기 비활성
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartY.current === null) return;
    // 스크롤 영역이 위로 스크롤된 상태면 드래그 닫기 취소 (스크롤 우선)
    if (scrollRef.current && scrollRef.current.scrollTop > 0) {
      dragStartY.current = null;
      if (dragY > 0) setDragY(0);
      return;
    }
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      isDragging.current = true;
      setDragY(dy);
    }
  }
  function handleTouchEnd() {
    if (dragY >= 80) {
      setDragY(0);
      dragStartY.current = null;
      onClose();
    } else {
      setDragY(0);
      dragStartY.current = null;
    }
    isDragging.current = false;
  }

  if (!open || !mounted) return null;

  const maxH = size === "md" ? "max-h-[52vh]" : size === "diary" ? "max-h-[67vh]" : "max-h-[88vh]";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" onClick={onClose} />
      {/* 시트 패널 — 헤더는 고정, 콘텐츠만 스크롤 */}
      <div
        className={`animate-sheet relative flex ${maxH} w-full max-w-[640px] flex-col rounded-t-[20px] border border-white/[0.08] bg-[#1e1e1e] shadow-sheet`}
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined, transition: dragY > 0 ? "none" : "transform 0.2s ease" }}
      >
        {/* 고정 헤더 영역 — 여기서 스와이프하면 시트 닫힘 */}
        <div
          className="flex-shrink-0 select-none px-4 pt-3"
          style={{ touchAction: "none" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden />
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-navy-900">{title}</h2>
            <button onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-navy-300 transition-colors hover:bg-navy-50"><X size={20} /></button>
          </div>
          {/* 고정 섹션 (통계 카드 등) */}
          {stickyContent && <div className="pb-3">{stickyContent}</div>}
        </div>
        {/* 스크롤 가능한 콘텐츠 — scrollTop=0일 때 아래로 당기면 시트 닫힘 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pb-6"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-orange-500 text-white shadow-soft hover:bg-orange-600 focus-visible:ring-orange-400",
  secondary: "bg-aqua-500 text-white shadow-soft hover:bg-aqua-600 focus-visible:ring-aqua-300",
  ghost: "bg-transparent text-navy-700 hover:bg-navy-50",
  danger: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-300",
  outline: "border border-navy-100 bg-[#1e1e1e] text-navy-700 hover:bg-navy-50",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[13px] rounded-[14px]",
  md: "px-4 py-2.5 text-[15px] rounded-[16px]",
  lg: "px-5 py-3 text-base rounded-[16px]",
};

export function Button({
  children, className, variant = "primary", size = "md", full, leftIcon, rightIcon, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all outline-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[#161616]",
        buttonVariants[variant],
        buttonSizes[size],
        full && "w-full",
        className
      )}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

export function PrimaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button {...rest} variant="primary" full className={className}>
      {children}
    </Button>
  );
}

export function LinkButton({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center justify-center gap-2 rounded-[16px] bg-orange-500 px-4 py-3 text-[15px] font-semibold text-white shadow-soft transition-all outline-none active:scale-[0.97] hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#161616]", className)}>
      {children}
    </Link>
  );
}

export function Card({
  children, className, onClick, as = "div",
}: { children: React.ReactNode; className?: string; onClick?: () => void; as?: "div" | "article" }) {
  const Comp = as;
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "card",
        onClick && "cursor-pointer transition-shadow hover:shadow-cardhover active:scale-[0.99]",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

type BadgeTone = "navy" | "aqua" | "amber" | "red" | "green" | "gray";

const badgeTones: Record<BadgeTone, string> = {
  navy: "bg-orange-500/15 text-orange-400",
  aqua: "bg-aqua-500/15 text-aqua-300",
  amber: "bg-amber-500/15 text-amber-300",
  red: "bg-red-500/15 text-red-300",
  green: "bg-emerald-500/15 text-emerald-300",
  gray: "bg-white/[0.07] text-navy-400",
};

export function Badge({ children, tone = "navy", className }: { children: React.ReactNode; tone?: BadgeTone; className?: string }) {
  return <span className={cn("badge", badgeTones[tone], className)}>{children}</span>;
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn("field", className)} {...rest} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn("field min-h-[96px] resize-y", className)} {...rest} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn("field appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
    );
  }
);

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[12px] font-semibold tracking-wide text-navy-400", className)}>{children}</p>;
}
