"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles, MapPin, Fish, CalendarDays, Compass, TrendingUp,
  ChevronRight, Loader2, Ruler, Search, Waves, Droplets, Globe, ExternalLink,
} from "lucide-react";
import { Sheet, Button, Badge, Card, Select } from "@/components/ui";
import { PointMiniMap } from "@/components/map/PointMiniMap";
import { KOREA_REGIONS } from "@/lib/regions";
import { ALL_SPECIES } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";

type MemberPost = {
  id: string; imageUrl: string | null; caption: string | null;
  speciesName: string | null; sizeCm: number | null; fishingType: string | null;
  postType: string; createdAt: string;
  author: { id: string; nickname: string; avatarUrl: string | null };
};
type RecPoint = {
  id: string; name: string; type: string; typeLabel: string; water: "민물" | "바다";
  sido: string; sigungu: string; lat: number; lng: number; postCount: number;
  species: { name: string; count: number }[];
  lastActivity: string | null; score: number; reason: string; posts: MemberPost[];
};
type WebFishReport = { title: string; link: string; description: string; blogger: string; date: string };
type RecResult = { basis: string; broadened?: boolean; points: RecPoint[]; query: any; webResults?: WebFishReport[] };

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
function daysInMonth(m: number) { return [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m] || 31; }

