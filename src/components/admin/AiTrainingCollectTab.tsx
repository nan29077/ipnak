"use client";
/**
 * AI 학습 관리 — 데이터 수집 탭
 *
 * iNaturalist 공개 관찰 사진을 어종 키워드로 자동 수집한다.
 * 수집은 서버에서 백그라운드로 돌고, 이 화면은 진행 상황을 1.5초마다 폴링한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Info, Upload, FileArchive } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type CollectState = {
  running: boolean;
  keyword: string;
  requested: number;
  saved: number;
  skipped: number;
  failed: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
};

type HistoryItem = {
  id: string;
  source: "inaturalist" | "feed";
  keyword: string;
  requested: number;
  saved: number;
  skipped: number;
  failed: number;
  startedAt: string;
  finishedAt: string;
};

const PRESETS = [
  { value: "korea", label: "한국 어류 10종 (배스·붕어·광어·우럭 등)" },
  { value: "all", label: "전체 어류 (조기어강)" },
  { value: "custom", label: "커스텀 키워드 (학명 직접 입력)" },
];

const COUNTS = [100, 500, 1000];

function fmtDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AiTrainingCollectTab() {
  const [preset, setPreset] = useState("korea");
  const [keyword, setKeyword] = useState("");
  const [count, setCount] = useState(100);
  const [customCount, setCustomCount] = useState("");
  const [state, setState] = useState<CollectState | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-training/collect-status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setState(data.state ?? null);
      setHistory(Array.isArray(data.history) ? data.history : []);
      setRawCount(data.stats?.rawCount ?? 0);
    } catch {
      /* 폴링 실패는 조용히 무시 (다음 틱에 재시도) */
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 1500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  async function start() {
    setBusy(true);
    setMsg("");
    try {
      const finalCount = customCount ? Math.max(1, Math.min(2000, Number(customCount) || 0)) : count;
      const body =
        preset === "custom"
          ? { keyword: keyword.trim(), count: finalCount }
          : { preset, count: finalCount };
      if (preset === "custom" && !keyword.trim()) {
        setMsg("어종 학명을 입력해 주세요. (예: Micropterus salmoides)");
        return;
      }
      const res = await fetch("/api/admin/ai-training/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ?? "수집을 시작하지 못했습니다.");
        return;
      }
      setMsg("수집을 시작했습니다.");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function forceStop() {
    await fetch("/api/admin/ai-training/collect-status", { method: "DELETE" }).catch(() => {});
    load();
  }

  const running = state?.running === true;
  const done = state ? state.saved + state.skipped + state.failed : 0;
  const percent = state && state.requested > 0 ? Math.min(100, Math.round((done / state.requested) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* ── 수집 설정 ── */}
      <div className="card p-5">
        <h2 className="mb-1 text-[15px] font-bold text-navy-800">iNaturalist 자동 수집</h2>
        <p className="mb-4 text-[12.5px] text-navy-400">
          전 세계 관찰 기록에서 연구등급(research grade) 물고기 사진을 내려받습니다.
          재사용 가능한 CC 라이선스 사진만 수집합니다.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-navy-400">어종 선택</span>
            <Select value={preset} onChange={(e) => setPreset(e.target.value)} disabled={running}>
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-navy-400">수집 수량</span>
            <div className="flex gap-2">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={running}
                  onClick={() => { setCount(c); setCustomCount(""); }}
                  className={cn(
                    "flex-1 rounded-xl border px-2 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50",
                    !customCount && count === c
                      ? "border-orange-500 bg-orange-500/15 text-orange-400"
                      : "border-navy-100 text-navy-400 hover:bg-white/[0.04]",
                  )}
                >
                  {c}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={2000}
                placeholder="직접"
                value={customCount}
                disabled={running}
                onChange={(e) => setCustomCount(e.target.value)}
                className="w-[86px]"
              />
            </div>
          </label>
        </div>

        {preset === "custom" && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[12px] font-semibold text-navy-400">
              어종 학명 (쉼표로 여러 종 지정 가능)
            </span>
            <Input
              value={keyword}
              disabled={running}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: Micropterus salmoides, Carassius auratus"
            />
          </label>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={start} disabled={busy || running} leftIcon={running ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}>
            {running ? "수집 중…" : "수집 시작"}
          </Button>
          <Button variant="ghost" onClick={load} leftIcon={<RefreshCw size={14} />}>새로고침</Button>
          {running && (
            <Button variant="ghost" onClick={forceStop} className="text-red-300">
              상태 초기화
            </Button>
          )}
          <span className="ml-auto text-[12.5px] text-navy-400">
            현재 원본 이미지 <b className="text-navy-800">{rawCount.toLocaleString()}</b>장
          </span>
        </div>

        {msg && <p className="mt-3 text-[12.5px] text-orange-400">{msg}</p>}
      </div>

      {/* ── 진행 상황 ── */}
      {state && state.startedAt && (
        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2">
            {running ? (
              <Loader2 size={16} className="animate-spin text-orange-400" />
            ) : state.error ? (
              <AlertTriangle size={16} className="text-red-300" />
            ) : (
              <CheckCircle2 size={16} className="text-emerald-300" />
            )}
            <h3 className="text-[14px] font-bold text-navy-800">
              {state.keyword || "수집"} · {state.message || (running ? "진행 중" : "완료")}
            </h3>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-orange-500 transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <Stat label="저장" value={state.saved} tone="text-emerald-300" />
            <Stat label="중복" value={state.skipped} tone="text-navy-400" />
            <Stat label="실패" value={state.failed} tone="text-red-300" />
            <Stat label="목표" value={state.requested} tone="text-navy-800" />
          </div>

          {state.error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{state.error}</p>
          )}
          <p className="mt-2 text-[11.5px] text-navy-400">
            시작 {fmtDate(state.startedAt)} · 갱신 {fmtDate(state.updatedAt)}
          </p>
        </div>
      )}

      {/* ── 수집 이력 ── */}
      <div className="card p-5">
        <h3 className="mb-3 text-[14px] font-bold text-navy-800">수집 이력</h3>
        {history.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-navy-400">아직 수집 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-wide text-navy-400">
                <tr className="border-b border-navy-100">
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">일시</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">출처</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">키워드</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">저장</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">중복</th>
                  <th className="whitespace-nowrap py-2 font-semibold">실패</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-navy-400">{fmtDate(h.finishedAt)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-navy-500">
                      {h.source === "feed" ? "유저 피드" : "iNaturalist"}
                    </td>
                    <td className="py-2.5 pr-3 text-navy-800">{h.keyword}</td>
                    <td className="py-2.5 pr-3 font-semibold text-emerald-300">{h.saved}</td>
                    <td className="py-2.5 pr-3 text-navy-400">{h.skipped}</td>
                    <td className="py-2.5 text-red-300">{h.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Roboflow ZIP 업로드 ── */}
      <RoboflowZipUpload onUploaded={load} />

      <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-navy-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        수집된 이미지는 <code className="text-navy-500">training-data/raw/</code> 에 저장됩니다.
        저작권 표기가 필요한 라이선스(CC-BY 계열)가 포함되므로, 학습 외 용도로 재배포하지 마세요.
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Roboflow YOLOv8 ZIP 업로드 섹션
   ────────────────────────────────────────────────────────────── */
function RoboflowZipUpload({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    savedImages?: number;
    savedLabels?: number;
    skipped?: number;
    errors?: string[];
    error?: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/ai-training/upload-zip", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, error: data?.error ?? "업로드에 실패했습니다." });
      } else {
        setResult({ ok: true, ...data });
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        onUploaded();
      }
    } catch {
      setResult({ ok: false, error: "업로드 중 오류가 발생했습니다." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-[15px] font-bold text-navy-800">Roboflow ZIP 업로드</h2>
      <p className="mb-4 text-[12.5px] text-navy-400">
        Roboflow에서 Export한 YOLOv8 포맷 zip 파일을 업로드합니다.
        이미지는 <code className="text-navy-500">raw/</code>에, 라벨은 <code className="text-navy-500">labels/</code>에 저장됩니다.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* 파일 선택 버튼 */}
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy-100 px-4 py-2.5 text-[13px] font-semibold text-navy-400 transition-colors hover:bg-white/[0.04]">
          <FileArchive size={15} />
          {file ? file.name : "zip 파일 선택"}
          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>

        {file && (
          <span className="text-[12px] text-navy-400">
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </span>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          leftIcon={uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        >
          {uploading ? "업로드 중…" : "업로드"}
        </Button>
      </div>

      {/* 결과 */}
      {result && (
        <div className={cn(
          "mt-4 rounded-xl px-4 py-3 text-[13px]",
          result.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300",
        )}>
          {result.ok ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">업로드 완료</p>
                <p className="mt-0.5 text-[12px] opacity-80">
                  이미지 {result.savedImages}장 저장 · 라벨 {result.savedLabels}개 저장 · 중복 {result.skipped}건 건너뜀
                </p>
                {result.errors && result.errors.length > 0 && (
                  <ul className="mt-1 text-[11.5px] opacity-70">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <p>{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2 py-2.5">
      <p className={cn("text-[17px] font-bold tabular-nums", tone)}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] text-navy-400">{label}</p>
    </div>
  );
}
