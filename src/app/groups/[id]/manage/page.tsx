"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Check, X, UserMinus, Loader2, Users, UserCheck, Crown, Shield,
  Settings, BarChart3, AlertTriangle, ChevronDown, CheckCircle, Save, Trash2,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatarUtils";

const CATEGORIES = ["어종별", "지역별", "장르별", "동행", "기타"];
const FISH_SPECIES = ["배스", "송어", "잉어", "숭어", "광어", "우럭", "참돔", "감성돔", "기타"];
const REGIONS = ["서울", "경기", "강원", "충청", "전라", "경상", "제주"];

type Member = {
  id: string; userId: string; groupId: string; role: string; joinedAt: string;
  nickname: string; avatarUrl: string | null; email: string;
};

type GroupInfo = {
  id: string; name: string; description: string | null; category: string;
  region: string | null; fishSpecies: string | null; tags: string[]; imageUrl: string | null;
};

type TabKey = "pending" | "members" | "settings" | "stats";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "pending", label: "가입 신청", icon: <UserCheck size={14} strokeWidth={1.5} /> },
  { key: "members", label: "회원 목록", icon: <Users size={14} strokeWidth={1.5} /> },
  { key: "settings", label: "낚시단 설정", icon: <Settings size={14} strokeWidth={1.5} /> },
  { key: "stats", label: "통계", icon: <BarChart3 size={14} strokeWidth={1.5} /> },
];

