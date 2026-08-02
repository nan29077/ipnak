"use client";
import { useEffect, useState } from "react";
import { Coins, MessageSquare, PenLine } from "lucide-react";
import { useAppSettings } from "@/lib/appSettingsContext";
import { cn } from "@/lib/utils";

type RewardStatus = { enabled: boolean; used: number; limit: number; reward: number };

// 진행 중 / 한도 도달 시 막대 색상
const BAR_ACTIVE = "#eab308"; // yellow-500
const BAR_DONE = "#f97316"; // orange-500

function ActivityBar({
  label, unit, icon: Icon, status,
}: {
  label: string;
  unit: string; // "회" | "개"
  icon: React.ElementType;
  status: RewardStatus;
}) {
  const limit = Math.max(1, status.limit);
  const used = Math.min(Math.max(0, status.used), limit);
  const done = used >= limit;
  const pct = (used / limit) * 100;

  // 마운트 직후 0% → 실제 비율로 채워지는 애니메이션.
  // 첫 페인트는 반드시 0% 로 나가야 transition 이 걸리므로 다음 프레임에 값을 바꾼다.
  // rAF 는 백그라운드 탭에서 호출되지 않으므로 setTimeout 을 함께 걸어둔다(먼저 오는 쪽이 적용).
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFill(pct));
    const timer = setTimeout(() => setFill(pct), 30);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [pct]);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-semibold text-navy-600">
          <Icon size={13} className={done ? "text-orange-400" : "text-amber-400"} strokeWidth={1.8} />
          <span className="truncate">{label}</span>
          <span className="shrink-0 text-[11px] font-normal text-navy-400">+{status.reward}P</span>
        </span>
        {done && (
          <span className="shrink-0 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">
            완료
          </span>
        )}
        <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", done ? "text-orange-400" : "text-navy-500")}>
          {used}/{limit}{unit}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-navy-50/10"
        role="progressbar"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${fill}%`, backgroundColor: done ? BAR_DONE : BAR_ACTIVE, transition: "width 0.8s ease-out" }}
        />
      </div>
    </div>
  );
}

/**
 * 마이페이지 > 낚시 활동 탭 — 오늘(KST) 포인트 적립 현황 가로 막대그래프.
 * 글쓰기는 /api/points/post-reward, 댓글은 /api/points/comment-count 에서 조회한다.
 * 포인트 제도 OFF·비로그인·조회 실패 시에는 섹션 자체를 렌더링하지 않는다.
 */
export function PointActivityBars() {
  const { pointsEnabled } = useAppSettings();
  const [post, setPost] = useState<RewardStatus | null>(null);
  const [comment, setComment] = useState<RewardStatus | null>(null);

  useEffect(() => {
    if (!pointsEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          fetch("/api/points/post-reward", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/points/comment-count", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (cancelled) return;
        if (p?.enabled) setPost(p);
        if (c?.enabled) setComment(c);
      } catch {
        /* 조회 실패 시 섹션을 숨긴다 */
      }
    })();
    return () => { cancelled = true; };
  }, [pointsEnabled]);

  // 둘 다 못 불러오면(비로그인·제도 OFF 등) 섹션을 그리지 않는다 — 빈 카드 노출 방지
  if (!post && !comment) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100/20 bg-[#162538]">
      <div className="flex items-center gap-2 border-b border-navy-100/15 px-4 py-2.5">
        <Coins size={14} className="text-amber-400" />
        <p className="text-[13px] font-bold text-navy-700">오늘의 포인트 적립 현황</p>
      </div>
      <div className="space-y-3.5 p-3">
        {post && <ActivityBar label="피드 올리기" unit="회" icon={PenLine} status={post} />}
        {comment && <ActivityBar label="댓글 쓰기" unit="개" icon={MessageSquare} status={comment} />}
        <p className="text-[10px] leading-relaxed text-navy-300">
          매일 밤 12시(KST)에 초기화돼요
        </p>
      </div>
    </div>
  );
}
