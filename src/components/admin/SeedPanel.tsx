"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DatabaseZap, Trash2, BookOpen, ShoppingBag, Newspaper, Users, Loader2,
  CheckCircle2, AlertTriangle, Plus, Minus, Fish, Route, Package,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ConfirmDialog";

type Stats = {
  anglerCount: number;
  postCount: number;
  logCount: number;
  marketCount: number;
  feedCount: number;
  walkingFeedCount: number;
  generalFeedCount: number;
  productCount: number;
};

type LoadingKey = string;

interface SeedGroup {
  title: string;
  icon: any;
  iconColor: string;
  items: SeedItem[];
}

interface SeedItem {
  key: string;
  label: string;
  desc: string;
  addApi: string;
  deleteType: string;
  color: string;
}

const SEED_GROUPS: SeedGroup[] = [
  {
    title: "회원 더미",
    icon: Users,
    iconColor: "purple",
    items: [
      {
        key: "anglers",
        label: "낚시꾼 회원",
        desc: "10명의 더미 ANGLER 회원을 생성합니다 (angler01~10@ipnak.test)",
        addApi: "/api/admin/seed-anglers",
        deleteType: "anglers",
        color: "purple",
      },
    ],
  },
  {
    title: "피드 더미",
    icon: Newspaper,
    iconColor: "amber",
    items: [
      {
        key: "feeds-fishing",
        label: "피싱 피드",
        desc: "낚시 조황 피드 12개를 추가합니다 (어종·포인트 포함)",
        addApi: "/api/admin/seed-feeds",
        deleteType: "feeds-fishing",
        color: "amber",
      },
      {
        key: "feeds-general",
        label: "일상 피드",
        desc: "낚시 일상·장비·동출 등 일반 커뮤니티 피드 12개를 추가합니다",
        addApi: "/api/admin/seed-feeds-general",
        deleteType: "feeds-general",
        color: "orange",
      },
      {
        key: "feeds-walking",
        label: "워킹 피드",
        desc: "워킹 낚시 세션 기록 피드 8개를 추가합니다",
        addApi: "/api/admin/seed-feeds-walking",
        deleteType: "feeds-walking",
        color: "green",
      },
    ],
  },
  {
    title: "조행기 더미",
    icon: BookOpen,
    iconColor: "orange",
    items: [
      {
        key: "logs",
        label: "조행기",
        desc: "바다·민물·워킹 등 10개의 더미 조행기 게시글을 추가합니다",
        addApi: "/api/admin/seed-logs",
        deleteType: "logs",
        color: "orange",
      },
    ],
  },
  {
    title: "중고마켓 더미",
    icon: ShoppingBag,
    iconColor: "aqua",
    items: [
      {
        key: "market",
        label: "중고마켓 게시글",
        desc: "낚시 용품 중고거래 더미 게시글 20개를 추가합니다",
        addApi: "/api/admin/seed-market",
        deleteType: "market",
        color: "aqua",
      },
    ],
  },
  {
    title: "쇼핑 상품 더미",
    icon: Package,
    iconColor: "rose",
    items: [
      {
        key: "products",
        label: "쇼핑 상품",
        desc: "피싱태그·쇼핑 메뉴용 더미 상품 10개를 추가합니다",
        addApi: "/api/admin/seed-products",
        deleteType: "products",
        color: "rose",
      },
    ],
  },
];

const COLOR_CLASSES: Record<string, { bg: string; text: string; hoverBg: string; addBtn: string; delBtn: string }> = {
  purple: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    hoverBg: "hover:bg-purple-500/25",
    addBtn: "bg-purple-500 hover:bg-purple-600",
    delBtn: "border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20",
  },
  amber: {
    bg: "bg-amber-400/15",
    text: "text-amber-400",
    hoverBg: "hover:bg-amber-400/25",
    addBtn: "bg-amber-500 hover:bg-amber-600",
    delBtn: "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
  },
  orange: {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    hoverBg: "hover:bg-orange-500/25",
    addBtn: "bg-orange-500 hover:bg-orange-600",
    delBtn: "border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20",
  },
  green: {
    bg: "bg-green-500/15",
    text: "text-green-400",
    hoverBg: "hover:bg-green-500/25",
    addBtn: "bg-green-600 hover:bg-green-700",
    delBtn: "border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20",
  },
  aqua: {
    bg: "bg-aqua-400/15",
    text: "text-aqua-400",
    hoverBg: "hover:bg-aqua-400/25",
    addBtn: "bg-aqua-500/90 hover:bg-aqua-500",
    delBtn: "border-aqua-400/40 bg-aqua-400/10 text-aqua-300 hover:bg-aqua-400/20",
  },
  rose: {
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    hoverBg: "hover:bg-rose-500/25",
    addBtn: "bg-rose-500 hover:bg-rose-600",
    delBtn: "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  },
};