export default function GroupManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("pending");
  const [members, setMembers] = useState<Member[]>([]);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // 설정 폼
  const [form, setForm] = useState({ name: "", description: "", category: "어종별", region: "", fishSpecies: "", tagsInput: "" });
  const [saving, setSaving] = useState(false);

  // 확인 모달
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [dissolveOpen, setDissolveOpen] = useState(false);
  const [dissolveInput, setDissolveInput] = useState("");
  const [dissolving, setDissolving] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function load() {
    setLoading(true);
    const [mRes, gRes] = await Promise.all([
      fetch(`/api/groups/${id}/members`),
      fetch(`/api/groups/${id}`),
    ]);
    if (mRes.status === 403) { setError("단장만 접근할 수 있습니다."); setLoading(false); return; }
    const mData = await mRes.json();
    const gData = await gRes.json();
    setMembers(mData.members || []);
    if (gData.group) {
      setGroup(gData.group);
      setForm({
        name: gData.group.name || "",
        description: gData.group.description || "",
        category: gData.group.category || "어종별",
        region: gData.group.region || "",
        fishSpecies: gData.group.fishSpecies || "",
        tagsInput: (gData.group.tags || []).join(", "),
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function act(userId: string, action: string) {
    setActing(userId + action);
    const res = await fetch(`/api/groups/${id}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "오류가 발생했습니다.");
      return false;
    }
    return true;
  }

  async function approveAll() {
    setActing("approveAll");
    for (const m of members.filter(m => m.role === "pending")) {
      await fetch(`/api/groups/${id}/members/${m.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
    }
    setActing(null);
    showToast("전체 승인이 완료되었습니다.");
    await load();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { showToast("낚시단 이름을 입력해주세요."); return; }
    setSaving(true);
    const tags = form.tagsInput.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean);
    const res = await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description,
        category: form.category,
        region: form.region,
        fishSpecies: form.fishSpecies,
        tags,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "저장에 실패했습니다.");
      return;
    }
    showToast("낚시단 정보가 저장되었습니다.");
    await load();
  }

  async function dissolve() {
    if (!group || dissolveInput !== group.name) return;
    setDissolving(true);
    const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
    setDissolving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "해산에 실패했습니다.");
      return;
    }
    router.push("/groups");
  }

  const pending = members.filter(m => m.role === "pending");
  const active = members.filter(m => m.role !== "pending");
  const subLeaders = active.filter(m => m.role === "sub_leader");
  const recentJoined = [...active]
    .filter(m => m.role !== "leader")
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[#161616] pb-20">
      <div className="flex items-center gap-3 border-b border-navy-100/20 px-3.5 py-3">
        <Link href={`/groups/${id}`}><ArrowLeft size={20} className="text-navy-400" /></Link>
        <div>
          <h1 className="text-[15px] font-extrabold text-navy-900">낚시단 관리</h1>
          {group?.name && <p className="text-[11px] text-navy-400">{group.name}</p>}
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-red-400 text-[14px]">{error}</p>
          <Link href={`/groups/${id}`} className="text-orange-500 text-sm underline">낚시단으로 돌아가기</Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-orange-500" /></div>
      ) : (
        <>
          {/* 탭 */}
          <div className="sticky top-0 z-20 flex gap-1.5 overflow-x-auto border-b border-navy-100/20 bg-[#161616]/95 px-3.5 py-2.5 backdrop-blur-md no-scrollbar">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all",
                  tab === t.key ? "bg-orange-500 text-white" : "bg-navy-50/10 text-navy-400 hover:bg-navy-50/20")}>
                {t.icon} {t.label}
                {t.key === "pending" && pending.length > 0 && (
                  <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold",
                    tab === "pending" ? "bg-white/25 text-white" : "bg-orange-500 text-white")}>
                    {pending.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* 탭 1: 가입 신청 */}
            {tab === "pending" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-navy-800">대기 중인 신청 ({pending.length}건)</p>
                  {pending.length > 1 && (
                    <button onClick={approveAll} disabled={acting === "approveAll"}
                      className="flex items-center gap-1 rounded-full bg-green-500/15 px-3 py-1.5 text-[12px] font-bold text-green-400 hover:bg-green-500/25 disabled:opacity-50">
                      {acting === "approveAll" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      전체 승인
                    </button>
                  )}
                </div>
                {pending.length === 0 ? (
                  <div className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] py-8 text-center text-[13px] text-navy-400">
                    <UserCheck size={22} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
                    대기 중인 신청이 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pending.map(m => (
                      <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-orange-500/20 bg-[#1e1e1e] p-3">
                        <Avatar m={m} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-navy-800">{m.nickname}</p>
                          <p className="text-[11px] text-navy-400">{timeAgo(m.joinedAt)} 신청</p>
                        </div>
                        <div className="flex gap-1.5">
                          <ActionBtn
                            onClick={async () => { if (await act(m.userId, "approve")) { showToast(`${m.nickname}님을 승인했습니다.`); await load(); } }}
                            loading={acting === m.userId + "approve"}
                            variant="green" label="승인">
                            <Check size={14} />
                          </ActionBtn>
                          <ActionBtn
                            onClick={async () => { if (await act(m.userId, "reject")) { showToast(`${m.nickname}님의 신청을 거절했습니다.`); await load(); } }}
                            loading={acting === m.userId + "reject"}
                            variant="red" label="거절">
                            <X size={14} />
                          </ActionBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 탭 2: 회원 목록 */}
            {tab === "members" && (
              <section className="space-y-3">
                <p className="text-[13px] font-bold text-navy-800">현재 회원 ({active.length}명)</p>
                {active.length === 0 ? (
                  <div className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] py-8 text-center text-[13px] text-navy-400">
                    <Users size={22} className="mx-auto mb-2 text-navy-300" strokeWidth={1.5} />
                    회원이 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {active.map(m => (
                      <div key={m.id} className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-3">
                        <div className="flex items-center gap-3">
                          <Avatar m={m} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[13px] font-semibold text-navy-800">{m.nickname}</p>
                              <RoleBadge role={m.role} />
                            </div>
                            <p className="text-[11px] text-navy-400">{timeAgo(m.joinedAt)} 가입</p>
                          </div>
                        </div>
                        {m.role !== "leader" && (
                          <div className="mt-2.5 flex gap-1.5 border-t border-navy-100/10 pt-2.5">
                            <button
                              onClick={async () => {
                                const wasSub = m.role === "sub_leader";
                                if (await act(m.userId, "promote")) {
                                  showToast(wasSub ? `${m.nickname}님을 부단장에서 해제했습니다.` : `${m.nickname}님을 부단장로 지정했습니다.`);
                                  await load();
                                }
                              }}
                              disabled={acting === m.userId + "promote"}
                              className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50",
                                m.role === "sub_leader" ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20")}>
                              {acting === m.userId + "promote" ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} strokeWidth={1.5} />}
                              {m.role === "sub_leader" ? "부단장 해제" : "부단장 지정"}
                            </button>
                            <button onClick={() => setTransferTarget(m)}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-orange-500/10 py-1.5 text-[11px] font-semibold text-orange-400 transition-colors hover:bg-orange-500/20">
                              <Crown size={12} strokeWidth={1.5} /> 단장 양도
                            </button>
                            <button onClick={() => setRemoveTarget(m)}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-500/10 py-1.5 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20">
                              <UserMinus size={12} strokeWidth={1.5} /> 강제 탈퇴
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 탭 3: 낚시단 설정 */}
            {tab === "settings" && (
              <section className="space-y-5">
                <form onSubmit={saveSettings} className="space-y-4">
                  <Field label="낚시단 이름 *">
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="낚시단 이름" maxLength={40} className="manage-input" />
                  </Field>
                  <Field label="소개">
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="낚시단 소개를 입력해주세요" rows={3} maxLength={200} className="manage-input resize-none" />
                  </Field>
                  <Field label="카테고리">
                    <div className="relative">
                      <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        className="manage-input appearance-none pr-8">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300" />
                    </div>
                  </Field>
                  <Field label="지역">
                    <div className="relative">
                      <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                        className="manage-input appearance-none pr-8">
                        <option value="">지역 선택 안함</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300" />
                    </div>
                  </Field>
                  <Field label="주요 어종">
                    <div className="relative">
                      <select value={form.fishSpecies} onChange={e => setForm(f => ({ ...f, fishSpecies: e.target.value }))}
                        className="manage-input appearance-none pr-8">
                        <option value="">어종 선택 안함</option>
                        {FISH_SPECIES.map(fs => <option key={fs} value={fs}>{fs}</option>)}
                      </select>
                      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300" />
                    </div>
                  </Field>
                  <Field label="태그 (쉼표로 구분)">
                    <input value={form.tagsInput} onChange={e => setForm(f => ({ ...f, tagsInput: e.target.value }))}
                      placeholder="ex) 배스, 주말출조, 초보환영" className="manage-input" />
                  </Field>
                  <button type="submit" disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-[14px] font-extrabold text-white shadow-soft disabled:opacity-60">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={1.5} />}
                    {saving ? "저장 중..." : "저장하기"}
                  </button>
                </form>

                {/* 위험 구역 */}
                <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-red-400">
                    <AlertTriangle size={15} strokeWidth={1.5} /> 위험 구역
                  </div>
                  <p className="mb-3 text-[12px] leading-relaxed text-navy-400">
                    낚시단을 해산하면 모든 회원 정보가 삭제되며 되돌릴 수 없습니다.
                  </p>
                  <button onClick={() => { setDissolveInput(""); setDissolveOpen(true); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500/15 py-2.5 text-[13px] font-bold text-red-400 transition-colors hover:bg-red-500/25">
                    <Trash2 size={14} strokeWidth={1.5} /> 낚시단 해산
                  </button>
                </div>

                <style jsx global>{`
                  .manage-input {
                    width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #e8eaf6; outline: none;
                  }
                  .manage-input:focus { border-color: rgba(245,124,0,0.5); }
                  .manage-input option { background: #1e1e1e; color: #e8eaf6; }
                `}</style>
              </section>
            )}

            {/* 탭 4: 통계 */}
            {tab === "stats" && (
              <section className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <StatCard icon={<Users size={16} className="text-orange-400" strokeWidth={1.5} />} label="총 회원" value={active.length} />
                  <StatCard icon={<UserCheck size={16} className="text-green-400" strokeWidth={1.5} />} label="대기 신청" value={pending.length} />
                  <StatCard icon={<Shield size={16} className="text-blue-400" strokeWidth={1.5} />} label="부단장" value={subLeaders.length} />
                </div>

                <div className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-4">
                  <p className="mb-3 text-[13px] font-bold text-navy-800">최근 가입 회원</p>
                  {recentJoined.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-navy-400">아직 가입한 회원이 없습니다</p>
                  ) : (
                    <div className="space-y-2.5">
                      {recentJoined.map(m => (
                        <div key={m.id} className="flex items-center gap-2.5">
                          <Avatar m={m} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[13px] font-semibold text-navy-800">{m.nickname}</p>
                              <RoleBadge role={m.role} />
                            </div>
                          </div>
                          <p className="shrink-0 text-[11px] text-navy-400">{timeAgo(m.joinedAt)} 가입</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {/* 단장 양도 확인 모달 */}
      {transferTarget && (
        <Modal onClose={() => setTransferTarget(null)}>
          <div className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-navy-900">
            <Crown size={18} className="text-orange-400" strokeWidth={1.5} /> 단장 양도
          </div>
          <p className="mb-4 text-[13px] leading-relaxed text-navy-400">
            <span className="font-bold text-navy-800">{transferTarget.nickname}</span>님에게 단장를 양도하시겠습니까?
            양도 후에는 일반 회원이 되며 관리 권한을 잃게 됩니다.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setTransferTarget(null)}
              className="flex-1 rounded-xl bg-navy-50/10 py-2.5 text-[13px] font-bold text-navy-400">취소</button>
            <button
              onClick={async () => {
                const target = transferTarget;
                if (await act(target.userId, "transfer")) {
                  setTransferTarget(null);
                  router.push(`/groups/${id}`);
                } else {
                  setTransferTarget(null);
                }
              }}
              disabled={acting === transferTarget.userId + "transfer"}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
              {acting === transferTarget.userId + "transfer" && <Loader2 size={13} className="animate-spin" />}
              양도하기
            </button>
          </div>
        </Modal>
      )}

      {/* 강제 탈퇴 확인 모달 */}
      {removeTarget && (
        <Modal onClose={() => setRemoveTarget(null)}>
          <div className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-navy-900">
            <UserMinus size={18} className="text-red-400" strokeWidth={1.5} /> 강제 탈퇴
          </div>
          <p className="mb-4 text-[13px] leading-relaxed text-navy-400">
            <span className="font-bold text-navy-800">{removeTarget.nickname}</span>님을 낚시단에서 탈퇴시키겠습니까?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setRemoveTarget(null)}
              className="flex-1 rounded-xl bg-navy-50/10 py-2.5 text-[13px] font-bold text-navy-400">취소</button>
            <button
              onClick={async () => {
                const target = removeTarget;
                if (await act(target.userId, "remove")) {
                  showToast(`${target.nickname}님을 탈퇴시켰습니다.`);
                  await load();
                }
                setRemoveTarget(null);
              }}
              disabled={acting === removeTarget.userId + "remove"}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
              {acting === removeTarget.userId + "remove" && <Loader2 size={13} className="animate-spin" />}
              탈퇴시키기
            </button>
          </div>
        </Modal>
      )}

      {/* 낚시단 해산 확인 모달 */}
      {dissolveOpen && group && (
        <Modal onClose={() => setDissolveOpen(false)}>
          <div className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-red-400">
            <AlertTriangle size={18} strokeWidth={1.5} /> 낚시단 해산
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-navy-400">
            해산하려면 낚시단 이름 <span className="font-bold text-navy-800">{group.name}</span>을(를) 정확히 입력해주세요.
            이 작업은 되돌릴 수 없습니다.
          </p>
          <input value={dissolveInput} onChange={e => setDissolveInput(e.target.value)}
            placeholder={group.name}
            className="mb-4 w-full rounded-xl border border-red-500/30 bg-navy-50/5 px-3.5 py-2.5 text-[13px] text-navy-800 outline-none placeholder:text-navy-300 focus:border-red-500/60" />
          <div className="flex gap-2">
            <button onClick={() => setDissolveOpen(false)}
              className="flex-1 rounded-xl bg-navy-50/10 py-2.5 text-[13px] font-bold text-navy-400">취소</button>
            <button onClick={dissolve} disabled={dissolveInput !== group.name || dissolving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-[13px] font-bold text-white disabled:opacity-40">
              {dissolving && <Loader2 size={13} className="animate-spin" />}
              해산하기
            </button>
          </div>
        </Modal>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#2a2a2a] px-4 py-2.5 text-[13px] font-semibold text-navy-800 shadow-lg border border-navy-100/20">
          <CheckCircle size={15} className="text-green-400" strokeWidth={1.5} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Avatar({ m }: { m: Member }) {
  return (
    <img src={getAvatarUrl(m.userId, m.avatarUrl)} alt={m.nickname} className="h-9 w-9 shrink-0 rounded-full object-cover" />
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "leader")
    return <span className="shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">단장</span>;
  if (role === "sub_leader")
    return <span className="shrink-0 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">부단장</span>;
  return <span className="shrink-0 rounded-full bg-navy-50/20 px-1.5 py-0.5 text-[10px] font-bold text-navy-400">단원</span>;
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-3 text-center">
      <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50/10">{icon}</div>
      <p className="text-[18px] font-extrabold text-navy-900">{value}</p>
      <p className="text-[11px] text-navy-400">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-bold text-navy-400">{label}</label>
      {children}
    </div>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-5" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-navy-100/20 bg-[#1e1e1e] p-5" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, loading, variant, label, children }: {
  onClick: () => void; loading: boolean; variant: "green" | "red"; label: string; children: React.ReactNode;
}) {
  const cls = variant === "green"
    ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
    : "bg-red-500/15 text-red-400 hover:bg-red-500/25";
  return (
    <button onClick={onClick} disabled={loading} aria-label={label}
      className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50", cls)}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : children}
    </button>
  );
}
