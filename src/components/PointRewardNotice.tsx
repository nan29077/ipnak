"use client";
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { useAppSettings } from "@/lib/appSettingsContext";
import { cn } from "@/lib/utils";

type PostRewardStatus = { enabled: boolean; used: number; limit: number; reward: number };

/**
 * 글쓰기 폼 하단 안내 — "글 작성 시 100P 적립 (오늘 N회/5회 사용)"
 * 오늘 사용 횟수(N)는 서버에서 조회한다(종류 무관 합산, KST 기준).
 * 포인트 제도가 꺼져 있거나 조회에 실패하면 아무것도 표시하지 않는다.
 */
export function PostRewardNotice({ className }: { className?: string }) {
  const { pointsEnabled } = useAppSettings();
  const [status, setStatus] = useState<PostRewardStatus | null>(null);

  useEffect(() => {
    if (!pointsEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/points/post-reward");
        if (!res.ok) return;
        const data = (await res.json()) as PostRewardStatus;
        if (!cancelled && data?.enabled) setStatus(data);
      } catch {
        /* 안내 문구는 실패해도 조용히 숨긴다 */
      }
    })();
    return () => { cancelled = true; };
  }, [pointsEnabled]);

  if (!status) return null;
  const exhausted = status.used >= status.limit;

  return (
    <p className={cn("flex items-center justify-center gap-1 text-[11px] text-navy-400", className)}>
      <Coins size={12} className={exhausted ? "text-navy-400" : "text-orange-400"} />
      글 작성 시 {status.reward}P 적립
      <span className={exhausted ? "text-navy-400" : "text-navy-300"}>
        (오늘 {status.used}회/{status.limit}회 사용)
      </span>
    </p>
  );
}

/**
 * 댓글 입력창 하단 안내 — "댓글 작성 시 10P 적립 (하루 최대 20개)"
 * 값은 lib/points.ts 의 POINT_RULES.COMMENT_REWARD / COMMENT_DAILY_LIMIT 와 맞춘다
 * (points.ts 는 server-only 라 클라이언트 컴포넌트에서 import 할 수 없다).
 */
export function CommentRewardNotice({ className }: { className?: string }) {
  const { pointsEnabled } = useAppSettings();
  if (!pointsEnabled) return null;
  return (
    <p className={cn("flex items-center justify-center gap-1 text-[11px] text-navy-400", className)}>
      <Coins size={12} className="text-orange-400" />
      댓글 작성 시 10P 적립
      <span className="text-navy-300">(하루 최대 20개)</span>
    </p>
  );
}

// 이모지 대신 쓰는 라인형 인라인 SVG 아이콘 (외부 라이브러리 없이 처리)
const LINE_ICON_PROPS = {
  width: 13, height: 13, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  className: "shrink-0 text-yellow-500", "aria-hidden": true,
} as const;

/** 글쓰기 — 연필/편집 라인 아이콘 */
function PencilLineIcon() {
  return (
    <svg {...LINE_ICON_PROPS}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** 댓글 — 말풍선 라인 아이콘 */
function ChatBubbleLineIcon() {
  return (
    <svg {...LINE_ICON_PROPS}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

/**
 * 글쓰기 종류 선택 시트("무엇을 올릴까요?") 하단 안내.
 * 적립 한도를 고정 문구로만 보여준다(오늘 사용 횟수는 글쓰기 폼의 PostRewardNotice 에서 안내).
 * 중고마켓 판매글은 /api/market 경로라 적립 대상이 아니므로 그 점을 함께 밝힌다.
 */
export function WritePointRewardNotice({ className }: { className?: string }) {
  const { pointsEnabled } = useAppSettings();
  if (!pointsEnabled) return null;
  return (
    <div className={cn("border-t border-navy-100/60 pt-3 text-center", className)}>
      {/* 한 줄로 붙이면 좁은 화면에서 문구 중간이 잘려 두 줄로 고정한다.
          두 줄을 w-fit 컨테이너로 묶어 가운데 정렬하면 줄 길이가 달라도
          아이콘·텍스트 시작점이 같은 기준선에서 맞는다. */}
      <div className="mx-auto flex w-fit flex-col items-start gap-1">
        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-navy-400">
          <PencilLineIcon />글 작성 시 100P 적립 <span className="text-navy-300">(하루 최대 5회)</span>
        </p>
        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-navy-400">
          <ChatBubbleLineIcon />댓글 작성 시 10P 적립 <span className="text-navy-300">(하루 최대 20개)</span>
        </p>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-navy-300">
        피싱 피드 · 일상 피드 · 조행기에만 적립되며, 중고마켓 판매글은 제외돼요
      </p>
    </div>
  );
}
