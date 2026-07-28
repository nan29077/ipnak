"use client";
import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButton";
import { EmptyState } from "@/components/ui";
import { kstFormat } from "@/lib/utils";

/* ───────────── ConfidenceBadge ───────────── */
function ConfidenceBadge({ value }: { value: number | null }) {
  const cls =
    value == null       ? "bg-rose-500/20 text-rose-300"
    : value >= 85       ? "bg-aqua-600/20 text-aqua-400"
    : value >= 70       ? "bg-amber-500/20 text-amber-300"
    :                     "bg-rose-500/20 text-rose-300";
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-bold ${cls}`}>
      {value == null ? "없음" : `${Math.round(value)}%`}
    </span>
  );
}

/* ───────────── StatusBadge ───────────── */
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  REVIEW:   { label: "심사중", cls: "bg-amber-500/20 text-amber-300" },
  APPROVED: { label: "승인",   cls: "bg-aqua-600/20 text-aqua-400" },
  REJECTED: { label: "반려",   cls: "bg-rose-500/20 text-rose-300" },
};
function SBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-navy-100/20 text-navy-400" };
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${s.cls}`}>{s.label}</span>;
}

/* ───────────── Types ───────────── */
type Entry = {
  id: string;
  status: string;
  speciesName: string;
  sizeCm: number;
  measuredLengthCm: number | null;
  calibrationLengthCm: number | null;
  confidence: number | null;
  measuredImageUrl: string | null;
  photoUrl: string | null;
  region: string | null;
  createdAt: string;
  user: { nickname: string };
  tournament: { id: string; title: string };
};

type Tournament = { id: string; title: string };

/* ───────────── Inner component (uses useSearchParams) ───────────── */
function ReviewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const tId   = searchParams.get("tournamentId") ?? "";
  const st    = searchParams.get("status")       ?? "";
  const sort  = searchParams.get("sort")         ?? "newest";

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (tId)  p.set("tournamentId", tId);
    if (st)   p.set("status", st);
    p.set("sort", sort);

    fetch(`/api/admin/reviews?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setTournaments(d.tournaments ?? []);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  function change(key: string, val: string) {
    startTransition(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (val) next.set(key, val); else next.delete(key);
      router.replace(`/admin/reviews?${next.toString()}`);
    });
  }

  const sel = "rounded-xl border border-navy-100 bg-navy-50 px-3 py-2 text-[13px] text-navy-700 focus:outline-none focus:ring-1 focus:ring-aqua-500";
  const pending = entries.filter((e) => e.status === "REVIEW").length;

  return (
    <div>
      {/* 타이틀 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-navy-900">대회 제출 심사</h1>
        <p className="mt-0.5 text-sm text-navy-400">
          총 {entries.length}건 · 심사 대기 {pending}건
        </p>
      </div>

      {/* 필터 바 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={tId}  onChange={(e) => change("tournamentId", e.target.value)} className={sel}>
          <option value="">전체 대회</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <select value={st}   onChange={(e) => change("status", e.target.value)} className={sel}>
          <option value="">전체 상태</option>
          <option value="REVIEW">심사중</option>
          <option value="APPROVED">승인</option>
          <option value="REJECTED">반려</option>
        </select>
        <select value={sort} onChange={(e) => change("sort", e.target.value)} className={sel}>
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="size_desc">크기 큰 순</option>
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-navy-400">불러오는 중...</div>
      ) : entries.length === 0 ? (
        <EmptyState title="제출된 기록이 없습니다" desc="조건에 맞는 대회 제출이 없습니다." />
      ) : (
        <>
          {/* PC 테이블 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100">
                  {["사진","참가자","대회","어종","길이","검증","지역","상태","제출일","심사"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-xs font-semibold text-navy-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const hasRuler = e.measuredLengthCm != null || e.calibrationLengthCm != null;
                  return (
                    <tr key={e.id} className="border-b border-navy-50 hover:bg-navy-50/30">
                      <td className="px-3 py-3">
                        <img src={e.measuredImageUrl || e.photoUrl || ""} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      </td>
                      <td className="px-3 py-3 font-semibold text-navy-800">{e.user.nickname}</td>
                      <td className="px-3 py-3 text-navy-500 max-w-[160px] truncate">{e.tournament.title}</td>
                      <td className="px-3 py-3 text-navy-500">{e.speciesName}</td>
                      <td className="px-3 py-3 font-bold text-navy-800">
                        {e.sizeCm}cm
                        {e.measuredLengthCm != null && (
                          <span className="ml-1 text-xs font-normal text-navy-400">계측 {e.measuredLengthCm}cm</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {hasRuler
                            ? <ShieldCheck size={15} className="text-aqua-500" />
                            : <ShieldAlert size={15} className="text-rose-400" />}
                          <ConfidenceBadge value={e.confidence ?? null} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-navy-400">{e.region}</td>
                      <td className="px-3 py-3"><SBadge status={e.status} /></td>
                      <td className="px-3 py-3 text-navy-400 whitespace-nowrap">
                        {kstFormat(new Date(e.createdAt), "MM.dd")}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          {e.status !== "APPROVED" && (
                            <ActionButton
                              payload={{ type: "ENTRY_REVIEW", id: e.id, status: "APPROVED" }}
                              label="승인" variant="primary" successMsg="승인되었습니다"
                            />
                          )}
                          {e.status !== "REJECTED" && (
                            <ActionButton
                              payload={{ type: "ENTRY_REVIEW", id: e.id, status: "REJECTED" }}
                              label="반려" variant="danger" successMsg="반려되었습니다"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 목록 */}
          <div className="space-y-3 md:hidden">
            {entries.map((e) => {
              const hasRuler = e.measuredLengthCm != null || e.calibrationLengthCm != null;
              return (
                <div
                  key={e.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#1e2028] px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    {(e.measuredImageUrl || e.photoUrl) && (
                      <img
                        src={e.measuredImageUrl || e.photoUrl || ""}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-navy-800">{e.user.nickname}</span>
                        <SBadge status={e.status} />
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-navy-600">{e.tournament.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px]">
                        <span className="font-bold text-navy-700">{e.speciesName} {e.sizeCm}cm</span>
                        {e.measuredLengthCm != null && (
                          <span className="text-navy-500">계측 {e.measuredLengthCm}cm</span>
                        )}
                        <span className="flex items-center gap-0.5">
                          {hasRuler
                            ? <ShieldCheck size={13} className="text-aqua-500" />
                            : <ShieldAlert size={13} className="text-rose-400" />}
                          <ConfidenceBadge value={e.confidence ?? null} />
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-navy-500">
                        {e.region} · {kstFormat(new Date(e.createdAt), "MM.dd")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {e.status !== "APPROVED" && (
                      <ActionButton
                        payload={{ type: "ENTRY_REVIEW", id: e.id, status: "APPROVED" }}
                        label="승인" variant="primary" successMsg="승인되었습니다"
                      />
                    )}
                    {e.status !== "REJECTED" && (
                      <ActionButton
                        payload={{ type: "ENTRY_REVIEW", id: e.id, status: "REJECTED" }}
                        label="반려" variant="danger" successMsg="반려되었습니다"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────── Page export (Suspense wrapper for useSearchParams) ───────────── */
export default function AdminReviews() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-navy-400">불러오는 중...</div>}>
      <ReviewsContent />
    </Suspense>
  );
}
