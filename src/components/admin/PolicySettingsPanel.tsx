"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export function PolicySettingsPanel({
  initialRefund,
  initialShipping,
}: {
  initialRefund: string;
  initialShipping: string;
}) {
  const [refund, setRefund] = useState(initialRefund);
  const [shipping, setShipping] = useState(initialShipping);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SAVE_POLICY", refund_policy: refund, shipping_guide: shipping }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "저장 실패");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  const textareaClass =
    "w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-[14px] text-navy-800 outline-none resize-none focus:border-orange-400 transition-colors placeholder:text-navy-300";

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-navy-700">환불 정책</label>
        <textarea
          className={textareaClass}
          rows={4}
          value={refund}
          onChange={(e) => setRefund(e.target.value)}
          placeholder="상품 수령 후 7일 이내 환불 가능합니다..."
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-navy-700">주문/배송 안내</label>
        <textarea
          className={textareaClass}
          rows={4}
          value={shipping}
          onChange={(e) => setShipping(e.target.value)}
          placeholder="주문 후 1-3일 내 발송됩니다..."
        />
      </div>

      {error && <p className="text-[13px] text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-[14px] font-semibold text-gray-900 transition-colors hover:bg-orange-600 disabled:opacity-60"
      >
        {saving ? (
          <><Loader2 size={15} className="animate-spin" /> 저장 중...</>
        ) : saved ? (
          <><Check size={15} /> 저장됨</>
        ) : (
          "저장"
        )}
      </button>
    </div>
  );
}
