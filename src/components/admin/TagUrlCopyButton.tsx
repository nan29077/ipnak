"use client";
/**
 * NFC 태그에 기록할 URL 복사 버튼 (관리자 레지스트리 표에서 사용)
 * - NFC Tools 같은 쓰기 앱에 그대로 붙여넣을 수 있게 URL 전체를 클립보드로 복사한다.
 */
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function TagUrlCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // http 로컬 등 클립보드 API 가 막힌 환경 폴백
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`태그 URL 복사 — ${url}`}
      className="shrink-0 rounded-md p-1 text-navy-300 transition-colors hover:bg-navy-100 hover:text-navy-600"
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-green-500" />
        : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
