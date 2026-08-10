"use client";
/**
 * AI 학습 관리 — 라벨링 탭
 *
 * 서브탭 2개를 제공하고 관리자가 필요에 따라 고른다 (같은 이미지 풀을 공유).
 *  - 직접 라벨링 : 입낚 관리자 캔버스에서 박스를 그린다 (YoloLabeler)
 *  - Roboflow 연동 : 선별 이미지를 Roboflow 프로젝트로 보내 전문 툴에서 작업한다
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Loader2, RefreshCw, Download, Trash2, ExternalLink, Save, Upload, CheckCircle2,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { YoloLabeler } from "./YoloLabeler";

type RawImage = {
  name: string;
  size: number;
  modifiedAt: string;
  labeled: boolean;
  boxCount: number;
};

type Filter = "all" | "unlabeled" | "labeled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "unlabeled", label: "미라벨" },
  { key: "labeled", label: "라벨 완료" },
];

export function AiTrainingLabelTab() {
  const [sub, setSub] = useState<"native" | "roboflow">("native");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <SubTab active={sub === "native"} onClick={() => setSub("native")}>직접 라벨링</SubTab>
        <SubTab active={sub === "roboflow"} onClick={() => setSub("roboflow")}>Roboflow 연동</SubTab>
      </div>
      {sub === "native" ? <NativeLabeling /> : <RoboflowPanel />}
    </div>
  );
}

function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors",
        active ? "bg-orange-500 text-gray-900" : "bg-white/[0.05] text-navy-400 hover:bg-white/[0.09]",
      )}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── 직접 라벨링 ───────────────────────── */

