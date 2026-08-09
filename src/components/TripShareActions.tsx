"use client";
/**
 * 스마트피싱 기록 — 공유 / 이미지 저장 액션
 *
 * - 카카오톡 공유 : Kakao JavaScript SDK, 피드(링크) 형식
 * - 기타 앱 공유   : Web Share API (인스타·문자·메일 등) → 미지원이면 링크 복사
 * - 이미지 저장   : html2canvas 로 기록 화면 전체(스크롤 포함)를 PNG 로 만든 뒤
 *                  미리보기 모달을 띄우고, 모달의 "사진에 저장" 탭에서 공유 시트를 연다.
 *
 * 왜 두 단계인가
 * - html2canvas 캡처를 await 하면 iOS 의 사용자 제스처 컨텍스트가 만료돼
 *   navigator.share() 가 NotAllowedError 로 거부되고 "다음 위치에 저장" 다이얼로그로 빠진다.
 * - 미리보기 모달의 버튼 탭이 "새 제스처"가 되므로 공유 시트("사진에 추가")가 정상적으로 열린다.
 *
 * 기존 "워킹피드에 올리기" 기능과는 완전히 분리돼 있다.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageDown, Loader2, MessageSquare, Share2, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { isKakaoShareConfigured, shareKakaoFeed } from "@/lib/kakaoShare";
import {
  blobToPngFile,
  canShareImageFile,
  captureElementToPngBlob,
  downloadBlobViaAnchor,
  safeFileName,
  shareImageFile,
} from "@/lib/captureImage";
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
  /** 공유 링크 경로 (예: /post/xxx). tripId 가 있으면 그쪽이 우선한다 */
  sharePath?: string | null;
  /**
   * 스마트피싱 기록 id — 있으면 공개 열람 페이지 /trip/{tripId} 로 링크한다.
   * (로컬 전용 기록처럼 서버에 없는 id 는 넘기지 않는다)
   */
  tripId?: string | null;
  /** 카카오 피드 전용 제목 — 없으면 title 을 그대로 쓴다 */
  kakaoTitle?: string | null;
  /** 카카오 피드 전용 설명 — 없으면 description 을 그대로 쓴다 */
  kakaoDescription?: string | null;
  /** 저장 파일명 (확장자 제외) */
  fileName: string;
};

/** 기본 썸네일 — 개별 사진이 없을 때 쓰는 공유 이미지 */
const FALLBACK_IMAGE = "/og-ipnak-share-v6.png";

/** 캡처가 끝난 뒤 미리보기 모달에 넘기는 결과물 */
type PreviewImage = { file: File; url: string };

export function TripShareActions({
  captureRef,
  title,
  description,
  thumbnailUrl,
  sharePath,
  tripId,
  kakaoTitle,
  kakaoDescription,
  fileName,
}: Props) {
  const toast = useToast();
  const [kakaoBusy, setKakaoBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewImage | null>(null);

  const kakaoAvailable = isKakaoShareConfigured();
  const busy = kakaoBusy || shareBusy || downloadBusy;

  // 미리보기 objectURL 정리 — 모달을 닫거나 컴포넌트가 사라질 때 회수한다.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  /** 상대 경로를 현재 origin 기준 절대 URL 로 */
  const absolute = useCallback((path: string) => {
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return window.location.origin;
    }
  }, []);

  // 기록 id 가 있으면 로그인 없이 볼 수 있는 공개 열람 페이지로 링크한다.
  const shareLink = useCallback(
    () => absolute(tripId ? `/trip/${tripId}` : sharePath || "/"),
    [absolute, tripId, sharePath]
  );

  /* ── 카카오톡 공유 (피드/링크) ── */
  const handleKakao = useCallback(async () => {
    if (busy) return;
    setKakaoBusy(true);
    try {
      await shareKakaoFeed({
        title: kakaoTitle || title,
        description: kakaoDescription || description,
        imageUrl: absolute(thumbnailUrl || FALLBACK_IMAGE),
        link: shareLink(),
        buttonTitle: "기록 보기",
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "카카오톡 공유에 실패했어요.", "error");
    } finally {
      setKakaoBusy(false);
    }
  }, [busy, title, description, kakaoTitle, kakaoDescription, thumbnailUrl, absolute, shareLink, toast]);

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

  /* ── 이미지 저장 1단계 : 전체 길이 캡처 → 미리보기 모달 ── */
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
      const file = blobToPngFile(blob, `${safeFileName(fileName)}.png`);
      setPreview({ file, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast(e instanceof Error ? e.message : "이미지 저장에 실패했어요.", "error");
    } finally {
      setDownloadBusy(false);
    }
  }, [busy, captureRef, fileName, toast]);

  /* ── 이미지 저장 2단계 : 모달 버튼 탭 = 새 제스처 → 공유 시트 ──
     여기서는 await 를 먼저 걸지 않는다. shareImageFile 안에서 navigator.share 가
     동기적으로 호출돼야 iOS 가 제스처로 인정한다. */
  const handleSaveToPhotos = useCallback(async () => {
    if (!preview) return;
    const { file } = preview;
    const result = await shareImageFile(file, "입낚 피싱 기록");
    if (result === "shared") {
      toast("이미지를 저장했어요", "success");
      setPreview(null);
      return;
    }
    if (result === "cancelled") return; // 사용자가 공유 시트를 닫음 — 모달은 그대로 둔다
    // 공유 시트 미지원(PC 등) → 기존 a[download] 폴백
    downloadBlobViaAnchor(file, file.name);
    toast("이미지를 저장했어요", "success");
    setPreview(null);
  }, [preview, toast]);

  const canSaveToPhotos = preview ? canShareImageFile(preview.file) : false;

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

      {/* ── 캡처 이미지 미리보기 모달 ──
          바텀시트(z-9999) 위에 떠야 하므로 body 포털 + z-[10000] 으로 올린다. */}
      {preview && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="기록 이미지 미리보기"
          >
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
              onClick={() => setPreview(null)}
            />
            <div className="relative flex max-h-full w-full max-w-[420px] flex-col gap-3">
              {/* 닫기 */}
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="닫기"
                className="self-end rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
              >
                <X size={20} />
              </button>

              {/* 캡처 미리보기 */}
              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#162538]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.url}
                  alt="스마트피싱 기록 이미지 미리보기"
                  className="block w-full"
                />
              </div>

              {/* 사진에 저장 (모바일) / 이미지 다운로드 (PC) */}
              <button
                type="button"
                onClick={handleSaveToPhotos}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-orange-500 py-3.5 text-[14px] font-semibold text-gray-900 transition-colors hover:bg-orange-600"
              >
                <ImageDown size={17} strokeWidth={1.9} />
                {canSaveToPhotos ? "사진에 저장" : "이미지 다운로드"}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
