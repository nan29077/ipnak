"use client";
import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { Badge } from "@/components/ui";

export type PickedPhoto = { preview: string; submitUrl: string };

// 로컬 개발: 실제 스토리지가 없으므로 선택 이미지는 미리보기로 표시하고,
// 제출 시에는 placeholder URL(picsum)을 저장한다. (추후 S3/스토리지 연동 포인트)
export function PhotoPicker({
  value, onChange, max = 5, capture = false, single = false,
}: { value: PickedPhoto[]; onChange: (v: PickedPhoto[]) => void; max?: number; capture?: boolean; single?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setErr("");
    const next: PickedPhoto[] = [];
    Array.from(files).slice(0, max - value.length).forEach((f, i) => {
      try {
        const preview = URL.createObjectURL(f);
        const seed = `${f.name.replace(/\W/g, "")}-${Date.now()}-${i}`;
        next.push({ preview, submitUrl: `https://picsum.photos/seed/${seed}/800/800` });
      } catch {
        setErr("이미지를 불러오지 못했습니다. 다시 시도해주세요.");
      }
    });
    onChange(single ? next.slice(0, 1) : [...value, ...next].slice(0, max));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((p, i) => (
          <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-100">
            <img src={p.preview} alt={`선택한 사진 ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && value.length > 0 && (
              <span className="badge absolute bottom-1 left-1 bg-black/70 text-white backdrop-blur-sm">대표</span>
            )}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white transition-colors hover:bg-black/70" aria-label="사진 삭제"><X size={14} /></button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" onClick={() => ref.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 text-navy-300 transition-colors hover:border-aqua-300 hover:bg-aqua-50/40 hover:text-aqua-500 btn-press">
            {capture ? <Camera size={22} /> : <ImagePlus size={22} />}
            <span className="text-[11px] font-medium">{capture ? "촬영/선택" : "사진 추가"}</span>
          </button>
        )}
      </div>
      <input
        ref={ref} type="file" accept="image/*" multiple={!single}
        {...(capture ? { capture: "environment" as any } : {})}
        className="hidden" onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mt-1.5 flex items-center gap-2">
        {value.length > 0 && <Badge tone="gray">{value.length}/{max}</Badge>}
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
    </div>
  );
}
