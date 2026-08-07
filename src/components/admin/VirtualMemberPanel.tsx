"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Bot, ChevronDown, Clock, Eye, EyeOff, Gauge, History, KeyRound, Loader2,
  Pause, Play, Power, PowerOff, RefreshCw, Sparkles, Trash2, Users,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState, Badge } from "@/components/ui";
import { Table } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { kstFormat } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";

type Tab = "members" | "contents" | "settings";

type MemberRow = {
  id: string;
  userId: string;
  nickname: string;
  region: string;
  regionGroupLabel: string;
  personality: string;
  personalityLabel: string;
  bio: string;
  avatarUrl: string | null;
  active: boolean;
  activityCount: number;
  lastActiveAt: string | null;
};

type ContentRow = {
  id: string;
  kind: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  nickname: string;
  createdAt: string;
};

type Config = {
  /** 글로벌 스위치 — 스케줄러 가동 + 일반 화면 노출을 함께 제어 */
  active: boolean;
  enabled: boolean;
  intervalHours: number;
  dailyLimit: number;
  model: string;
  lastRun: string;
};

type ActivityDetail = {
  id: string;
  kind: string;
  targetType: string;
  targetId: string | null;
  summary: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  FEED: "피싱 피드",
  GENERAL: "일상 피드",
  LOG: "조행기",
  WALKING: "워킹 피드",
  MARKET: "중고마켓",
  COMMENT: "댓글",
  LIKE: "좋아요",
};

// "생성된 글" 탭의 종류 필터. 서버는 콘텐츠 활동(FEED~MARKET)만 내려주므로 이 5종으로 충분하다.
const CONTENT_KINDS = ["FEED", "GENERAL", "LOG", "WALKING", "MARKET"] as const;
type ContentKindFilter = "ALL" | (typeof CONTENT_KINDS)[number];

const PERSONALITY_TONE: Record<string, "navy" | "aqua" | "amber" | "red" | "green" | "gray"> = {
  ACTIVE: "amber",
  INFO: "aqua",
  EMOTION: "green",
  QUESTION: "navy",
  OBSERVER: "gray",
};

