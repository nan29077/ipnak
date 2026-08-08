"use client";

import { useState, useCallback } from "react";
import { Search, Plus, Trash2, ToggleLeft, ToggleRight, Tag, RefreshCw } from "lucide-react";

type RegistryItem = {
  id: string;
  keyringId: string;
  memo: string | null;
  isActive: boolean;
  createdAt: string;
  linkedUserId?: string | null;
  linkedUserNickname?: string | null;
  linkedUserPhone?: string | null;
};

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-****-${digits.slice(6)}`;
  return phone;
}

type Props = {
  initialItems: RegistryItem[];
  initialTotal: number;
};

export function IpnakKeyringRegistryTab({ initialItems, initialTotal }: Props) {
  const [items, setItems] = useState<RegistryItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newKeyringId, setNewKeyringId] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchList = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ipnak-keyring/registry?q=${encodeURIComponent(q)}&page=${p}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchList(query, 1);
  };

  const handleRefresh = () => fetchList(query, page);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = newKeyringId.trim().toUpperCase();
    if (!id) { setAddError("키링 ID를 입력하세요."); return; }
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch("/api/admin/ipnak-keyring/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyringId: id, memo: newMemo.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "등록 실패"); return; }
      setNewKeyringId("");
      setNewMemo("");
      setShowAdd(false);
      fetchList(query, page);
    } catch {
      setAddError("네트워크 오류");
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggle = async (item: RegistryItem) => {
    const next = !item.isActive;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: next } : i));
    const res = await fetch("/api/admin/ipnak-keyring/registry", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: next }),
    });
    if (!res.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: item.isActive } : i));
      alert("수정 실패");
    }
  };

  const handleDelete = async (item: RegistryItem) => {
    const linkedInfo = item.linkedUserNickname
      ? `\n현재 [${item.linkedUserNickname}] 회원과 연동 중입니다. 삭제 시 연동이 함께 해제됩니다.`
      : "";
    if (!confirm(`키링 ID '${item.keyringId}'를 삭제하시겠습니까?${linkedInfo}`)) return;
    const res = await fetch("/api/admin/ipnak-keyring/registry", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (res.ok) {
      fetchList(query, page);
    } else {
      alert("삭제 실패");
    }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="키링 ID 또는 메모 검색"
              className="w-full rounded-lg border border-navy-100 bg-[#0d1b2a] py-2 pl-9 pr-3 text-sm text-navy-800 outline-none focus:border-orange-400/70"
            />
          </div>
          <button type="submit" className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-500 hover:bg-navy-50">
            검색
          </button>
        </form>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-500 hover:bg-navy-50"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </button>
        <button
          onClick={() => { setShowAdd(v => !v); setAddError(""); }}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          키링 ID 등록
        </button>
      </div>

      {/* 등록 폼 */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 rounded-xl border border-orange-400/30 bg-orange-500/5 p-4">
          <p className="mb-3 text-sm font-semibold text-orange-400">새 키링 ID 등록</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs text-navy-500">키링 ID (NFC 칩에 기록한 값)</label>
              <input
                type="text"
                value={newKeyringId}
                onChange={e => setNewKeyringId(e.target.value.toUpperCase())}
                placeholder="예: IPNK-KR-000001"
                className="w-full rounded-lg border border-navy-100 bg-[#0d1b2a] px-3 py-2 text-sm text-navy-800 outline-none focus:border-orange-400/70"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs text-navy-500">메모 (선택, 배치번호·종류 등)</label>
              <input
                type="text"
                value={newMemo}
                onChange={e => setNewMemo(e.target.value)}
                placeholder="예: 1차 생산 / 입낚키링 기본형"
                className="w-full rounded-lg border border-navy-100 bg-[#0d1b2a] px-3 py-2 text-sm text-navy-800 outline-none focus:border-orange-400/70"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={addLoading}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-orange-600 disabled:opacity-50"
              >
                {addLoading ? "등록 중..." : "등록"}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setAddError(""); }}
                className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-500 hover:bg-navy-50"
              >
                취소
              </button>
            </div>
          </div>
          {addError && <p className="mt-2 text-xs text-red-500">{addError}</p>}
        </form>
      )}

      {/* 집계 */}
      <div className="mb-3 flex items-center gap-4 text-sm text-navy-500">
        <span>전체 <strong className="text-navy-800">{total}</strong>개</span>
        <span>활성 <strong className="text-green-600">{items.filter(i => i.isActive).length}</strong>개</span>
        <span>비활성 <strong className="text-red-400">{items.filter(i => !i.isActive).length}</strong>개</span>
        {loading && <span className="text-orange-500">로딩 중...</span>}
      </div>

      {/* 목록 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-navy-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50 text-left text-xs font-semibold text-navy-500">
              <th className="px-4 py-3">키링 ID</th>
              <th className="px-4 py-3">메모</th>
              <th className="px-4 py-3">연동 회원</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">등록일</th>
              <th className="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-navy-400">
                  등록된 키링 ID가 없습니다.
                </td>
              </tr>
            )}
            {items.map(item => (
              <tr key={item.id} className="border-b border-navy-100/60 hover:bg-navy-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    <span className="font-mono font-semibold text-navy-800">{item.keyringId}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-navy-500">{item.memo ?? <span className="text-navy-300">-</span>}</td>
                <td className="px-4 py-3">
                  {item.linkedUserNickname ? (
                    <div>
                      <p className="text-sm font-semibold text-navy-800 leading-tight">{item.linkedUserNickname}</p>
                      {item.linkedUserPhone && (
                        <p className="text-xs text-navy-400">{maskPhone(item.linkedUserPhone)}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-navy-300">미등록</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                    {item.isActive ? "활성" : "비활성"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-navy-400">
                  {item.createdAt ? String(item.createdAt).slice(0, 10) : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleToggle(item)}
                      title={item.isActive ? "비활성으로 전환" : "활성으로 전환"}
                      className="rounded-lg p-1.5 hover:bg-navy-100"
                    >
                      {item.isActive
                        ? <ToggleRight className="h-5 w-5 text-green-500" />
                        : <ToggleLeft className="h-5 w-5 text-navy-300" />}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      title="삭제"
                      className="rounded-lg p-1.5 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => { setPage(p); fetchList(query, p); }}
              className={`h-8 w-8 rounded-lg text-sm font-semibold ${p === page ? "bg-orange-500 text-gray-900" : "border border-navy-100 text-navy-500 hover:bg-navy-50"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* 안내 박스 */}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 leading-relaxed">
        <p className="mb-1 font-semibold">키링 ID 등록 가이드</p>
        <p>1. NFC Tools Pro 앱에서 NFC 칩에 텍스트(예: IPNK-KR-000001)를 쓰기합니다.</p>
        <p>2. 이 화면에서 동일한 ID를 등록하면 사용자가 NFC 태그 또는 수동 입력으로 키링을 연동할 수 있습니다.</p>
        <p>3. 비활성 처리 시 해당 ID로 새 연동이 불가능해집니다. 분실·불량 키링 관리에 활용하세요.</p>
        <p>4. 삭제 시 해당 키링과 연동된 회원의 연동 정보(LinkedKeyring)도 함께 삭제됩니다.</p>
      </div>
    </div>
  );
}
