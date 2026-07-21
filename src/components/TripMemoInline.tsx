"use client";
import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";

interface Props {
  tripId: string;
  initialMemo: string | null;
}

const lsKey = (id: string) => `ipnak_memo_${id}`;

export default function TripMemoInline({ tripId, initialMemo }: Props) {
  const [memo, setMemo] = useState<string | null>(initialMemo);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 마운트 시 localStorage → 서버 API 순으로 메모 로드
  useEffect(() => {
    if (initialMemo !== null) return;
    // 1) localStorage에서 즉시 로드 (빠른 표시)
    try {
      const local = localStorage.getItem(lsKey(tripId));
      if (local) setMemo(local);
    } catch {}
    // 2) 서버에서 확인 (db push 완료 후 정규 저장값 사용)
    fetch(`/api/trips/${tripId}/memo`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.memo != null) {
          setMemo(d.memo);
          try { localStorage.setItem(lsKey(tripId), d.memo); } catch {}
        }
      })
      .catch(() => {});
  }, [tripId, initialMemo]);

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(memo ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditing(false);
  }

  async function save(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    const trimmed = draft.trim();
    // 낙관적 업데이트 (즉시 표시 + localStorage 저장)
    setMemo(trimmed);
    setEditing(false);
    try { localStorage.setItem(lsKey(tripId), trimmed); } catch {}
    // 서버 저장 시도 (db push 완료 후 영구 저장)
    setSaving(true);
    try {
      await fetch(`/api/trips/${tripId}/memo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: trimmed }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 30))}
          onKeyDown={(e) => {
            if (e.key === "Enter") save(e as any);
            if (e.key === "Escape") cancel(e as any);
          }}
          placeholder="메모 (30자)"
          maxLength={30}
          className="w-[120px] rounded-lg border border-orange-400 bg-[#111] px-2 py-0.5 text-[11px] text-white outline-none placeholder:text-navy-400"
        />
        <button
          onClick={save}
          disabled={saving}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white"
        >
          <Check size={11} strokeWidth={2.5} />
        </button>
        <button
          onClick={cancel}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-100/20 text-navy-400"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-navy-100/10"
    >
      {memo ? (
        <span className="max-w-[100px] truncate text-[11px] text-navy-400">{memo}</span>
      ) : (
        <span className="text-[11px] text-navy-500/40">메모</span>
      )}
      <Pencil size={10} className="shrink-0 text-navy-500/40" strokeWidth={1.8} />
    </button>
  );
}
