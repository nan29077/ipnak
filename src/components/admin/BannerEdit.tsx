"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2, ImagePlus, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button, Input, Select } from "@/components/ui";
import { BANNER_SECTIONS } from "@/lib/bannerSections";

export { BANNER_SECTIONS };

type Banner = { id: string; title: string; body: string | null; imageUrl: string | null; linkUrl: string | null; section: string };

export function BannerEdit({ banner }: { banner: Banner }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(banner.title);
  const [body, setBody] = useState(banner.body ?? "");
  const [imageUrl, setImageUrl] = useState(banner.imageUrl ?? "");
  const [linkUrl, setLinkUrl] = useState(banner.linkUrl ?? "");
  const [section, setSection] = useState(banner.section || "main_top");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      setImageUrl(data.url);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (!title.trim()) { toast("제목을 입력하세요", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "BANNER_UPDATE", id: banner.id, title: title.trim(), body: body || null, imageUrl: imageUrl || null, linkUrl: linkUrl || null, section }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("수정되었습니다", "success");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-navy-100 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-navy-600 transition-colors hover:bg-navy-50"
      >
        <Pencil size={13} className="inline mr-1" strokeWidth={1.8} />수정
      </button>
    );
  }

  return (
    <div className="col-span-full mt-2 rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-navy-800">배너 수정</p>
        <button onClick={() => setOpen(false)} className="rounded-full p-1 text-navy-400 hover:bg-navy-100"><X size={16} /></button>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-500">섹션</label>
          <Select value={section} onChange={(e) => setSection(e.target.value)}>
            {BANNER_SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-500">제목 *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="배너 제목" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-500">내용</label>
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="배너 내용 (선택)" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-500">배너 이미지</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
          />
          {imageUrl ? (
            <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl border border-navy-100 bg-navy-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="배너 미리보기" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setImageUrl("")} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
                <Trash2 size={14} strokeWidth={1.8} />
              </button>
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-black/80 disabled:opacity-50">
                {uploading ? <Loader2 size={12} className="animate-spin inline" /> : "이미지 교체"}
              </button>
            </div>
          ) : (
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-navy-200 text-navy-400 hover:border-aqua-400 hover:text-aqua-400 disabled:opacity-50">
              {uploading ? <Loader2 size={22} strokeWidth={1.7} className="animate-spin" /> : <ImagePlus size={22} strokeWidth={1.7} />}
              <span className="text-[12px] font-semibold">{uploading ? "업로드 중..." : "이미지 선택"}</span>
            </button>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-navy-500">이동 링크 URL</label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/tournaments/xxx" />
        </div>
      </div>

      <Button onClick={submit} disabled={loading || uploading} size="sm" className="mt-3" leftIcon={loading ? <Loader2 size={14} className="animate-spin" /> : undefined}>
        저장
      </Button>
    </div>
  );
}
