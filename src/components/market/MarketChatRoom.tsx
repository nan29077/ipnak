"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { timeAgo, cn } from "@/lib/utils";

type Msg = { id: string; senderId: string; body: string; createdAt: string };

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function MarketChatRoom({
  chatId, me, isOwner, listingId, initialStatus,
}: {
  chatId: string;
  me: string;
  isOwner: boolean;
  listingId: string;
  initialStatus: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [statusBusy, setStatusBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/chats/${chatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch { /* 네트워크 일시 오류 */ }
  }, [chatId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 키보드 등장 시 마지막 메시지로 스크롤
  useEffect(() => {
    function onVpResize() {
      endRef.current?.scrollIntoView({ behavior: "instant" });
    }
    window.visualViewport?.addEventListener("resize", onVpResize);
    return () => window.visualViewport?.removeEventListener("resize", onVpResize);
  }, []);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch(`/api/market/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((m) => [...m, data.message]);
        inputRef.current?.focus();
      } else {
        toast("메시지를 보내지 못했습니다", "error");
        setText(body);
      }
    } catch {
      toast("메시지를 보내지 못했습니다", "error");
      setText(body);
    } finally {
      setSending(false);
    }
  }

  async function sendSystemMsg(body: string) {
    const res = await fetch(`/api/market/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((m) => [...m, data.message]);
    }
  }

  async function changeStatus(next: string) {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/market/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setStatus(next);
        const msgs: Record<string, string> = {
          RESERVED: "[시스템] 판매자가 이 상품을 예약중으로 변경했습니다.",
          SELLING: "[시스템] 판매자가 예약을 취소하고 판매중으로 변경했습니다.",
          SOLD: "[시스템] 거래가 완료됐습니다. 감사합니다! 🎉",
        };
        if (msgs[next]) await sendSystemMsg(msgs[next]);
        toast(next === "RESERVED" ? "예약중으로 변경됐습니다" : next === "SOLD" ? "거래가 완료됐습니다" : "판매중으로 변경됐습니다", "success");
        router.refresh();
      } else {
        toast("상태를 변경하지 못했습니다", "error");
      }
    } catch {
      toast("오류가 발생했습니다", "error");
    } finally {
      setStatusBusy(false);
    }
  }

  async function requestReserve() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/market/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "안녕하세요! 혹시 예약 가능할까요? 구매 희망합니다 🙋" }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((m) => [...m, data.message]);
        toast("예약 요청 메시지를 보냈습니다", "success");
      }
    } catch {
      toast("오류가 발생했습니다", "error");
    } finally {
      setSending(false);
    }
  }

  const isSold = status === "SOLD";
  const isReserved = status === "RESERVED";

  return (
    // flex-1 min-h-0: 부모(fixed inset-0 flex-col)의 남은 공간을 모두 차지하고 내부 스크롤 허용
    <div className="flex flex-1 min-h-0 flex-col">
      {/* 메시지 목록 — 이 영역만 스크롤 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3">
        {messages.length === 0 && (
          <p className="py-12 text-center text-[13px] text-navy-300">
            대화를 시작해보세요.{"\n"}서로 배려하는 거래 문화를 만들어요.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.senderId === me;
          const isSystem = m.body.startsWith("[시스템]");
          const showDate = i === 0 || !isSameDay(messages[i - 1].createdAt, m.createdAt);
          const isFirst = i === 0 || messages[i - 1].senderId !== m.senderId || showDate;
          const isLast = i === messages.length - 1 || messages[i + 1].senderId !== m.senderId || !isSameDay(m.createdAt, messages[i + 1].createdAt);

          return (
            <div key={m.id}>
              {showDate && (
                <div className="flex items-center gap-2 py-4">
                  <div className="h-px flex-1 bg-navy-100/20" />
                  <span className="text-[11px] text-navy-300">{formatDateLabel(m.createdAt)}</span>
                  <div className="h-px flex-1 bg-navy-100/20" />
                </div>
              )}
              {isSystem ? (
                <div className="py-2 text-center">
                  <span className="inline-block rounded-full bg-navy-50/20 px-3 py-1 text-[11px] text-navy-300">
                    {m.body.replace("[시스템] ", "")}
                  </span>
                </div>
              ) : (
                <div className={cn("flex mb-0.5", mine ? "justify-end" : "justify-start", isFirst ? "mt-3" : "mt-0.5")}>
                  <div className={cn("flex max-w-[76%] flex-col gap-0.5", mine ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "px-3.5 py-2.5 text-[14px] leading-relaxed",
                        mine
                          ? "bg-orange-500 text-white"
                          : "bg-[#1e3148] text-navy-800",
                        // 말풍선 모양
                        mine
                          ? cn("rounded-2xl", isFirst && "rounded-tr-md", isLast && "rounded-br-md")
                          : cn("rounded-2xl", isFirst && "rounded-tl-md", isLast && "rounded-bl-md"),
                      )}
                    >
                      {m.body}
                    </div>
                    {isLast && (
                      <p className="text-[10px] text-navy-300">{timeAgo(m.createdAt)}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* 판매자 액션 버튼 (판매완료 전에만 노출) */}
      {isOwner && !isSold && (
        <div className="border-t border-navy-100/20 bg-[#0a1220] px-3 py-2">
          <div className="flex gap-2">
            {!isReserved ? (
              <button
                onClick={() => changeStatus("RESERVED")}
                disabled={statusBusy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 py-2.5 text-[13px] font-semibold text-amber-400 transition-colors active:bg-amber-400/20 disabled:opacity-50"
              >
                {statusBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                이 분과 예약하기
              </button>
            ) : (
              <button
                onClick={() => changeStatus("SELLING")}
                disabled={statusBusy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-navy-100/20 bg-navy-50/10 py-2.5 text-[13px] font-semibold text-navy-400 transition-colors active:bg-navy-50/20 disabled:opacity-50"
              >
                {statusBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                예약 취소
              </button>
            )}
            <button
              onClick={() => changeStatus("SOLD")}
              disabled={statusBusy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-aqua-400/30 bg-aqua-400/10 py-2.5 text-[13px] font-semibold text-aqua-400 transition-colors active:bg-aqua-400/20 disabled:opacity-50"
            >
              {statusBusy ? <Loader2 size={14} className="animate-spin" /> : null}
              거래 완료
            </button>
          </div>
        </div>
      )}

      {/* 구매자 예약 요청 버튼 (SELLING일 때만) */}
      {!isOwner && !isReserved && !isSold && (
        <div className="border-t border-navy-100/20 bg-[#0a1220] px-3 py-2">
          <button
            onClick={requestReserve}
            disabled={sending}
            className="w-full rounded-xl border border-orange-400/30 bg-orange-400/10 py-2.5 text-[13px] font-semibold text-orange-400 transition-colors active:bg-orange-400/20 disabled:opacity-50"
          >
            예약 요청하기
          </button>
        </div>
      )}

      {/* 메시지 입력 — shrink-0으로 하단 고정, safe-area로 홈 인디케이터 위 여백 확보 */}
      <div
        className="shrink-0 flex items-center gap-2 border-t border-navy-100/20 bg-[#0d1b2a] px-3 pt-2.5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="메시지 입력..."
          style={{ fontSize: "16px" }}
          className="flex-1 min-w-0 rounded-full border border-navy-100/30 bg-[#162538] px-4 py-2.5 text-navy-800 placeholder-navy-300 outline-none transition focus:border-aqua-400/50"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          aria-label="전송"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-soft transition-colors hover:bg-orange-600 active:scale-95 disabled:opacity-40"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>
    </div>
  );
}
