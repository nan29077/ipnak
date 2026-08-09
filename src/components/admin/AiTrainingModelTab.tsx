"use client";
/**
 * AI 학습 관리 — 모델 관리 탭
 *
 * 현재 서비스 중인 YOLO 모델(public/models/best.onnx)을 확인하고 교체한다.
 * 업로드가 끝나면 클라이언트 캐시(resetYoloModel)를 비워 다음 측정부터 새 모델이 쓰인다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Loader2, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { resetYoloModel } from "@/lib/yolo/modelLoader";

type ModelInfo = {
  exists: boolean;
  servePath: string;
  file?: { name: string; size: number; modifiedAt: string };
  meta?: { fileName: string; size: number; uploadedAt: string; uploadedBy: string; note: string } | null;
};

function fmtSize(bytes: number) {
  if (!bytes) return "-";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("ko-KR");
}

export function AiTrainingModelTab() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  // 조회 실패는 "모델 없음"과 다르다 — 실패 시 오류 안내를 보여 오판(재업로드 등)을 막는다
  const [loadFailed, setLoadFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-training/model", { cache: "no-store" });
      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      setInfo(await res.json());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("업로드할 .onnx 파일을 선택해 주세요.");
      return;
    }
    setUploading(true);
    setMsg("");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("note", note);
      const res = await fetch("/api/admin/ai-training/model", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error ?? "업로드에 실패했습니다.");
        return;
      }
      // 이 브라우저에 캐시된 이전 모델 세션을 버린다
      resetYoloModel();
      setMsg("새 모델을 적용했습니다. AI 카메라에 즉시 반영됩니다.");
      setNote("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch {
      setError("업로드 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  async function removeModel() {
    if (!window.confirm("모델을 삭제하면 AI 카메라가 기존(색상·서버 AI) 방식으로만 동작합니다. 계속할까요?")) return;
    setMsg("");
    setError("");
    const res = await fetch("/api/admin/ai-training/model", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("모델 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      await load();
      return;
    }
    resetYoloModel();
    setMsg("모델을 삭제했습니다. 기존 감지 방식으로 동작합니다.");
    await load();
  }

  const active = info?.exists === true;

  return (
    <div className="space-y-4">
      {/* ── 현재 모델 ── */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Cpu size={17} className="text-orange-400" />
          <h2 className="text-[15px] font-bold text-navy-800">현재 서비스 모델</h2>
          <Button size="sm" variant="ghost" onClick={load} leftIcon={<RefreshCw size={14} />} className="ml-auto">
            새로고침
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-[13px] text-navy-400">
            <Loader2 size={15} className="animate-spin" /> 확인 중…
          </div>
        ) : loadFailed ? (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-300" />
            <div>
              <p className="text-[13px] font-semibold text-red-300">모델 정보를 불러오지 못했습니다.</p>
              <p className="mt-0.5 text-[12px] text-navy-400">
                일시적인 오류이거나 로그인이 만료됐을 수 있습니다. 새로고침을 눌러 다시 확인해 주세요.
              </p>
            </div>
          </div>
        ) : active ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 size={16} className="text-emerald-300" />
              <span className="text-[13px] font-semibold text-emerald-300">YOLO 활성 — AI 카메라에서 사용 중</span>
            </div>
            <dl className="grid gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
              <Row label="서빙 경로" value={info?.servePath ?? ""} />
              <Row label="파일 크기" value={fmtSize(info?.file?.size ?? 0)} />
              <Row label="원본 파일명" value={info?.meta?.fileName || info?.file?.name || "-"} />
              <Row label="적용 일시" value={fmtDate(info?.meta?.uploadedAt || info?.file?.modifiedAt)} />
              <Row label="업로드한 관리자" value={info?.meta?.uploadedBy || "-"} />
              <Row label="메모" value={info?.meta?.note || "-"} />
            </dl>
            <Button size="sm" variant="ghost" onClick={removeModel} leftIcon={<Trash2 size={13} />} className="text-red-300">
              모델 삭제 (YOLO 끄기)
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <div>
              <p className="text-[13px] font-semibold text-navy-800">배포된 모델이 없습니다.</p>
              <p className="mt-0.5 text-[12px] text-navy-400">
                AI 카메라는 기존(서버 AI + 색상 기반) 방식으로 정상 동작합니다.
                학습을 마친 <code className="text-navy-500">best.onnx</code> 를 업로드하면 YOLO 감지가 켜집니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 새 모델 업로드 ── */}
      <div className="card p-5">
        <h3 className="mb-1 text-[14px] font-bold text-navy-800">새 모델 업로드</h3>
        <p className="mb-4 text-[12.5px] text-navy-400">
          Colab 에서 <code className="text-navy-500">format=onnx</code> 로 내보낸 파일을 올리세요.
          업로드 즉시 <code className="text-navy-500">public/models/best.onnx</code> 를 교체합니다.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-navy-400">모델 파일 (.onnx)</span>
            <input
              ref={fileRef}
              type="file"
              accept=".onnx"
              className="field cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-gray-900"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-navy-400">메모 (선택)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: v2 · 1,200장 학습 · mAP50 0.87" />
          </label>
        </div>

        <div className="mt-4">
          <Button onClick={upload} disabled={uploading}
            leftIcon={uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}>
            {uploading ? "업로드 중…" : "업로드 후 즉시 적용"}
          </Button>
        </div>

        {msg && <p className="mt-3 text-[12.5px] text-emerald-300">{msg}</p>}
        {error && <p className="mt-3 text-[12.5px] text-red-300">{error}</p>}

        <p className="mt-4 rounded-xl bg-white/[0.04] px-3 py-2.5 text-[11.5px] leading-relaxed text-navy-400">
          클래스 순서는 <b className="text-navy-500">fish → ipnak-ball → ipnak-keyring</b> 이어야 합니다.
          학습 시 <code>data.yaml</code> 의 names 순서가 다르면 감지 결과의 클래스가 뒤바뀝니다.
          입력 해상도는 640×640(<code>imgsz=640</code>) 기준입니다.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[92px] shrink-0 text-navy-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-all text-navy-800">{value}</dd>
    </div>
  );
}
