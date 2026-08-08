"use client";
/**
 * AI 학습 관리 — 피드 사진 선별 탭
 *
 * 유저가 올린 공개 피드 사진 중 학습에 쓸 사진을 골라 training-data/raw 로 복사한다.
 * 선별 상태는 서버(Setting)에 저장되므로 새로고침해도 유지된다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FolderInput, Loader2, RefreshCw, Info, Eraser } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type FeedImage = {
  id: string;
  url: string;
  postId: string;
  nickname: string;
  species: string;
  createdAt: string;
  isTrainingCandidate: boolean;
  imported: boolean;
};

export function AiTrainingFeedTab() {
  const [items, setItems] = useState<FeedImage[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [onlySelected, setOnlySelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // 목록 로드 실패 여부 — 작업 결과 메시지(msg)와 분리해, 성공하면 자동으로 사라진다
  const [loadError, setLoadError] = useState(false);
  // 페이지를 빠르게 넘길 때 늦게 도착한 이전 응답이 최신 목록을 덮어쓰지 않도록 한다
  const loadSeqRef = useRef(0);

  const load = useCallback(async (p: number, selectedOnly: boolean) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/ai-training/feed-images?page=${p}${selectedOnly ? "&selected=1" : ""}`,
        { cache: "no-store" },
      );
      if (seq !== loadSeqRef.current) return; // 더 최신 요청이 이미 나갔다
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
      setSelectedCount(data.selectedCount ?? 0);
      setLoadError(false);
    } catch {
      if (seq === loadSeqRef.current) setLoadError(true);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, onlySelected); }, [load, page, onlySelected]);

  /** 카드 클릭 → 선정/해제 (낙관적 업데이트 후 서버 반영) */
  async function toggle(item: FeedImage) {
    const next = !item.isTrainingCandidate;
    setItems((prev) => prev.map((i) => (i.url === item.url ? { ...i, isTrainingCandidate: next } : i)));
    setSelectedCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await fetch("/api/admin/ai-training/feed-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: next ? "select" : "deselect", urls: [item.url] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.selectedCount === "number") setSelectedCount(data.selectedCount);
      if (!res.ok) {
        // 실패 시 원복 (선별 개수도 함께 되돌린다)
        setItems((prev) => prev.map((i) => (i.url === item.url ? { ...i, isTrainingCandidate: !next } : i)));
        setSelectedCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    } catch {
      setItems((prev) => prev.map((i) => (i.url === item.url ? { ...i, isTrainingCandidate: !next } : i)));
      setSelectedCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }

  /** 현재 페이지 전체 선택 */
  async function selectPage() {
    const urls = items.filter((i) => !i.isTrainingCandidate).map((i) => i.url);
    if (urls.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai-training/feed-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", urls }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setItems((prev) => prev.map((i) => ({ ...i, isTrainingCandidate: true })));
        setSelectedCount(data.selectedCount ?? selectedCount + urls.length);
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true);
    try {
      await fetch("/api/admin/ai-training/feed-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      setSelectedCount(0);
      await load(page, onlySelected);
    } finally {
      setBusy(false);
    }
  }

  /** 선별된 사진을 학습 폴더로 복사 */
  async function importSelected() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/ai-training/feed-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ?? "복사에 실패했습니다.");
        return;
      }
      setMsg(`학습 폴더로 복사했습니다. 저장 ${data.saved}장 · 중복 ${data.skipped}장 · 실패 ${data.failed}장`);
      await load(page, onlySelected);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="mb-1 text-[15px] font-bold text-navy-800">유저 피드 사진 선별</h2>
        <p className="mb-4 text-[12.5px] text-navy-400">
          공개 게시물의 사진만 표시됩니다. 사진을 눌러 학습 대상으로 선정한 뒤 학습 폴더로 복사하세요.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={importSelected} disabled={busy || selectedCount === 0}
            leftIcon={busy ? <Loader2 size={14} className="animate-spin" /> : <FolderInput size={14} />}>
            선별 {selectedCount}장 학습 폴더로 복사
          </Button>
          <Button size="sm" variant="outline" onClick={selectPage} disabled={busy || loading}>
            이 페이지 전체 선택
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll} disabled={busy || selectedCount === 0}
            leftIcon={<Eraser size={14} />} className="text-red-300">
            선별 초기화
          </Button>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12.5px] text-navy-400">
            <input
              type="checkbox"
              checked={onlySelected}
              onChange={(e) => { setOnlySelected(e.target.checked); setPage(1); }}
              className="h-3.5 w-3.5 accent-orange-500"
            />
            선별한 사진만 보기
          </label>
          <Button size="sm" variant="ghost" onClick={() => load(page, onlySelected)} leftIcon={<RefreshCw size={14} />}>
            새로고침
          </Button>
        </div>

        {msg && <p className="mt-3 text-[12.5px] text-orange-400">{msg}</p>}
        {loadError && <p className="mt-3 text-[12.5px] text-red-300">피드 사진을 불러오지 못했습니다. 새로고침을 눌러 다시 시도해 주세요.</p>}
      </div>

      <div className="card p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-navy-400">
            <Loader2 size={16} className="animate-spin" /> 불러오는 중…
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-navy-400">
            {onlySelected ? "선별한 사진이 없습니다." : "표시할 피드 사진이 없습니다."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item)}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                    item.isTrainingCandidate
                      ? "border-orange-500 ring-2 ring-orange-500/30"
                      : "border-transparent hover:border-white/20",
                  )}
                  title={`${item.nickname}${item.species ? ` · ${item.species}` : ""}`}
                >
                  {/* 학습 후보 썸네일 — next/image 최적화가 필요 없는 관리자 전용 화면 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />

                  {item.isTrainingCandidate && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-gray-900">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                  {item.imported && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-emerald-500/85 px-1.5 py-0.5 text-[10px] font-bold text-gray-900">
                      복사됨
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-[12.5px] text-navy-400">
                {page} / {totalPages} · 전체 {total.toLocaleString()}장
              </span>
              <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </>
        )}
      </div>

      <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-navy-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        회원이 업로드한 사진의 AI 학습 활용은 이용약관 제6조 ③항에 근거합니다.
      </p>
    </div>
  );
}