export function SeedPanel({ stats }: { stats: Stats }) {
  const [loading, setLoading] = useState<LoadingKey | null>(null);
  const router = useRouter();
  const toast = useToast();
  const doConfirm = useConfirm();

  async function runAdd(key: string, api: string) {
    const lk = `add-${key}`;
    setLoading(lk);
    try {
      const res = await fetch(api, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(data.message || "완료", "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(null);
    }
  }

  async function runDelete(key: string, deleteType: string, label: string) {
    if (!await doConfirm({ title: `"${label}" 더미 데이터 삭제`, message: "삭제된 데이터는 복구할 수 없습니다.", danger: true, confirmLabel: "삭제" })) return;
    const lk = `del-${key}`;
    setLoading(lk);
    try {
      const res = await fetch("/api/admin/seed-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: deleteType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(data.message || "삭제 완료", "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(null);
    }
  }

  async function wipeAll() {
    if (!await doConfirm({ title: "더미 데이터 전체 삭제", message: "ANGLER 계정 전체와 관련 게시글·댓글 등 모든 더미 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.", danger: true, confirmLabel: "전체 삭제" })) return;
    setLoading("wipe");
    try {
      const res = await fetch("/api/admin/seed-wipe", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast(data.message || "전체 삭제 완료", "success");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* 현황 요약 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "ANGLER 계정", value: stats.anglerCount, icon: Users },
          { label: "전체 게시글", value: stats.postCount, icon: Newspaper },
          { label: "조행기", value: stats.logCount, icon: BookOpen },
          { label: "중고마켓", value: stats.marketCount, icon: ShoppingBag },
          { label: "피싱 피드", value: stats.feedCount, icon: Fish },
          { label: "일상 피드", value: stats.generalFeedCount, icon: Newspaper },
          { label: "워킹 피드", value: stats.walkingFeedCount, icon: Route },
          { label: "쇼핑 상품", value: stats.productCount, icon: Package },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-2xl border border-navy-100/20 bg-[#162538] p-4">
            <p className="text-[12px] text-navy-400">{s.label}</p>
            <p className="text-[22px] font-extrabold text-navy-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 그룹별 카드 */}
      {SEED_GROUPS.map((group) => {
        const GroupIcon = group.icon;
        const groupColor = COLOR_CLASSES[group.iconColor] || COLOR_CLASSES.orange;
        return (
          <div key={group.title} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-xl", groupColor.bg)}>
                <GroupIcon size={14} className={groupColor.text} strokeWidth={2} />
              </div>
              <h2 className={cn("text-[13px] font-bold", groupColor.text)}>{group.title}</h2>
            </div>

            <div className="space-y-2">
              {group.items.map((item) => {
                const c = COLOR_CLASSES[item.color] || COLOR_CLASSES.orange;
                const isAdding = loading === `add-${item.key}`;
                const isDeleting = loading === `del-${item.key}`;
                return (
                  <div
                    key={item.key}
                    className="flex flex-col gap-3 rounded-2xl border border-navy-100/20 bg-[#162538] p-4 md:flex-row md:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-navy-800">{item.label}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-navy-400">{item.desc}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {/* 추가 버튼 */}
                      <button
                        onClick={() => runAdd(item.key, item.addApi)}
                        disabled={!!loading}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50",
                          c.addBtn,
                        )}
                      >
                        {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        {isAdding ? "생성 중..." : "더미 추가"}
                      </button>
                      {/* 삭제 버튼 */}
                      <button
                        onClick={() =>
                          runDelete(
                            item.key,
                            item.deleteType,
                            item.label,
                          )
                        }
                        disabled={!!loading}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50",
                          c.delBtn,
                        )}
                      >
                        {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Minus size={13} />}
                        {isDeleting ? "삭제 중..." : "더미 삭제"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 위험 구역 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400" />
          <h2 className="text-[13px] font-bold text-red-400">위험 구역</h2>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
            <div>
              <p className="text-[14px] font-bold text-red-300">더미 데이터 전체 삭제</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-navy-400">
                ANGLER 계정 전체와 관련 게시글·중고마켓·댓글 등 모든 더미 데이터를 삭제합니다. 최고 관리자 계정은 유지됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={wipeAll}
            disabled={!!loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-2.5 text-[13px] font-semibold text-red-300 transition-all hover:bg-red-500/25 active:scale-[0.97] disabled:opacity-50 md:shrink-0"
          >
            {loading === "wipe" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading === "wipe" ? "삭제 중..." : "전체 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
