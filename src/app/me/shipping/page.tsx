"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Trash2, Loader2, Check } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface ShippingAddress {
  id: string;
  name: string;
  phone: string;
  address: string;
  addressDetail: string;
  isDefault: number;
}

const inputCls = "w-full rounded-xl border border-navy-100/30 bg-[#0d1b2a] px-3 py-2.5 text-[14px] text-white outline-none focus:border-orange-400 placeholder:text-white/25 transition-colors";

export default function ShippingPage() {
  const router = useRouter();
  const toast = useToast();
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  async function fetchAddresses() {
    setLoading(true);
    try {
      const res = await fetch("/api/me/shipping-addresses");
      // 비로그인이면 배송지를 저장할 수 없으므로 빈 목록 대신 로그인 페이지로 보낸다
      // (이 페이지는 클라이언트 컴포넌트라 서버 redirect를 쓸 수 없다)
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { fetchAddresses(); }, []);

  function resetForm() {
    setName(""); setPhone(""); setAddress(""); setAddressDetail(""); setIsDefault(false);
  }

  async function handleAdd() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast("이름, 전화번호, 주소를 입력해 주세요", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/shipping-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, addressDetail, isDefault }),
      });
      if (!res.ok) throw new Error("저장 실패");
      toast("배송지를 추가했습니다", "success");
      resetForm();
      setShowForm(false);
      await fetchAddresses();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/me/shipping-addresses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      toast("배송지를 삭제했습니다", "success");
      await fetchAddresses();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader title="배송지 관리" back />

      <div className="space-y-3 p-4">
        {/* 배송지 목록 */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-navy-400">
            <Loader2 size={16} className="animate-spin" /> 불러오는 중...
          </div>
        ) : addresses.length === 0 && !showForm ? (
          <div className="py-10 text-center">
            <p className="text-navy-400 text-[14px]">등록된 배송지가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {addresses.map((addr) => (
              <div key={addr.id} className="flex items-start gap-3 rounded-2xl border border-navy-100/20 bg-[#162538] p-4">
                <MapPin size={16} className={addr.isDefault === 1 ? "mt-0.5 shrink-0 text-orange-400" : "mt-0.5 shrink-0 text-navy-400"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-navy-800">{addr.name}</p>
                    <p className="text-[12px] text-navy-400">{addr.phone}</p>
                    {addr.isDefault === 1 && (
                      <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-gray-900">기본</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-navy-500">{addr.address}</p>
                  {addr.addressDetail && <p className="text-[12px] text-navy-500">{addr.addressDetail}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(addr.id)}
                  disabled={deleting === addr.id}
                  className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {deleting === addr.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 추가 폼 */}
        {showForm && (
          <div className="rounded-2xl border border-orange-400/30 bg-[#162538] p-4 space-y-3">
            <p className="text-[13px] font-bold text-white">새 배송지 추가</p>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-white/50">받는 분 이름 *</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-white/50">전화번호 *</label>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" inputMode="tel" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-white/50">주소 *</label>
              <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="도로명 주소" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-white/50">상세 주소</label>
              <input className={inputCls} value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="상세 주소 (선택)" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIsDefault(!isDefault)}
                className={"flex h-5 w-5 items-center justify-center rounded border transition-colors " + (isDefault ? "border-orange-400 bg-orange-500 text-gray-900" : "border-navy-100/30 bg-[#0d1b2a]")}
              >
                {isDefault && <Check size={12} strokeWidth={3} />}
              </div>
              <span className="text-[12px] text-navy-400">기본 배송지로 설정</span>
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 rounded-xl border border-navy-100/20 py-2.5 text-[13px] font-semibold text-navy-400 hover:bg-white/[0.04]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5 text-[13px] font-bold text-gray-900 hover:bg-orange-600 disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                저장
              </button>
            </div>
          </div>
        )}

        {/* 추가 버튼 */}
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-navy-100/20 py-4 text-[13px] font-semibold text-navy-400 hover:border-orange-400 hover:text-orange-400 transition-colors"
          >
            <Plus size={16} /> 배송지 추가
          </button>
        )}
      </div>
    </div>
  );
}
