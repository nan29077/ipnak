"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Send } from "lucide-react";
import { useToast } from "@/components/Toast";
import { timeAgo, cn } from "@/lib/utils";

type Msg = { id: string; senderId: string; body: string; createdAt: string };

export function MarketChatRoom({ chatId, me }: { chatId: string; me: string }) {
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/market/chats/${chatId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
    }
  }, [chatId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await fetch(`/api/market/chats/${chatId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((m) => [...m, data.message]);
      setText("");
    } else {
      toast("메시지를 보내지 못했습니다", "error");
    }
    setSending(false);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-navy-300">대화를 시작해보세요. 예의 바른 거래 문화를 만들어요 🙂</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[76%]", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed",
                    mine ? "rounded-br-md bg-orange-500 text-white" : "rounded-bl-md bg-navy-50 text-navy-800"
                  )}
                >
                  {m.body}
                </div>
                <p className={cn("mt-0.5 text-[10px] text-navy-300", mine ? "text-right" : "text-left")}>{timeAgo(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="pb-safe sticky bottom-0 flex items-center gap-2 border-t border-navy-100 bg-[#161616]/95 px-3 py-2.5 backdrop-blur">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="메시지 입력..."
          className="flex-1 rounded-full border border-navy-100 bg-navy-50 px-4 py-2.5 text-sm text-navy-800 placeholder-navy-300 outline-none transition focus:border-aqua-400 focus:bg-[#1e1e1e] focus:ring-2 focus:ring-aqua-100"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          aria-label="전송"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-soft transition-colors hover:bg-orange-600 disabled:opacity-40"
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
