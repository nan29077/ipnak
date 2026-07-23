"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Link as LinkIcon, RotateCcw, Monitor } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

const DEFAULT_IMG = "/pc-bg-bass-angler.png";
const LEGACY_DEFAULT_IMAGES = new Set([
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920&q=80",
  "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1920&q=80",
]);

// 최고관리자: PC(데스크톱) 좌우 여백 배경 이미지 관리
// - 이미지 URL 입력 또는 파일 업로드(Data URL)로 지정
// - 미리보기 → 저장 시 Setting(pcMarginBgImage)에 반영, PC 여백에 즉시 적용
export function PcMarginBg({ initial }: { initial: string }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const initialValue = !initial || LEGACY_DEFAULT_IMAGES.has(initial) ? DEFAULT_IMG : initial;
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  const isDefault = value === DEFAULT_IMG;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("이미지 파일만 업로드할 수 있습니다.", "error"); return; }
    if (file.size > 4 * 1024 * 1024) { toast("이미지는 4MB 이하만 가능합니다.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setValue(String(reader.result || ""));
    reader.onerror = () => toast("파일을 읽지 못했습니다.", "error");
    reader.readAsDataURL(file);
  }

  async function save(next: string, okMsg: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SETTING_SET", key: "pcMarginBgImage", value: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      setValue(next || DEFAULT_IMG);
      toast(okMsg, "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally { setLoading(false); }
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-2">
        <Monitor size={18} className="mt-0.5 text-orange-500" />
        <div>
          <h2 className="text-[15px] font-bold text-navy-800">PC 여백 배경</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
            데스크톱(넓은 화면 ≥1024px)에서 앱 좌우 <b className="text-navy-600">여백</b>에 깔리는 배경 이미지입니다.
            낚시 사진을 올리면 그대로 적용됩니다. 모바일에는 영향이 없습니다.
          </p>
        </div>
      </div>

      {/* 미리보기 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-navy-100 bg-[#efe3cf]">
        <div
          className="h-40 w-full bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${value}")`, backgroundSize: "cover" }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-navy-400">
        {isDefault ? "현재: 기본 낚시 풍경 이미지" : value.startsWith("data:") ? "현재: 업로드한 이미지" : "현재: 이미지 URL"}
      </p>

      {/* URL 입력 */}
      <label className="mt-4 block text-[13px] font-semibold text-navy-700">이미지 URL</label>
      <div className="mt-1.5 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-navy-200 bg-white px-3">
          <LinkIcon size={15} className="text-navy-300" />
          <input
            value={value.startsWith("data:") ? "" : value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://… 또는 /uploads/사진.jpg"
            className="w-full bg-transparent py-2.5 text-[14px] text-black outline-none placeholder:text-navy-300"
          />
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-navy-200 px-3 py-2.5 text-[13px] font-semibold text-navy-700 transition-colors hover:bg-navy-50"
        >
          <Upload size={15} /> 파일 업로드
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
      </div>

      {/* 액션 */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => save(value, "PC 여백 배경을 저장했습니다")}
          disabled={loading || !value.trim()}
          className={cn(
            "flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          )}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          저장
        </button>
        <button
          onClick={() => save(DEFAULT_IMG, "기본 이미지로 초기화했습니다")}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-navy-200 px-4 py-2.5 text-[14px] font-semibold text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-50"
        >
          <RotateCcw size={15} /> 기본값으로 초기화
        </button>
      </div>
    </div>
  );
}
