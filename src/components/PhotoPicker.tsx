"use client";
import { useRef, useState } from "react";
import { Camera, Images, ImagePlus, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { ImageCropEditor } from "@/components/shared/ImageCropEditor";

export type PickedPhoto = {
  preview: string;   // 로컬 blob URL (화면 표시용)
  submitUrl: string; // 서버 업로드 완료 URL (폼 제출 시 사용)
  uploading?: boolean;
};

// 업로드 완료 후에는 "직전 상태 기준"으로 갱신해야 하므로 갱신 함수도 받는다.
// (useState의 setter를 그대로 넘기는 기존 사용처와 호환)
type PhotoChange = PickedPhoto[] | ((prev: PickedPhoto[]) => PickedPhoto[]);

/** 이미지를 canvas로 리사이즈+압축 후 Blob 반환 (최대 1200px, JPEG 85%) */
async function compressImage(file: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas error"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("압축 실패"));
      }, "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 읽을 수 없습니다"));
    };
    img.src = objectUrl;
  });
}

/** 서버에 파일 업로드, URL 반환 */
async function uploadFile(blob: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.append("file", blob, fileName);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `업로드 실패 (${res.status})`);
  }
  const data = await res.json();
  if (!data?.url) throw new Error("서버가 이미지 주소를 반환하지 않았습니다");
  return data.url as string;
}

/** 압축 후 업로드 */
async function compressAndUpload(file: Blob, fileName: string): Promise<string> {
  const compressed = await compressImage(file);
  return uploadFile(compressed, fileName.replace(/\.[^.]+$/, "") + ".jpg");
}

export function PhotoPicker({
  value, onChange, max = 5, capture = false, single = false, crop = true, cropAspect = 1,
}: { value: PickedPhoto[]; onChange: (v: PhotoChange) => void; max?: number; capture?: boolean; single?: boolean; crop?: boolean; cropAspect?: number }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  // 크롭 편집 대기열 — 여러 장을 고르면 한 장씩 순서대로 편집한다
  const [queue, setQueue] = useState<File[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);

  function triggerInput(ref: React.RefObject<HTMLInputElement>) {
    if (!ref.current) return;
    ref.current.value = "";
    ref.current.click();
  }

  /** 한 장을 미리보기에 추가하고 업로드까지 진행 */
  async function addAndUpload(blob: Blob, fileName: string, alreadyProcessed: boolean) {
    const placeholder: PickedPhoto = {
      preview: URL.createObjectURL(blob),
      submitUrl: "",
      uploading: true,
    };
    onChange((prev) => (single ? [placeholder] : [...prev, placeholder].slice(0, max)));
    try {
      // 크롭 결과는 이미 1080px JPEG이므로 추가 압축 없이 그대로 올린다
      const url = alreadyProcessed
        ? await uploadFile(blob, fileName)
        : await compressAndUpload(blob, fileName);
      onChange((prev) => {
        const next = [...prev];
        const idx = next.indexOf(placeholder);
        if (idx === -1) return prev; // 이미 사용자가 삭제한 항목
        next[idx] = { ...next[idx], submitUrl: url, uploading: false };
        return next.slice(0, max);
      });
    } catch (e) {
      onChange((prev) => prev.filter((p) => p !== placeholder));
      const detail = e instanceof Error ? e.message : "";
      setErr(detail ? `사진 업로드에 실패했습니다: ${detail}` : "사진 업로드에 실패했습니다. 다시 시도해주세요.");
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr("");
    const toProcess = single ? Array.from(files).slice(0, 1) : Array.from(files).slice(0, max - value.length);
    if (toProcess.length === 0) return;

    // 크롭 편집을 쓰는 경우: 대기열에 넣고 한 장씩 편집 → 완료된 것부터 업로드
    if (crop) {
      setQueue(toProcess);
      setQueueTotal(toProcess.length);
      return;
    }

    // 크롭 없이(기존 방식) 압축 후 업로드
    await Promise.all(toProcess.map((f) => addAndUpload(f, f.name, false)));
  }

  /** 편집 완료 — 크롭된 Blob을 업로드하고 다음 사진으로 넘어간다 */
  function handleCropComplete(blob: Blob) {
    const current = queue[0];
    setQueue((prev) => prev.slice(1));
    if (!current) return;
    void addAndUpload(blob, current.name.replace(/\.[^.]+$/, "") + ".jpg", true);
  }

  const canAdd = value.length < max;
  const anyUploading = value.some((p) => p.uploading);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((p, i) => (
          <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`선택한 사진 ${i + 1}`} className="h-full w-full object-cover" />
            {/* 업로드 중 오버레이 */}
            {p.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 size={20} className="animate-spin text-white" />
              </div>
            )}
            {i === 0 && !p.uploading && (
              <span className="badge absolute bottom-1 left-1 bg-black/70 text-white backdrop-blur-sm">대표</span>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              disabled={p.uploading}
              className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white transition-colors hover:bg-black/70 disabled:opacity-40"
              aria-label="사진 삭제"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {canAdd && !anyUploading && (
          capture ? (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => triggerInput(cameraRef)}
                className="flex h-24 w-[58px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 text-navy-300 transition-colors hover:border-aqua-400 hover:bg-aqua-500/10 hover:text-aqua-400 active:scale-95">
                <Camera size={20} />
                <span className="text-[10px] font-medium">카메라</span>
              </button>
              <button type="button" onClick={() => triggerInput(galleryRef)}
                className="flex h-24 w-[58px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 text-navy-300 transition-colors hover:border-aqua-400 hover:bg-aqua-500/10 hover:text-aqua-400 active:scale-95">
                <Images size={20} />
                <span className="text-[10px] font-medium">갤러리</span>
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => triggerInput(galleryRef)}
              className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 text-navy-300 transition-colors hover:border-aqua-400 hover:bg-aqua-500/10 hover:text-aqua-400 active:scale-95">
              <ImagePlus size={22} />
              <span className="text-[11px] font-medium">사진 추가</span>
            </button>
          )
        )}
      </div>

      {capture && (
        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
          className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      )}
      <input ref={galleryRef} type="file" accept="image/*"
        multiple={!single && !capture} className="hidden"
        onChange={(e) => handleFiles(e.target.files)} />

      <div className="mt-1.5 flex items-center gap-2">
        {value.length > 0 && (
          <Badge tone={anyUploading ? "amber" : "gray"}>
            {anyUploading ? "업로드 중..." : `${value.length}/${max}`}
          </Badge>
        )}
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>

      {/* 크롭/줌 편집 — 선택한 사진을 한 장씩 순서대로 */}
      {queue.length > 0 && (
        <ImageCropEditor
          key={`${queueTotal}-${queue.length}`}
          file={queue[0]}
          aspect={cropAspect}
          title={queueTotal > 1 ? `사진 편집 (${queueTotal - queue.length + 1}/${queueTotal})` : "사진 편집"}
          onComplete={handleCropComplete}
          onCancel={() => setQueue([])}
          onError={(m) => setErr(m)}
        />
      )}
    </div>
  );
}
