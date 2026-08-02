"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 댓글 사진 첨부 공통 조각 (피드 / 조행기 / 낚시단 댓글에서 함께 사용).
 * - 업로드는 기존 /api/upload (multipart) 를 그대로 쓴다.
 * - 아이콘은 외부 라이브러리 없이 인라인 라인형 SVG.
 * - 포인트 적립 로직과는 무관하다(첨부 여부와 상관없이 기존 10P 규칙 유지).
 */

/** 이미지를 canvas로 리사이즈+압축 (최대 1200px, JPEG 85%) — PhotoPicker 와 동일 규격 */
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
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("압축 실패"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("이미지를 읽을 수 없습니다")); };
    img.src = objectUrl;
  });
}

async function uploadCommentPhoto(file: File): Promise<string> {
  const blob = await compressImage(file);
  const form = new FormData();
  form.append("file", blob, file.name.replace(/\.[^.]+$/, "") + ".jpg");
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || "사진 업로드에 실패했습니다");
  return data.url as string;
}

/** 댓글 입력창 옆 사진 첨부 버튼 (이미지 라인 아이콘) */
export function CommentPhotoButton({
  onUploaded, onError, disabled, size = 16,
}: {
  onUploaded: (url: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setUploading(true);
    try {
      onUploaded(await uploadCommentPhoto(file));
    } catch (err: any) {
      onError?.(err?.message || "사진 업로드에 실패했습니다");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        aria-label="사진 첨부"
        className="shrink-0 rounded-full p-2 text-navy-300 btn-press transition-colors hover:bg-navy-50 hover:text-orange-400 disabled:opacity-50"
      >
        {uploading ? (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin" aria-hidden>
            <path d="M21 12a9 9 0 1 1-6.2-8.6" />
          </svg>
        ) : (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="m21 15-4.5-4.5L7 20" />
          </svg>
        )}
      </button>
    </>
  );
}

/** 입력창 아래 썸네일 미리보기 (삭제 버튼 포함) */
export function CommentPhotoPreview({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="relative mt-2 inline-block">
      <img src={url} alt="첨부한 사진 미리보기" className="h-16 w-16 rounded-lg object-cover ring-1 ring-navy-100" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="첨부 사진 삭제"
        className="absolute -right-1.5 -top-1.5 rounded-full bg-[#0d1b2a] p-0.5 text-navy-300 ring-1 ring-navy-100 btn-press transition-colors hover:text-orange-400"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** 등록된 댓글의 첨부 사진 — 클릭 시 풀스크린 모달로 확대 */
export function CommentImage({ url, className }: { url: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 모달이 열려 있는 동안 ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`mt-1.5 block ${className ?? ""}`} aria-label="첨부 사진 크게 보기">
        <img src={url} alt="댓글 첨부 사진" loading="lazy" decoding="async" className="max-h-32 w-auto max-w-[160px] rounded-lg object-cover ring-1 ring-navy-100" />
      </button>
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <img src={url} alt="댓글 첨부 사진" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          {/* 닫기 버튼 — FeedCard 의 "크게 보기" 뷰어와 동일한 규격 */}
          <button
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="absolute right-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0d1b2a]/95 text-navy-800 shadow-card ring-1 ring-white/15 backdrop-blur btn-press transition-colors hover:bg-[#162538]"
            style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
