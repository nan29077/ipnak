"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Download, Share2, Check, X } from "lucide-react";

export default function BallSheetPrintPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 모바일(540px 이하)에서만 자동 인쇄 트리거 (PC는 수동 인쇄)
    if (window.innerWidth <= 540) {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "입낚볼 40mm 인쇄 기준물", url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      {/* ── 화면 전용 UI ─────────────────────────────── */}
      <div className="shell">

        {/* 상단 헤더 */}
        <header className="hd">
          <div className="hd-left">
            <span className="hd-badge">인쇄 미리보기</span>
            <span className="hd-title">입낚볼 40mm 인쇄 기준물</span>
          </div>
          <div className="hd-actions">
            <a href="/ipnak-ball-40mm-bear-logo-print-sheet-a4.png"
               download="ipnak-ball-40mm-bear-logo-print-sheet-a4.png"
               className="btn ghost" title="SVG 파일 저장">
              <Download size={14} /><span>저장</span>
            </a>
            <button type="button" onClick={handleShare} className="btn ghost" title="링크 공유">
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              <span>{copied ? "복사됨" : "공유"}</span>
            </button>
            <button type="button" onClick={() => window.print()} className="btn primary">
              <Printer size={14} /><span>인쇄</span>
            </button>
            <button type="button" onClick={() => router.back()} className="btn icon" aria-label="닫기">
              <X size={16} />
            </button>
          </div>
        </header>

        {/* 안내 */}
        <div className="tip">
          <span className="tip-dot" />
          인쇄 시 <b>「크기 조정 없음 / 100%」</b>로 설정하면 정확한 40mm로 출력됩니다
        </div>

        {/* A4 미리보기 */}
        <main className="preview">
          <div className="paper">
            <img src="/ipnak-ball-40mm-bear-logo-print-sheet-a4.png"
                 alt="입낚볼 40mm 인쇄 기준물 A4"
                 className="paper-img" />
          </div>
          <p className="caption">A4 (210 × 297 mm) · 로고 9개</p>
        </main>
      </div>

      {/* ── 인쇄 전용 ─────────────────────────────────── */}
      <div className="print-only">
        <img src="/ipnak-ball-40mm-bear-logo-print-sheet-a4.png"
             alt="입낚볼 40mm 인쇄 기준물"
             className="print-img" />
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        body { background: #181818; font-family: -apple-system, 'Segoe UI', sans-serif; color: #e8e8e8; }

        /* 쉘: 헤더 + 팁 + 미리보기 전체 높이 */
        .shell { display: flex; flex-direction: column; height: 100vh; }

        /* ── 헤더 ── */
        .hd {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 0 20px; height: 56px; flex-shrink: 0;
          background: #111; border-bottom: 1px solid #252525;
        }
        .hd-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .hd-badge {
          flex-shrink: 0;
          padding: 3px 8px; border-radius: 6px;
          background: #eab308; color: #fff;
          font-size: 10.5px; font-weight: 800; letter-spacing: .03em;
        }
        .hd-title { font-size: 14px; font-weight: 600; color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hd-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

        /* ── 버튼 ── */
        .btn {
          display: inline-flex; align-items: center; gap: 5px;
          height: 34px; padding: 0 12px;
          border: none; border-radius: 8px;
          font-size: 12.5px; font-weight: 600; cursor: pointer;
          transition: background .12s, transform .1s; white-space: nowrap; text-decoration: none;
        }
        .btn:active { transform: scale(.96); }
        .btn.ghost { background: #222; color: #aaa; border: 1px solid #253848; }
        .btn.ghost:hover { background: #282828; color: #ddd; }
        .btn.primary { background: #eab308; color: #fff; font-weight: 700; }
        .btn.primary:hover { background: #ca8a04; }
        .btn.icon { width: 34px; height: 34px; padding: 0; justify-content: center; background: transparent; color: #555; }
        .btn.icon:hover { background: #222; color: #aaa; }

        /* ── 안내 배너 ── */
        .tip {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 20px; flex-shrink: 0;
          background: #161200; border-bottom: 1px solid #252000;
          font-size: 11.5px; color: #998030;
        }
        .tip b { color: #d9ab30; font-weight: 700; }
        .tip-dot { width: 5px; height: 5px; border-radius: 50%; background: #c99a20; flex-shrink: 0; }

        /* ── 미리보기 ── */
        .preview {
          flex: 1; overflow-y: auto;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 28px 20px 24px;
          gap: 12px;
        }
        .paper {
          box-shadow:
            0 2px 6px rgba(0,0,0,.5),
            0 16px 48px rgba(0,0,0,.7),
            0 40px 80px rgba(0,0,0,.4);
          border-radius: 1px;
          /* 팝업 안에서 A4 비율 유지하며 최대한 크게 */
          width: min(210mm, calc(100% - 0px));
          max-height: calc(100vh - 170px);
          aspect-ratio: 210 / 297;
          overflow: hidden;
        }
        .paper-img { display: block; width: 100%; height: 100%; object-fit: contain; background: #fff; }
        .caption { font-size: 11px; color: #444; text-align: center; }

        /* ── 모바일 ── */
        @media (max-width: 540px) {
          .hd { padding: 0 12px; height: 50px; }
          .hd-title { display: none; }
          .btn span { display: none; }
          .btn { width: 34px; padding: 0; justify-content: center; }
          .btn.primary { width: auto; padding: 0 12px; }
          .btn.primary span { display: inline; }
          .tip { padding: 7px 12px; font-size: 11px; }
          .preview { padding: 16px 12px; }
        }

        /* ── 인쇄 ── */
        .print-only { display: none; }

        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { width: 210mm; height: 297mm; overflow: hidden; background: #fff; }
          body > * { visibility: hidden; }
          .print-only { display: block !important; visibility: visible; position: fixed; inset: 0; }
          .print-only * { visibility: visible; }
          .print-img { display: block; width: 210mm; height: 297mm; }
        }
      `}</style>
    </>
  );
}