export function AiPointRecommend({ variant = "feed" }: { variant?: "feed" | "bar" }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [sido, setSido] = useState("전체");
  const [sigungu, setSigungu] = useState("전체");
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));
  const [species, setSpecies] = useState("전체");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecResult | null>(null);

  const sigunguList = useMemo(
    () => KOREA_REGIONS.find((s) => s.name === sido)?.sigungu ?? [],
    [sido]
  );
  const dayList = useMemo(() => Array.from({ length: daysInMonth(Number(month)) }, (_, i) => i + 1), [month]);

  async function recommend() {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/points/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sido, sigungu,
          month: Number(month), day: Number(day),
          species: species === "전체" ? null : species,
        }),
      });
      setData(await res.json());
    } catch {
      setData({ basis: "추천을 불러오지 못했어요. 잠시 후 다시 시도해주세요.", points: [], query: {} });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {variant === "bar" ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="AI 포인트 추천"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-orange-500/95 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-card backdrop-blur btn-press transition-colors hover:bg-orange-600"
        >
          <Sparkles size={15} />
          AI 포인트 추천
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="AI 포인트 추천"
          className="mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 to-[#161616] px-4 py-3.5 text-left shadow-card btn-press transition-colors hover:from-orange-500/25"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-soft">
            <Sparkles size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-navy-900">AI 포인트 추천</span>
            <span className="block truncate text-[12px] text-navy-400">회원 조황 데이터로 낚시 명당을 찾아드려요</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-orange-400" />
        </button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="AI 포인트 추천">
        {!data ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-navy-400">
              회원들이 등록한 조황글을 분석해 조건에 맞는 낚시 포인트(명당)를 추천해드려요.
            </p>

            <Field icon={<MapPin size={15} className="text-orange-500" />} label="출조 지역">
              <div className="grid grid-cols-2 gap-2">
                <Select value={sido} onChange={(e) => { setSido(e.target.value); setSigungu("전체"); }}>
                  <option value="전체">시·도 전체</option>
                  {KOREA_REGIONS.map((s) => (<option key={s.name} value={s.name}>{s.name}</option>))}
                </Select>
                <Select value={sigungu} onChange={(e) => setSigungu(e.target.value)} disabled={sido === "전체"}>
                  <option value="전체">{sido === "전체" ? "시·도 먼저 선택" : "시·군·구 전체"}</option>
                  {sigunguList.map((g) => (<option key={g.name} value={g.name}>{g.name}</option>))}
                </Select>
              </div>
            </Field>

            <Field icon={<CalendarDays size={15} className="text-orange-500" />} label="출조 날짜">
              <div className="grid grid-cols-2 gap-2">
                <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                  {MONTHS.map((m) => (<option key={m} value={String(m)}>{m}월</option>))}
                </Select>
                <Select value={day} onChange={(e) => setDay(e.target.value)}>
                  {dayList.map((d) => (<option key={d} value={String(d)}>{d}일</option>))}
                </Select>
              </div>
            </Field>

            <Field icon={<Fish size={15} className="text-orange-500" />} label="대상 어종 (선택)">
              <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
                <option value="전체">어종 무관</option>
                {ALL_SPECIES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </Select>
            </Field>

            <Button onClick={recommend} disabled={loading} full leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}>
              {loading ? "분석하는 중..." : `${Number(month)}월 ${Number(day)}일 포인트 추천 받기`}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl bg-orange-500/10 px-3 py-2.5">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-orange-400" />
              <p className="text-[13px] leading-relaxed text-navy-700">{data.basis}</p>
            </div>

            {data.points.length === 0 ? (
              <div className="py-10 text-center">
                <Search size={28} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
                <p className="text-[14px] font-semibold text-navy-700">추천할 포인트가 없어요</p>
                <p className="mt-1 text-[12px] text-navy-400">지역을 바꿔보거나 회원들의 조황글이 쌓이면 추천이 정확해져요.</p>
              </div>
            ) : (
              data.points.map((pt, idx) => <PointCard key={pt.id} point={pt} rank={idx + 1} />)
            )}

            {/* ---- 웹 조황 검색 결과 ---- */}
            <WebReportsSection reports={data.webResults} query={data.query} />

            <Button onClick={() => setData(null)} variant="outline" full leftIcon={<ChevronRight size={16} className="rotate-180" />}>
              조건 다시 설정
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

function WebReportsSection({ reports, query }: { reports?: WebFishReport[]; query: any }) {
  // 네이버 검색 직접 링크 (API 미설정 시에도 항상 노출)
  const naverQuery = [query.sido !== "전체" ? query.sido : "", query.sigungu !== "전체" ? query.sigungu : "", query.species || "", "조황", query.month ? `${query.month}월` : "", query.day ? `${query.day}일` : ""]
    .filter(Boolean).join(" ").trim();
  const naverUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(naverQuery)}&where=blog&sm=tab_opt&nso=so%3Add%2Cp%3A1m`;

  return (
    <div className="mt-1">
      {/* 헤더 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-navy-700">
          <Globe size={14} className="text-blue-400" /> 웹 조황 검색
        </span>
        <a href={naverUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-navy-300 hover:text-blue-400"
        >
          네이버 검색 더보기 <ExternalLink size={11} />
        </a>
      </div>

      {/* 결과 없음 — API 미설정 시 네이버 링크만 노출 */}
      {(!reports || reports.length === 0) && (
        <a
          href={naverUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-xl bg-blue-500/8 px-3.5 py-3 ring-1 ring-blue-500/15 transition-colors hover:bg-blue-500/15"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-navy-700">"{naverQuery}" 네이버 블로그 검색</p>
            <p className="mt-0.5 text-[11px] text-navy-400">최신 조황 블로그 글을 바로 확인해보세요</p>
          </div>
          <ExternalLink size={15} className="shrink-0 text-blue-400" />
        </a>
      )}

      {/* API 결과 */}
      {reports && reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((r, i) => (
            <a
              key={i} href={r.link} target="_blank" rel="noopener noreferrer"
              className="flex flex-col gap-0.5 rounded-xl bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/8 transition-colors hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-[13px] font-semibold leading-snug text-navy-800 line-clamp-1">{r.title}</p>
                <ExternalLink size={13} className="mt-0.5 shrink-0 text-navy-400" />
              </div>
              <p className="text-[12px] leading-relaxed text-navy-400 line-clamp-2">{r.description}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-navy-300">
                {r.blogger && <span>{r.blogger}</span>}
                {r.date && <span>· {r.date}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-navy-700">{icon}{label}</span>
      {children}
    </label>
  );
}

function PointCard({ point, rank }: { point: RecPoint; rank: number }) {
  const sea = point.water === "바다";
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[12px] font-bold text-white">{rank}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[15px] font-bold text-navy-900">
            <Compass size={14} className="shrink-0 text-orange-400" />
            <span className="truncate">{point.name}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-navy-400">{point.reason}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-500/15 px-2 py-1 text-[11px] font-bold text-orange-400">
          <TrendingUp size={12} />{point.score}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={sea ? "aqua" : "green"} className="gap-1">
          {sea ? <Waves size={11} /> : <Droplets size={11} />}{point.typeLabel}
        </Badge>
        <Badge tone="navy" className="gap-1"><MapPin size={11} />{point.sigungu}</Badge>
        {point.postCount > 0 && <Badge tone="gray" className="gap-1"><Fish size={11} />{point.postCount}건</Badge>}
        {point.species.slice(0, 3).map((s) => (
          <Badge key={s.name} tone="gray" className="gap-1">{s.name} {s.count}</Badge>
        ))}
        {point.lastActivity && <span className="ml-auto self-center text-[11px] text-navy-300">{timeAgo(point.lastActivity)}</span>}
      </div>

      <div className="mt-3">
        <PointMiniMap lat={point.lat} lng={point.lng} label={point.name} />
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[12px] font-semibold text-navy-500">회원 조황글</p>
        {point.posts.length === 0 ? (
          <p className="rounded-xl bg-white/[0.03] px-3 py-3 text-center text-[12px] text-navy-400">
            아직 이 포인트에 공유된 회원 글이 없어요.
          </p>
        ) : (
          point.posts.map((mp) => (
            <Link
              key={mp.id}
              href={`/post/${mp.id}`}
              className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-1.5 transition-colors hover:bg-white/[0.06]"
            >
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-navy-50">
                {mp.imageUrl ? (
                  <img src={mp.imageUrl} alt={mp.speciesName || "조황"} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-navy-300"><Fish size={18} /></span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <img src={getAvatarUrl(mp.author.id, mp.author.avatarUrl)} alt="" className="h-4 w-4 rounded-full object-cover" />
                  <span className="truncate text-[12px] font-semibold text-navy-700">{mp.author.nickname}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-navy-400">
                  {mp.speciesName && <span className="font-semibold text-orange-400">{mp.speciesName}</span>}
                  {mp.sizeCm != null && <span className="inline-flex items-center gap-0.5"><Ruler size={10} />{mp.sizeCm}cm</span>}
                  <span>· {timeAgo(mp.createdAt)}</span>
                </span>
              </span>
              <ChevronRight size={15} className="shrink-0 text-navy-300" />
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