function NativeLabeling() {
  const [items, setItems] = useState<RawImage[]>([]);
  const [counts, setCounts] = useState({ all: 0, labeled: 0, unlabeled: 0 });
  const [filter, setFilter] = useState<Filter>("unlabeled");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");
  // 라벨러에 저장 안 된 박스가 있는지 (이미지 전환 시 유실 경고용)
  const dirtyRef = useRef(false);
  // 페이지를 빠르게 넘길 때 늦게 도착한 이전 응답이 최신 목록을 덮어쓰지 않도록 한다
  const loadSeqRef = useRef(0);

  const load = useCallback(async (f: Filter, p: number) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-training/images?filter=${f}&page=${p}`, { cache: "no-store" });
      if (seq !== loadSeqRef.current) return; // 더 최신 요청이 이미 나갔다
      if (!res.ok) return;
      const data = await res.json();
      if (seq !== loadSeqRef.current) return;
      const list: RawImage[] = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      setTotalPages(data.totalPages ?? 1);
      setCounts(data.counts ?? { all: 0, labeled: 0, unlabeled: 0 });
      // 선택된 이미지가 목록에서 사라졌으면 첫 장으로 옮긴다
      setCurrent((cur) => (cur && list.some((i) => i.name === cur) ? cur : list[0]?.name ?? null));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter, page); }, [load, filter, page]);

  /** 라벨 저장 후 목록 상태만 갱신 (선택 이미지는 유지) */
  function handleSaved(name: string, boxCount: number) {
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, labeled: true, boxCount } : i)));
    setCounts((c) => {
      const wasLabeled = items.find((i) => i.name === name)?.labeled;
      if (wasLabeled) return c;
      return { ...c, labeled: c.labeled + 1, unlabeled: Math.max(0, c.unlabeled - 1) };
    });
  }

  /** 저장 안 된 박스가 있으면 이동 전에 확인받는다 (작업 유실 방지) */
  function confirmLeaveDirty(): boolean {
    if (!dirtyRef.current) return true;
    return window.confirm("저장하지 않은 라벨이 있습니다. 다른 이미지로 이동하면 사라집니다. 계속할까요?");
  }

  /** 썸네일 클릭 → 라벨링 대상 변경 */
  function selectImage(name: string) {
    if (name === current) return;
    if (!confirmLeaveDirty()) return;
    setCurrent(name);
  }

  /** 다음 미라벨 이미지로 이동 (연속 작업용) */
  function goNext() {
    const idx = items.findIndex((i) => i.name === current);
    const next = items.slice(idx + 1).find((i) => (filter === "unlabeled" ? !i.labeled : true)) ?? items[idx + 1];
    if (next && confirmLeaveDirty()) setCurrent(next.name);
  }

  async function removeImage(name: string) {
    if (!window.confirm(`${name} 을(를) 삭제할까요? 라벨 파일도 함께 삭제됩니다.`)) return;
    await fetch(`/api/admin/ai-training/images/${encodeURIComponent(name)}`, { method: "DELETE" }).catch(() => {});
    await load(filter, page);
  }

  async function exportZip() {
    setExporting(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/ai-training/export?save=1", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(err?.error ?? "내보내기에 실패했습니다.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const nameMatch = disposition.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nameMatch?.[1] ?? "ipnak-yolo.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(
        `내보내기 완료 — train ${res.headers.get("X-Train-Count") ?? "?"}장 · val ${res.headers.get("X-Val-Count") ?? "?"}장`,
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={cn(
                "rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                filter === f.key ? "bg-white/[0.12] text-navy-800" : "text-navy-400 hover:bg-white/[0.05]",
              )}
            >
              {f.label} {f.key === "all" ? counts.all : f.key === "labeled" ? counts.labeled : counts.unlabeled}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => load(filter, page)} leftIcon={<RefreshCw size={14} />}>
            새로고침
          </Button>
          <Button size="sm" onClick={exportZip} disabled={exporting || counts.labeled === 0}
            leftIcon={exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            className="ml-auto">
            YOLO 학습셋 내보내기
          </Button>
        </div>

        {msg && <p className="mb-2 text-[12.5px] text-orange-400">{msg}</p>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-navy-400">
            <Loader2 size={16} className="animate-spin" /> 불러오는 중…
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-navy-400">
            해당 조건의 이미지가 없습니다. 데이터 수집 탭에서 먼저 이미지를 모아 주세요.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
              {items.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => selectImage(item.name)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                    current === item.name ? "border-orange-500" : "border-transparent hover:border-white/20",
                  )}
                  title={item.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/ai-training/images/${encodeURIComponent(item.name)}`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {item.labeled && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-gray-900">
                      {item.boxCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-center gap-3">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-[12.5px] text-navy-400">{page} / {totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </>
        )}
      </div>

      {current && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14px] font-bold text-navy-800">{current}</h3>
            <Button size="sm" variant="ghost" onClick={goNext} className="ml-auto">다음 이미지</Button>
            <Button size="sm" variant="ghost" onClick={() => removeImage(current)}
              leftIcon={<Trash2 size={13} />} className="text-red-300">
              이미지 삭제
            </Button>
          </div>
          <YoloLabeler
            key={current}
            imageName={current}
            onSaved={(boxCount) => handleSaved(current, boxCount)}
            onDirtyChange={(d) => { dirtyRef.current = d; }}
          />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Roboflow 연동 ───────────────────────── */

function RoboflowPanel() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [project, setProject] = useState("");
  const [configured, setConfigured] = useState(false);
  const [onlyUnlabeled, setOnlyUnlabeled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  // "이어서 업로드" 시작 위치 — 전송 옵션이 바뀌면 처음부터 다시 센다
  const [nextOffset, setNextOffset] = useState(0);
  // 자동 전송 상태
  const [autoRunning, setAutoRunning] = useState(false);
  const autoStopRef = useRef(false);
  const [autoProgress, setAutoProgress] = useState({ uploaded: 0, failed: 0, total: 0 });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-training/roboflow", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      setConfigured(Boolean(d.configured));
      setApiKeyMasked(d.apiKeyMasked ?? "");
      setWorkspace(d.workspace ?? "");
      setProject(d.project ?? "");
    } catch {
      /* 무시 */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/ai-training/roboflow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, workspace, project }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d?.error ?? "저장에 실패했습니다.");
        return;
      }
      setApiKey("");
      setMsg("Roboflow 설정을 저장했습니다.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function uploadOnce(offset: number): Promise<{ uploaded: number; failed: number; remaining: number; nextOffset: number; errors: string[] }> {
    const res = await fetch("/api/admin/ai-training/roboflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onlyUnlabeled, offset }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d?.error ?? "업로드에 실패했습니다.");
    return {
      uploaded: d.uploaded ?? 0,
      failed: d.failed ?? 0,
      remaining: d.remaining ?? 0,
      nextOffset: d.nextOffset ?? 0,
      errors: Array.isArray(d.errors) ? d.errors : [],
    };
  }

  async function upload() {
    setUploading(true);
    setMsg("");
    try {
      const result = await uploadOnce(nextOffset);
      setNextOffset(result.remaining > 0 ? result.nextOffset : 0);
      const rest = result.remaining > 0 ? ` (남은 ${result.remaining}장은 다시 눌러 이어서 업로드)` : "";
      const errs = result.failed > 0 && result.errors.length > 0 ? ` · ${result.errors.join(" / ")}` : "";
      setMsg(`업로드 ${result.uploaded}장 · 실패 ${result.failed}장${rest}${errs}`);
    } catch (e: any) {
      setMsg(e?.message ?? "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function startAutoUpload() {
    autoStopRef.current = false;
    setAutoRunning(true);
    setAutoProgress({ uploaded: 0, failed: 0, total: 0 });
    setMsg("");
    let offset = 0;
    let totalUploaded = 0;
    let totalFailed = 0;
    try {
      while (!autoStopRef.current) {
        const result = await uploadOnce(offset);
        totalUploaded += result.uploaded;
        totalFailed += result.failed;
        setAutoProgress((p) => ({ ...p, uploaded: totalUploaded, failed: totalFailed }));
        if (result.remaining === 0) {
          setMsg(`자동 전송 완료 — 업로드 ${totalUploaded}장 · 실패 ${totalFailed}장`);
          setNextOffset(0);
          break;
        }
        offset = result.nextOffset;
        setNextOffset(offset);
      }
      if (autoStopRef.current) {
        setMsg(`전송 중단 — 업로드 ${totalUploaded}장 · 실패 ${totalFailed}장`);
      }
    } catch (e: any) {
      setMsg(`오류: ${e?.message ?? "업로드 실패"} (업로드 ${totalUploaded}장 완료)`);
    } finally {
      setAutoRunning(false);
    }
  }

  function stopAutoUpload() {
    autoStopRef.current = true;
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="mb-1 text-[15px] font-bold text-navy-800">Roboflow 연동</h2>
        <p className="mb-4 text-[12.5px] text-navy-400">
          수집한 이미지를 Roboflow 프로젝트로 보내 전문 라벨링 툴에서 작업합니다.
          API Key 는 서버에만 저장되며 화면에는 마스킹되어 표시됩니다.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-navy-400">
              API Key {configured && <span className="text-emerald-300">· 저장됨 {apiKeyMasked}</span>}
            </span>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={configured ? "변경할 때만 입력" : "Roboflow Private API Key"}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-navy-400">워크스페이스 (선택)</span>
            <Input value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="예: ipnak" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-navy-400">프로젝트 ID</span>
            <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="예: ipnak-fish-detect" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving}
            leftIcon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
            설정 저장
          </Button>
          <a
            href="https://app.roboflow.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold text-navy-400 transition-colors hover:bg-white/[0.05]"
          >
            Roboflow 열기 <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 text-[14px] font-bold text-navy-800">이미지 전송</h3>
        <p className="mb-3 text-[12.5px] text-navy-400">
          한 번에 최대 50장씩 전송합니다. 남은 장수가 있으면 버튼을 다시 눌러 이어서 보내세요.
        </p>
        <label className="mb-3 flex cursor-pointer items-center gap-1.5 text-[12.5px] text-navy-400">
          <input
            type="checkbox"
            checked={onlyUnlabeled}
            onChange={(e) => { setOnlyUnlabeled(e.target.checked); setNextOffset(0); }}
            className="h-3.5 w-3.5 accent-orange-500"
          />
          아직 라벨이 없는 이미지만 전송
        </label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={upload} disabled={uploading || autoRunning || !configured}
            leftIcon={uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}>
            Roboflow 로 전송
          </Button>
          {!autoRunning ? (
            <Button size="sm" onClick={startAutoUpload} disabled={uploading || !configured}
              leftIcon={<Upload size={14} />}
              className="bg-emerald-600 hover:bg-emerald-500">
              전체 자동 전송
            </Button>
          ) : (
            <Button size="sm" onClick={stopAutoUpload}
              leftIcon={<Loader2 size={14} className="animate-spin" />}
              className="bg-red-600 hover:bg-red-500">
              중단 ({autoProgress.uploaded}장 완료)
            </Button>
          )}
        </div>
        {!configured && (
          <p className="mt-2 text-[12px] text-navy-400">설정을 먼저 저장해야 전송할 수 있습니다.</p>
        )}
        {msg && (
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-orange-400">
            <CheckCircle2 size={14} /> {msg}
          </p>
        )}
      </div>
    </div>
  );
}
