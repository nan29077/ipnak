"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, Loader2, Inbox } from "lucide-react";
import { timeAgo, cn } from "@/lib/utils";

type Noti = { id: string; type: string; body: string; read: boolean; createdAt: string };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch { /* noop */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  async function markAll() {
    if (unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
  }

  async function markOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="알림"
        aria-expanded={open}
        className="relative rounded-full p-2 text-navy-700 transition-colors hover:bg-navy-50 active:bg-navy-100"
      >
        <Bell size={21} strokeWidth={1.9} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#161616]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-scalein absolute right-0 top-12 z-50 w-[320px] max-w-[88vw] overflow-hidden rounded-2xl border border-navy-100 bg-[#1e1e1e] shadow-sheet">
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
            <p className="text-sm font-bold text-navy-900">알림</p>
            {unread > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-400">
                <Check size={13} /> 모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-navy-400">
                <Loader2 size={18} className="animate-spin text-orange-500" /> <span className="text-sm">불러오는 중...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <div className="rounded-full bg-navy-50 p-3"><Inbox size={26} className="text-navy-300" strokeWidth={1.5} /></div>
                <p className="text-[13px] text-navy-400">새 알림이 없습니다</p>
              </div>
            ) : (
              <ul className="divide-y divide-navy-50">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => !n.read && markOne(n.id)}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-navy-50",
                        !n.read && "bg-orange-500/[0.06]"
                      )}
                    >
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-orange-500")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-snug text-navy-800">{n.body}</span>
                        <span className="mt-0.5 block text-[11px] text-navy-300">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
