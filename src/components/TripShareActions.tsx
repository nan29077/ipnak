"use client";
/**
 * 스마트피싱 기록 — 공유 / 이미지 저장 액션
 *
 * - 카카오톡 공유 : Kakao JavaScript SDK, 피드(링크) 형식
 * - 기타 앱 공유   : Web Share API (인스타·문자·메일 등) → 미지원이면 링크 복사
 * - 이미지 저장   : html2canvas 로 기록 화면 전체(스크롤 포함)를 PNG 파일로 다운로드
 *
 * 기존 "워킹피드에 올리기" 기능과는 완전히 분리돼 있다.
 */
import { useCallback, useState } from "react";
import { Download, Loader2, MessageSquare, Share2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { isKakaoShareConfigured, shareKakaoFeed } from "@/lib/kakaoShare";
import { captureElementToPngBlob, downloadBlob, safeFileName } from "@/lib/captureImage";
import { shareContent } from "@/hooks/useNativeShare";

/** 캡처본에서 제외할 요소 표시 — 이 속성이 붙은 요소는 PNG 에 담기지 않는다 */
export const CAPTURE_IGNORE_ATTR = "data-capture-ignore";
const CAPTURE_IGNORE_SELECTOR = `[${CAPTURE_IGNORE_ATTR}]`;

type Props = {
  /** 캡처 대상 — 기록 화면 본문 컨테이너 */
  captureRef: React.RefObject<HTMLDivElement>;
  /** 공유 제목 */
  title: string;
  /** 공유 설명 (거리·시간·피쉬 수 등) */
  description: string;
  /** 카카오 피드 썸네일 — 상대경로면 현재 origin 기준 절대 URL 로 바꾼다 */
  thumbnailUrl?: string | null;
  /** 공유 링크 경로 (예: /post/xxx). 없으면 홈으로 */
  sharePath?: string | null;
  /** 저장 파일명 (확장자 제외) */
  fileName: string;
};

/** 기본 썸네일 — 개별 사진이 없을 때 쓰는 공유 이미지 */
const FALLBACK_IMAGE = "/og-ipnak-share-v6.png";

export function TripShareActions({
  captureRef,
  title,
  description,
  thumbnailUrl,
  sharePath,
  fileName,
}: Props) {
  const toast = useToast();
  const [kakaoBusy, setKakaoBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const kakaoAvailable = isKakaoShareConfigured();
  const busy = kakaoBusy || shareBusy || downloadBusy;

  /** 상대 경로를 현재 origin 기준 절대 URL 로 */
  const absolute = useCallback((path: string) => {
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return window.location.origin;
    }
  }, []);

  const shareLink = useCallback(
    () => absolute(sharePath || "/"),
    [absolute, sharePath]
  );

  /* ── 카카오톡 공유 (피드/링크) ── */
  const handleKakao = useCallback(async () => {
    if (busy) return;
    setKakaoBusy(true);
    try {
      await shareKakaoFeed({
        title,
        description,
        imageUrl: absolute(thumbnailUrl || FALLBACK_IMAGE),
        link: shareLink(),
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "카카오톡 공유에 실패했어요.", "error");
    } finally {
      setKakaoBusy(false);
    }
  }, [busy, title, description, thumbnailUrl, absolute, shareLink, toast]);

  /* ── 기타 앱 공유 (Web Share API) ── */
  const handleShare = useCallback(async () => {
    if (busy) return;
    setShareBusy(true);
    try {
      const res = await shareContent({
        title,
        text: description,
        url: shareLink(),
        dialogTitle: "기록 공유",
      });
      if (res.method === "clipboard" && res.ok) {
        toast("링크를 복사했어요", "success");
      } else if (!res.ok && !res.cancelled) {
        toast("공유에 실패했어요.", "error");
      }
    } catch {
      toast("공유에 실패했어요.", "error");
    } finally {
      setShareBusy(false);
    }
  }, [busy, title, description, shareLink, toast]);

  /* ── 이미지(PNG) 다운로드 — 전체 길이 캡처 ── */
  const handleDownload = useCallback(async () => {
    if (busy) return;
    const node = captureRef.current;
    if (!node) {
      toast("저장할 기록 화면을 찾지 못했어요.", "error");
      return;
    }
    setDownloadBusy(true);
    try {
      const blob = await captureElementToPngBlob(node, {
        ignoreSelector: CAPTURE_IGNORE_SELECTOR,
        backgroundColor: "#162538",
      });
      await downloadBlob(blob, `${safeFileName(fileName)}.png`);
      toast("이미지를 저장했어요", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "이미지 저장에 실패했어요.", "error");
    } finally {
      setDownloadBusy(false);
    }
  }, [busy, captureRef, fileName, toast]);

  const baseBtn =
    "flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-semibold transition-colors disabled:opacity-50";

  return (
    <div {...{ [CAPTURE_IGNORE_ATTR]: "" }} className="space-y-1.5">
      <div className={`grid gap-2 ${kakaoAvailable ? "grid-cols-3" : "grid-cols-2"}`}>
        {kakaoAvailable && (
          <button
            type="button"
            onClick={handleKakao}
            disabled={busy}
            aria-label="카카오톡으로 공유"
            className={baseBtn}
            style={{ backgroundColor: "#FEE500", color: "#191919" }}
          >
            {kakaoBusy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <MessageSquare size={15} strokeWidth={2} />
            )}
            카카오톡
          </button>
        )}

        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          aria-label="다른 앱으로 공유"
          className={`${baseBtn} border border-navy-100 bg-surface-200 text-navy-700 hover:bg-navy-50`}
        >
          {shareBusy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Share2 size={15} strokeWidth={1.9} />
          )}
          공유
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          aria-label="기록 이미지 저장"
          className={`${baseBtn} border border-aqua-400/40 bg-aqua-400/10 text-aqua-300 hover:bg-aqua-400/20`}
        >
          {downloadBusy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} strokeWidth={1.9} />
          )}
          이미지 저장
        </button>
      </div>
      {downloadBusy && (
        <p className="text-center text-[11px] text-navy-400">
          기록 화면을 이미지로 만드는 중...
        </p>
      )}
    </div>
  );
}
