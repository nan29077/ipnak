"use client";
import { useRef, useState } from "react";
import { Camera, Images, ImagePlus, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui";

export type PickedPhoto = {
  preview: string;   // 로컬 blob URL (화면 표시용)
  submitUrl: string; // 서버 업로드 완료 URL (폼 제출 시 사용)
  uploading?: boolean;
};

// 업로드 완료 후에는 "직전 상태 기준"으로 갱신해야 하므로 갱신 함수도 받는다.
// (useState의 setter를 그대로 넘기는 기존 사용처와 호환)
type PhotoChange = PickedPhoto[] | ((prev: PickedPhoto[]) => PickedPhoto[]);

/** 이미지를 canvas로 리사이즈+압축 후 Blob 반환 (최대 1200px, JPEG 85%) */
async function compressImage(file: File): Promise<Blob> {
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
async function compressAndUpload(file: File): Promise<string> {
  const compressed = await compressImage(file);
  return uploadFile(compressed, file.name.replace(/\.[^.]+$/, "") + ".jpg");
}

export function PhotoPicker({
  value, onChange, max = 5, capture = false, single = false,
}: { value: PickedPhoto[]; onChange: (v: PhotoChange) => void; max?: number; capture?: boolean; single?: boolean }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  function triggerInput(ref: React.RefObject<HTMLInputElement>) {
    if (!ref.current) return;
    ref.current.value = "";
    ref.current.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr("");
    const toProcess = single ? Array.from(files).slice(0, 1) : Array.from(files).slice(0, max - value.length);
    if (toProcess.length === 0) return;

    // 1) 로컬 미리보기를 먼저 추가 (uploading: true)
    const placeholders: PickedPhoto[] = toProcess.map((f) => ({
      preview: URL.createObjectURL(f),
      submitUrl: "",
      uploading: true,
    }));
    onChange(single ? [placeholders[0]] : [...value, ...placeholders].slice(0, max));

    // 2) 각 파일 압축 + 업로드 (병렬)
    const results = await Promise.allSettled(toProcess.map((f) => compressAndUpload(f)));

    // 3) 업로드 결과로 상태 업데이트
    //    인덱스가 아니라 placeholder 객체 참조로 위치를 찾는다 — 업로드 중 사용자가
    //    다른 사진을 추가/삭제해도 엉뚱한 항목을 덮어쓰거나 지우지 않는다.
    onChange((prev) => {
      const next = [...prev];
      results.forEach((r, i) => {
        const idx = next.indexOf(placeholders[i]);
        if (idx === -1) return; // 이미 사용자가 삭제한 항목
        if (r.status === "fulfilled") {
          next[idx] = { ...next[idx], submitUrl: r.value, uploading: false };
        } else {
          next.splice(idx, 1); // 업로드 실패한 항목 제거
        }
      });
      return next.slice(0, max);
    });

    // 4) 실패 안내 — 서버가 알려준 실제 사유를 그대로 보여준다 (예: 로그인이 필요합니다.)
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed.length > 0) {
      const reason = failed[0].reason;
      const detail = reason instanceof Error ? reason.message : "";
      setErr(
        detail
          ? `사진 업로드에 실패했습니다: ${detail}`
          : "일부 사진 업로드에 실패했습니다. 다시 시도해주세요."
      );
    }
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
    </div>
  );
}