export function VirtualMemberPanel({
  openaiConfigured, config, usage, members, contents, contentTotal,
}: {
  openaiConfigured: boolean;
  config: Config;
  usage: { usedToday: number; remainingToday: number };
  members: MemberRow[];
  contents: ContentRow[];
  /** 콘텐츠 활동 전체 건수 — 목록이 잘렸을 때 안내용 */
  contentTotal?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const doConfirm = useConfirm();

  const [tab, setTab] = useState<Tab>("members");
  const [loading, setLoading] = useState<string | null>(null);
  const [interval_, setInterval_] = useState(String(config.intervalHours));
  const [limit, setLimit] = useState(String(config.dailyLimit));
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, ActivityDetail[]>>({});
  const [kindFilter, setKindFilter] = useState<ContentKindFilter>("ALL");

  async function run(key: string, payload: Record<string, unknown>, successFallback = "완료") {
    setLoading(key);
    try {
      const res = await fetch("/api/admin/virtual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "처리하지 못했습니다.");
      toast(data.message || successFallback, "success");
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "처리하지 못했습니다.", "error");
      return false;
    } finally {
      setLoading(null);
    }
  }

  async function saveApiKey() {
    if (!apiKey.trim()) return toast("OpenAI API 키를 입력해 주세요.", "info");
    setLoading("apikey");
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "AI_CONNECTION_SAVE", openai: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setApiKey("");
      toast("OpenAI API 키를 저장했습니다.", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "저장하지 못했습니다.", "error");
    } finally {
      setLoading(null);
    }
  }

  async function toggleMemberDetail(memberId: string) {
    if (openMemberId === memberId) return setOpenMemberId(null);
    setOpenMemberId(memberId);
    if (detail[memberId]) return;
    try {
      const res = await fetch(`/api/admin/virtual/${memberId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "불러오지 못했습니다.");
      setDetail((prev) => ({ ...prev, [memberId]: data.activities ?? [] }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "불러오지 못했습니다.", "error");
    }
  }

  async function seed() {
    if (!await doConfirm({
      title: "가상회원 100명 생성",
      message: "지역·성격 분배 규칙에 따라 가상회원 100명을 생성합니다. 이미 있는 회원은 프로필만 갱신됩니다.",
      confirmLabel: "생성",
    })) return;
    await run("seed", { type: "SEED" });
  }

  async function toggleActive() {
    // 끄는 쪽은 일반 화면에서 콘텐츠가 사라지는 동작이라 한 번 확인한다.
    if (config.active && !await doConfirm({
      title: "AI 가상회원 비활성화",
      message: "스케줄러가 멈추고 가상회원이 작성한 모든 콘텐츠가 일반 사용자 화면에서 숨겨집니다. 데이터는 삭제되지 않으며 다시 켜면 복구됩니다.",
      confirmLabel: "비활성화",
    })) return;
    await run("active", { type: "SET_ACTIVE", value: !config.active });
  }

  async function seedContent() {
    if (!await doConfirm({
      title: "초기 시드 데이터 생성",
      message: "가상회원들이 최근 60일간 활동한 것처럼 조황·일상 피드, 조행기, 워킹 피드(동선·어획 좌표 포함), 중고마켓 글과 댓글·좋아요를 생성합니다. 이미 콘텐츠가 있는 회원은 건너뜁니다. 3천 건 이상이 생성되어 3~5분 걸릴 수 있습니다.",
      confirmLabel: "생성",
    })) return;
    await run("seedcontent", { type: "SEED_CONTENT", days: 60 });
  }

  async function resetMembers() {
    if (!await doConfirm({
      title: "가상회원 데이터 전체 초기화",
      message: "가상회원 100명과 그들이 만든 글·댓글·좋아요·중고글이 모두 삭제됩니다. 되돌릴 수 없습니다.",
      danger: true,
      confirmLabel: "전체 삭제",
    })) return;
    await run("reset", { type: "RESET" });
  }

  async function resetAllData() {
    if (!await doConfirm({
      title: "전체 데이터 초기화",
      message: "최고관리자 계정과 최고관리자가 등록한 콘텐츠만 남기고 모든 회원·게시글·거래 데이터를 삭제합니다. 되돌릴 수 없습니다.",
      danger: true,
      confirmLabel: "초기화 실행",
    })) return;
    await run("datareset", { type: "DATA_RESET" });
  }

  async function deleteContent(row: ContentRow) {
    if (!await doConfirm({
      title: "생성된 글 삭제",
      message: `"${row.summary.slice(0, 40)}" 글을 삭제합니다. 되돌릴 수 없습니다.`,
      danger: true,
      confirmLabel: "삭제",
    })) return;
    await run(`content-${row.id}`, { type: "CONTENT_DELETE", activityId: row.id }, "삭제했습니다");
  }

  const busy = loading !== null;
  const activeCount = members.filter((m) => m.active).length;

  // 종류별 건수(칩 배지용)와 현재 필터가 적용된 목록 — 프론트에서만 걸러 API 호출이 없다.
  const kindCounts = contents.reduce<Record<string, number>>((acc, c) => {
    acc[c.kind] = (acc[c.kind] ?? 0) + 1;
    return acc;
  }, {});
  const filteredContents = kindFilter === "ALL" ? contents : contents.filter((c) => c.kind === kindFilter);

  return (
    <div className="space-y-5">
      {/* 글로벌 스위치 — AI 가상회원 활성화 */}
      {/* OFF 상태에서 카드·트랙 색이 관리자 카드 배경(#162538)과 대비 1.05 수준으로 묻혀
          스위치가 없는 것처럼 보였다. OFF 일 때는 빨간 계열로 명확히 구분한다. */}
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border-2 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
          config.active
            ? "border-green-500/50 bg-green-500/[0.07]"
            : "border-red-500/80 bg-red-500/[0.16]",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors",
              config.active ? "bg-green-600" : "bg-red-600",
            )}
          >
            {config.active ? <Power size={19} /> : <PowerOff size={19} />}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-navy-800">
              AI 가상회원 활성화
              <Badge tone={config.active ? "green" : "red"}>{config.active ? "ON" : "OFF"}</Badge>
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-400">
              {config.active
                ? "동적 활동 스케줄러가 동작하고, 가상회원이 작성한 피드·조행기·워킹피드·중고마켓 글과 댓글이 일반 사용자 화면에 노출됩니다."
                : "스케줄러가 완전히 멈추고, 가상회원이 작성한 모든 콘텐츠가 일반 사용자 화면에서 숨겨집니다. 데이터는 삭제되지 않고 조회할 때만 걸러지므로 다시 켜면 그대로 복구됩니다."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 self-start sm:self-auto">
          <span className={cn("text-[12px] font-bold", config.active ? "text-green-400" : "text-red-400")}>
            {config.active ? "켜짐" : "꺼짐"}
          </span>
          <button
            onClick={() => toggleActive()}
            disabled={busy}
            role="switch"
            aria-checked={config.active}
            aria-label="AI 가상회원 활성화"
            className={cn(
              // 반투명(navy-100/40)이나 붉은 계열 트랙은 카드 배경과 합성되면 사실상 같은 색이 된다.
              // OFF 는 중립 회색(navy-300)으로 두어 카드(2.98:1)와 흰 노브(5.04:1) 양쪽에 대비를 확보한다.
              "relative inline-flex h-9 w-[68px] shrink-0 items-center rounded-full ring-1 ring-inset transition-colors disabled:opacity-50",
              config.active
                ? "bg-green-600 ring-green-300/50"
                : "bg-navy-300 ring-red-400/70",
            )}
          >
            <span
              className={cn(
                "absolute flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md transition-all",
                config.active ? "left-[36px]" : "left-1",
              )}
            >
              {loading === "active" && <Loader2 size={13} className="animate-spin text-navy-500" />}
            </span>
          </button>
        </div>
      </div>

      {/* OpenAI 키 미등록 경고 */}
      {!openaiConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-400/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="text-[13.5px] font-bold text-amber-300">OpenAI API 키가 등록되지 않았습니다</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-navy-400">
              키를 등록해야 가상회원이 글·댓글을 생성할 수 있습니다. 아래 <b>설정</b> 탭에서 등록하세요.
            </p>
          </div>
        </div>
      )}

      {/* 요약 + 전체 스위치 */}
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="가상회원" value={`${members.length}명`} sub={`활동중 ${activeCount}명`} />
        <StatCard icon={Gauge} label="오늘 API 호출" value={`${usage.usedToday}회`} sub={`잔여 ${usage.remainingToday}회 / 한도 ${config.dailyLimit}회`} />
        <StatCard icon={Clock} label="활동 주기" value={`${config.intervalHours}시간`} sub={config.lastRun ? `최근 ${kstFormat(config.lastRun, "MM.dd HH:mm")}` : "실행 이력 없음"} />
        <div className="flex flex-col justify-between gap-2 rounded-2xl border border-navy-100/20 bg-[#162538] p-4">
          <p className="text-[12px] text-navy-400">
            활동 생성{!config.active && <span className="text-navy-500"> (비활성화됨)</span>}
          </p>
          <button
            onClick={() => run("enabled", { type: "SET_ENABLED", value: !config.enabled })}
            disabled={busy || !config.active}
            title={!config.active ? "AI 가상회원 활성화 스위치를 먼저 켜주세요." : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50",
              config.enabled && config.active ? "bg-green-600 hover:bg-green-700" : "bg-navy-100/30 text-navy-300 hover:bg-navy-100/40",
            )}
          >
            {loading === "enabled" ? <Loader2 size={14} className="animate-spin" /> : config.enabled ? <Play size={14} /> : <Pause size={14} />}
            {config.enabled ? "활동 켜짐" : "활동 꺼짐"}
          </button>
        </div>
      </div>

      {/* 즉시 실행 / 생성 */}
      <div className="flex flex-wrap gap-2">
        <button onClick={seed} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500 px-3.5 py-2.5 text-[12.5px] font-semibold text-white transition-all hover:bg-purple-600 active:scale-[0.97] disabled:opacity-50">
          {loading === "seed" ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} 가상회원 100명 생성
        </button>
        <button onClick={seedContent} disabled={busy || members.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-aqua-500/90 px-3.5 py-2.5 text-[12.5px] font-semibold text-white transition-all hover:bg-aqua-500 active:scale-[0.97] disabled:opacity-50">
          {loading === "seedcontent" ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />} 초기 시드 데이터 생성
        </button>
        <button onClick={() => run("runnow", { type: "RUN_NOW" })} disabled={busy || members.length === 0 || !config.active}
          title={!config.active ? "AI 가상회원 활성화 스위치를 먼저 켜주세요." : undefined}
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2.5 text-[12.5px] font-semibold text-gray-900 transition-all hover:bg-orange-600 active:scale-[0.97] disabled:opacity-50">
          {loading === "runnow" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 지금 활동 생성
        </button>
        <button onClick={() => router.refresh()} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-navy-100/40 px-3.5 py-2.5 text-[12.5px] font-semibold text-navy-300 transition-colors hover:bg-white/[0.06] disabled:opacity-50">
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-navy-100" role="tablist">
        <TabButton active={tab === "members"} onClick={() => setTab("members")} label={`회원 목록 (${members.length})`} />
        <TabButton active={tab === "contents"} onClick={() => setTab("contents")} label={`생성된 글 (${contents.length})`} />
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")} label="설정" />
      </div>

      {tab === "members" && (
        <div className="space-y-2">
          {members.length === 0 && (
            <EmptyState title="가상회원이 없습니다" desc="위의 '가상회원 100명 생성' 버튼으로 만들 수 있습니다." />
          )}
          {members.map((m) => (
            <div key={m.id} className="rounded-2xl border border-navy-100/20 bg-[#162538]">
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <button onClick={() => toggleMemberDetail(m.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <img src={getAvatarUrl(m.userId, m.avatarUrl)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[14px] font-bold text-navy-800">{m.nickname}</span>
                      <Badge tone={PERSONALITY_TONE[m.personality] ?? "gray"}>{m.personalityLabel}</Badge>
                      {!m.active && <Badge tone="red">중지</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-navy-400">
                      {m.regionGroupLabel} · {m.region} · 활동 {m.activityCount}회 ·{" "}
                      {m.lastActiveAt ? kstFormat(m.lastActiveAt, "MM.dd HH:mm") : "활동 없음"}
                    </p>
                  </div>
                  <ChevronDown size={16} className={cn("ml-auto shrink-0 text-navy-400 transition-transform", openMemberId === m.id && "rotate-180")} />
                </button>
                <button
                  onClick={() => run(`toggle-${m.id}`, { type: "MEMBER_TOGGLE", id: m.id })}
                  disabled={busy}
                  className="shrink-0 rounded-xl border border-navy-100/40 px-3 py-2 text-[12px] font-semibold text-navy-300 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {loading === `toggle-${m.id}` ? <Loader2 size={13} className="animate-spin" /> : m.active ? "활동 중지" : "활동 재개"}
                </button>
              </div>

              {openMemberId === m.id && (
                <div className="border-t border-navy-100/20 px-4 py-3">
                  <p className="mb-2 text-[12px] leading-relaxed text-navy-400">{m.bio}</p>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-500">최근 활동 내역</p>
                  {!detail[m.id] && <p className="py-2 text-[12px] text-navy-400">불러오는 중...</p>}
                  {detail[m.id]?.length === 0 && <p className="py-2 text-[12px] text-navy-400">활동 내역이 없습니다.</p>}
                  <div className="space-y-1">
                    {detail[m.id]?.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-[12px]">
                        <span className="shrink-0 rounded bg-navy-100/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-navy-300">
                          {KIND_LABEL[a.kind] ?? a.kind}
                        </span>
                        <span className="truncate text-navy-500">{a.summary || "-"}</span>
                        <span className="ml-auto shrink-0 text-navy-400">{kstFormat(a.createdAt, "MM.dd HH:mm")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "contents" && (
        <>
          {/* 피드 종류별 필터 */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="피드 종류 필터">
            <KindChip
              label="전체"
              count={contents.length}
              active={kindFilter === "ALL"}
              onClick={() => setKindFilter("ALL")}
            />
            {CONTENT_KINDS.map((k) => (
              <KindChip
                key={k}
                label={KIND_LABEL[k]}
                count={kindCounts[k] ?? 0}
                active={kindFilter === k}
                onClick={() => setKindFilter(k)}
              />
            ))}
          </div>
          {/* 목록이 잘린 경우에만 안내 — 칩의 건수가 전체가 아님을 분명히 한다 */}
          {contentTotal != null && contentTotal > contents.length && (
            <p className="text-[11.5px] text-navy-400">
              전체 {contentTotal.toLocaleString()}건 중 최신 {contents.length.toLocaleString()}건을 표시합니다. 위 건수도 표시된 범위 기준입니다.
            </p>
          )}

          <div className="hidden md:block">
            <Table head={["영역", "내용", "작성자", "생성 시각", "관리"]}>
              {filteredContents.length === 0 && (
                <tr><td colSpan={5} className="p-0"><EmptyState title={kindFilter === "ALL" ? "생성된 글이 없습니다" : `${KIND_LABEL[kindFilter]} 글이 없습니다`} desc={kindFilter === "ALL" ? "'지금 활동 생성'을 눌러 첫 글을 만들어 보세요." : "다른 종류를 선택해 보세요."} /></td></tr>
              )}
              {filteredContents.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3"><Badge tone="aqua">{KIND_LABEL[c.kind] ?? c.kind}</Badge></td>
                  <td className="max-w-[420px] px-4 py-3"><p className="truncate text-navy-700">{c.summary || "-"}</p></td>
                  <td className="px-4 py-3 text-navy-500">{c.nickname}</td>
                  <td className="px-4 py-3 text-navy-400">{kstFormat(c.createdAt, "MM.dd HH:mm")}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteContent(c)} disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50">
                      {loading === `content-${c.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} 삭제
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div className="space-y-2 md:hidden">
            {filteredContents.length === 0 && (
              <EmptyState title={kindFilter === "ALL" ? "생성된 글이 없습니다" : `${KIND_LABEL[kindFilter]} 글이 없습니다`} />
            )}
            {filteredContents.map((c) => (
              <div key={c.id} className="rounded-2xl border border-navy-100/20 bg-[#162538] p-3.5">
                <div className="flex items-center gap-2">
                  <Badge tone="aqua">{KIND_LABEL[c.kind] ?? c.kind}</Badge>
                  <span className="text-[12px] text-navy-400">{c.nickname}</span>
                  <span className="ml-auto text-[11.5px] text-navy-400">{kstFormat(c.createdAt, "MM.dd HH:mm")}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-navy-700">{c.summary || "-"}</p>
                <button onClick={() => deleteContent(c)} disabled={busy}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50">
                  {loading === `content-${c.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} 삭제
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          {/* OpenAI 키 */}
          <div className="rounded-2xl border border-navy-100/20 bg-[#162538] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aqua-400 to-blue-500 text-white">
                <Bot size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[14px] font-bold text-navy-800">
                  OpenAI API 키 {openaiConfigured && <Badge tone="green">등록됨</Badge>}
                </h2>
                <p className="mt-0.5 text-[12px] leading-relaxed text-navy-400">
                  입력한 키는 서버에서 암호화(AES-256-GCM)해 보관합니다. 사이트 관리 &gt; 외부 API 연결과 같은 키를 사용합니다.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <input
                  type={keyVisible ? "text" : "password"}
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... (입력할 때에만 변경됩니다)"
                  className="w-full rounded-xl border border-navy-100 bg-navy-50/60 px-3 py-2.5 pr-10 text-[13px] text-navy-800 outline-none transition focus:border-aqua-400 focus:bg-white"
                />
                <button type="button" onClick={() => setKeyVisible((v) => !v)} aria-label={keyVisible ? "키 숨기기" : "키 표시"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400">
                  {keyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button onClick={saveApiKey} disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-[12.5px] font-bold text-gray-900 transition hover:bg-orange-600 disabled:opacity-50">
                {loading === "apikey" ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} 저장
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-navy-400">사용 모델: <span className="font-mono text-navy-300">{config.model}</span></p>
          </div>

          {/* 주기 / 한도 */}
          <div className="grid gap-4 md:grid-cols-2">
            <NumberSetting
              icon={Clock}
              title="활동 주기"
              desc="스케줄러가 활동을 생성하는 간격입니다. 1~24시간 사이로 설정할 수 있습니다."
              unit="시간"
              value={interval_}
              onChange={setInterval_}
              min={1}
              max={24}
              busy={busy}
              saving={loading === "interval"}
              onSave={() => run("interval", { type: "SET_INTERVAL", value: Number(interval_) })}
            />
            <NumberSetting
              icon={Gauge}
              title="일일 최대 호출 수"
              desc="하루에 사용할 OpenAI 호출 상한입니다. 초과하면 다음 날까지 활동을 건너뜁니다."
              unit="회 / 일"
              value={limit}
              onChange={setLimit}
              min={0}
              max={2000}
              busy={busy}
              saving={loading === "limit"}
              onSave={() => run("limit", { type: "SET_LIMIT", value: Number(limit) })}
            />
          </div>

          {/* 위험 구역 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <h2 className="text-[13px] font-bold text-red-400">위험 구역</h2>
            </div>
            <DangerRow
              title="가상회원 데이터 전체 초기화"
              desc="가상회원 100명과 그들이 만든 글·댓글·좋아요·중고글을 모두 삭제합니다. 실제 회원 데이터는 유지됩니다."
              label="가상회원 초기화"
              busy={busy}
              loading={loading === "reset"}
              onClick={resetMembers}
            />
            <DangerRow
              title="전체 데이터 초기화"
              desc="최고관리자 계정과 최고관리자가 등록한 콘텐츠(상품·예약·배너·대회·분류)만 남기고 모든 회원과 게시글·거래 데이터를 삭제합니다."
              label="전체 초기화"
              busy={busy}
              loading={loading === "datareset"}
              onClick={resetAllData}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-navy-100/20 bg-[#162538] p-4">
      <p className="flex items-center gap-1.5 text-[12px] text-navy-400"><Icon size={13} /> {label}</p>
      <p className="text-[20px] font-extrabold text-navy-900">{value}</p>
      <p className="text-[11.5px] text-navy-400">{sub}</p>
    </div>
  );
}

function KindChip({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "border-orange-500 bg-orange-500 text-gray-900"
          : "border-navy-100/40 text-navy-400 hover:bg-white/[0.06] hover:text-navy-700",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] font-bold",
          active ? "bg-white/25 text-white" : "bg-navy-100/25 text-navy-400",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      className={cn("flex-1 border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors",
        active ? "border-orange-500 text-orange-500" : "border-transparent text-navy-400 hover:text-navy-700")}>
      {label}
    </button>
  );
}

function NumberSetting({
  icon: Icon, title, desc, unit, value, onChange, min, max, busy, saving, onSave,
}: {
  icon: typeof Clock; title: string; desc: string; unit: string;
  value: string; onChange: (v: string) => void; min: number; max: number;
  busy: boolean; saving: boolean; onSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-navy-100/20 bg-[#162538] p-4">
      <p className="flex items-center gap-1.5 text-[14px] font-bold text-navy-800"><Icon size={15} /> {title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-navy-400">{desc}</p>
      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl border border-navy-100 bg-navy-50/60 px-3 py-2.5 pr-16 text-[13px] text-navy-800 outline-none transition focus:border-aqua-400 focus:bg-white" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-navy-400">{unit}</span>
        </div>
        <button onClick={onSave} disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-[12.5px] font-bold text-gray-900 transition hover:bg-orange-600 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null} 저장
        </button>
      </div>
    </div>
  );
}

function DangerRow({
  title, desc, label, busy, loading, onClick,
}: { title: string; desc: string; label: string; busy: boolean; loading: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
        <div>
          <p className="text-[13.5px] font-bold text-red-300">{title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-navy-400">{desc}</p>
        </div>
      </div>
      <button onClick={onClick} disabled={busy}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-2.5 text-[12.5px] font-semibold text-red-300 transition-all hover:bg-red-500/25 active:scale-[0.97] disabled:opacity-50">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {label}
      </button>
    </div>
  );
}
