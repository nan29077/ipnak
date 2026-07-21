"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Users, MapPin, Fish, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["전체", "어종별", "지역별", "장르별", "동행"];
const FISH_SPECIES = ["", "배스", "송어", "잉어", "숭어", "광어", "우럭", "참돔", "감성돔"];
const REGIONS = ["", "서울", "경기", "강원", "충청", "전라", "경상", "제주"];

type Group = {
  id: string; name: string; description: string | null; category: string;
  region: string | null; fishSpecies: string | null; leaderNickname: string;
  leaderAvatar: string | null; memberCount: number; imageUrl: string | null;
  createdAt: string; tags: string[]; myRole: string | null;
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("전체");
  const [region, setRegion] = useState("");
  const [fishSpecies, setFishSpecies] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (fishSpecies) params.set("fishSpecies", fishSpecies);
    if (search) params.set("search", search);
    const res = await fetch(`/api/groups?${params}`);
    const data = await res.json();
    setGroups(data.groups || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [region, fishSpecies, search]);

  const filtered = cat === "전체" ? groups : groups.filter(g => g.category === cat);

  return (
    <div className="min-h-screen bg-[#161616] pb-24">
      <div className="sticky top-0 z-20 border-b border-navy-100/20 bg-[#161616]/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-3.5 py-3">
          <h1 className="text-lg font-extrabold text-navy-900">낚시단</h1>
          <Link href="/groups/new" className="ml-auto flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-[13px] font-bold text-white shadow-soft">
            <Plus size={15} /> 만들기
          </Link>
        </div>
        {/* 검색바 */}
        <div className="px-3.5 pb-2">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="낚시단 이름 검색"
                className="w-full rounded-xl bg-navy-50/10 py-2 pl-8 pr-3 text-[13px] text-navy-800 placeholder:text-navy-300 outline-none border border-navy-100/20 focus:border-orange-500/50"
              />
            </div>
            <button type="submit" className="rounded-xl bg-orange-500/90 px-3 py-2 text-[13px] font-bold text-white">검색</button>
          </form>
        </div>
        {/* 카테고리 탭 */}
        <div className="flex gap-1.5 overflow-x-auto px-3.5 pb-2 no-scrollbar">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                cat === c ? "bg-orange-500 text-white" : "bg-navy-50/10 text-navy-400 hover:bg-navy-50/20")}>
              {c}
            </button>
          ))}
        </div>
        {/* 필터 */}
        <div className="flex gap-2 px-3.5 pb-3">
          <select value={region} onChange={e => setRegion(e.target.value)}
            className="rounded-lg bg-navy-50/10 px-2.5 py-1.5 text-[12px] text-navy-400 border border-navy-100/20 outline-none">
            <option value="">지역 전체</option>
            {REGIONS.filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={fishSpecies} onChange={e => setFishSpecies(e.target.value)}
            className="rounded-lg bg-navy-50/10 px-2.5 py-1.5 text-[12px] text-navy-400 border border-navy-100/20 outline-none">
            <option value="">어종 전체</option>
            {FISH_SPECIES.filter(Boolean).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div className="p-3.5">
        {loading ? (
          <div className="py-16 text-center text-sm text-navy-300">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="rounded-full bg-navy-50/10 p-4"><Users size={28} className="text-navy-300" strokeWidth={1.5} /></div>
            <p className="text-[14px] text-navy-400">낚시단이 없습니다</p>
            <Link href="/groups/new" className="rounded-full bg-orange-500 px-4 py-2 text-[13px] font-bold text-white">첫 낚시단 만들기</Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map(g => <GroupCard key={g.id} g={g} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupCard({ g }: { g: Group }) {
  return (
    <Link href={`/groups/${g.id}`}
      className="flex items-start gap-3 rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-3.5 transition-all hover:border-orange-500/40 hover:bg-[#222]">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-aqua-500/20 text-2xl">
        {g.imageUrl ? (
          <img src={g.imageUrl} alt={g.name} className="h-full w-full rounded-xl object-cover" />
        ) : (
          <Fish size={22} className="text-orange-400" strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[14px] font-bold text-navy-900">{g.name}</p>
          <span className="shrink-0 rounded-full bg-navy-50/20 px-1.5 py-0.5 text-[10px] text-navy-400">{g.category}</span>
        </div>
        {g.description && <p className="mt-0.5 line-clamp-2 text-[12px] text-navy-400">{g.description}</p>}
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-navy-300">
          <span className="inline-flex items-center gap-0.5"><Users size={11} /> {g.memberCount}명</span>
          {g.region && <span className="inline-flex items-center gap-0.5"><MapPin size={11} /> {g.region}</span>}
          {g.fishSpecies && <span className="inline-flex items-center gap-0.5"><Fish size={11} /> {g.fishSpecies}</span>}
        </div>
        <p className="mt-1 text-[11px] text-navy-300">단장 {g.leaderNickname}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <ChevronRight size={16} className="mt-1 text-navy-300" />
        {g.myRole === "leader" ? (
          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400">내 낚시단</span>
        ) : g.myRole === "member" || g.myRole === "sub_leader" ? (
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">가입됨</span>
        ) : g.myRole === "pending" ? (
          <span className="rounded-full bg-navy-50/20 px-2 py-0.5 text-[10px] font-bold text-navy-400">승인 대기중</span>
        ) : null}
      </div>
    </Link>
  );
}
