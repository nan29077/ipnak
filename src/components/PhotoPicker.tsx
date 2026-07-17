"use client";
import { useRef, useState } from "react";
import { Camera, Images, ImagePlus, X } from "lucide-react";
import { Badge } from "@/components/ui";

export type PickedPhoto = { preview: string; submitUrl: string };

// 로컬 개발: 실제 스토리지가 없으므로 선택 이미지는 미리보기로 표시하고,
// 제출 시에는 placeholder URL(picsum)을 저장한다. (추후 S3/스토리지 연동 포인트)
export function PhotoPicker({
  value, onChange, max = 5, capture = false, single = false,
}: { value: PickedPhoto[]; onChange: (v: PickedPhoto[]) => void; max?: number; capture?: boolean; single?: boolean }) {
  // label+id 방식 대신 ref.click()을 직접 호출 — 모바일 브라우저에서 더 안정적
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  function triggerInput(ref: React.RefObject<HTMLInputElement>) {
    if (!ref.current) return;
    ref.current.value = ""; // 같은 파일 재선택 허용
    ref.current.click();
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
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
    if (next.length > 0) {
      onChange(single ? next.slice(0, 1) : [...value, ...next].slice(0, max));
    }
  }

  const canAdd = value.length < max;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((p, i) => (
          <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`선택한 사진 ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="badge absolute bottom-1 left-1 bg-black/70 text-white backdrop-blur-sm">대표</span>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white transition-colors hover:bg-black/70"
              aria-label="사진 삭제"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {canAdd && (
          capture ? (
            /* capture 모드: 카메라 촬영 + 갤러리 선택 두 버튼 분리 */
            <div className="flex gap-1.5">
              {/* 카메라 버튼 — ref.click()으로 직접 트리거 */}
              <button
                type="button"
                onClick={() => triggerInput(cameraRef)}
                className="flex h-24 w-[58px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 text-navy-300 transition-colors hover:border-aqua-300 hover:bg-aqua-50/40 hover:text-aqua-500 active:scale-95"
              >
                <Camera size={20} />
                <span className="text-[10px] font-medium">카메라</span>
              </button>
              {/* 갤러리 버튼 */}
              <button
                type="button"
                onClick={() => triggerInput(galleryRef)}
                className="flex h-24 w-[58px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 text-navy-300 transition-colors hover:border-aqua-300 hover:bg-aqua-50/40 hover:text-aqua-500 active:scale-95"
              >
                <Images size={20} />
                <span className="text-[10px] font-medium">갤러리</span>
              </button>
            </div>
          ) : (
            /* 일반 모드: 갤러리 단일 버튼 */
            <button
              type="button"
              onClick={() => triggerInput(galleryRef)}
              className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 text-navy-300 transition-colors hover:border-aqua-300 hover:bg-aqua-50/40 hover:text-aqua-500 active:scale-95"
            >
              <ImagePlus size={22} />
              <span className="text-[11px] font-medium">사진 추가</span>
            </button>
          )
        )}
      </div>

      {/* 숨겨진 file input들 — display:none으로 완전히 숨김 (sr-only보다 안정적) */}
      {capture && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      )}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={!single && !capture}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="mt-1.5 flex items-center gap-2">
        {value.length > 0 && <Badge tone="gray">{value.length}/{max}</Badge>}
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
    </div>
  );
}
