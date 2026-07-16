"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Inbox, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, back, right, sub,
}: { title: string; back?: boolean; right?: React.ReactNode; sub?: string }) {
  const router = useRouter();
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-navy-100 bg-white/85 backdrop-blur-md">
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
      ? "bg-navy-700 text-white shadow-soft"
      : "bg-navy-50 text-navy-500 hover:bg-navy-100"
  );
  if (as === "span") return <span className={cls}>{children}</span>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="animate-sheet relative max-h-[88vh] w-full max-w-[640px] overflow-y-auto rounded-t-[20px] bg-white px-4 pb-6 pt-3 shadow-sheet">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy-200" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-navy-900">{title}</h2>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-navy-300 transition-colors hover:bg-navy-50"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-navy-700 text-white shadow-soft hover:bg-navy-800 focus-visible:ring-aqua-300",
  secondary: "bg-aqua-500 text-white shadow-soft hover:bg-aqua-600 focus-visible:ring-aqua-300",
  ghost: "bg-transparent text-navy-700 hover:bg-navy-50",
  danger: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-300",
  outline: "border border-navy-100 bg-white text-navy-700 hover:bg-navy-50",
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
        "inline-flex items-center justify-center gap-2 font-semibold transition-all outline-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-1",
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
    <Link href={href} className={cn("inline-flex items-center justify-center gap-2 rounded-[16px] bg-navy-700 px-4 py-3 text-[15px] font-semibold text-white shadow-soft transition-all outline-none active:scale-[0.97] hover:bg-navy-800 focus-visible:ring-2 focus-visible:ring-aqua-300 focus-visible:ring-offset-1", className)}>
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
  navy: "bg-navy-50 text-navy-600",
  aqua: "bg-aqua-50 text-aqua-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  green: "bg-emerald-50 text-emerald-700",
  gray: "bg-gray-100 text-gray-600",
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
