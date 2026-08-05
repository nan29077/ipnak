"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PageHeader, Button, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { MARKET_CATEGORIES, MARKET_REGIONS, MARKET_CONDITIONS, MARKET_TRADE_METHODS } from "@/lib/taxonomy";

type Props = {
  listingId: string;
  initial: {
    title: string;
    category: string;
    condition: string;
    tradeMethod: string | null;
    price: number;
    region: string | null;
    description: string | null;
  };
};

export function MarketEditForm({ listingId, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [condition, setCondition] = useState(initial.condition);
  const [tradeMethod, setTradeMethod] = useState(initial.tradeMethod ?? "BOTH");
  const [price, setPrice] = useState(String(initial.price));
  const [region, setRegion] = useState(initial.region ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [loading, setLoading] = useState(false);

  const priceValid = price.trim() !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;
  const canSubmit = !!title.trim() && !!description.trim() && priceValid;

  async function submit() {
    if (!title.trim()) { toast("제목을 입력해주세요", "error"); return; }
    if (!description.trim()) { toast("내용을 입력해주세요", "error"); return; }
    if (!priceValid) { toast("가격을 입력해주세요", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/market/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          condition,
          tradeMethod,
          price: Math.round(Number(price)),
          region: region.trim() || null,
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "수정에 실패했습니다", "error");
        return;
      }
      toast("판매글을 수정했어요", "success");
      router.replace(`/market/${listingId}`);
      router.refresh();
    } catch {
      toast("수정 중 오류가 발생했습니다", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface pb-24">
      <PageHeader title="판매글 수정" back />
      <div className="space-y-5 px-4 pt-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-navy-600">제목 *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" maxLength={60} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-navy-600">카테고리</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {MARKET_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-navy-600">상태</label>
            <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
              {MARKET_CONDITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-navy-600">가격 (원) *</label>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-navy-600">거래 지역</label>
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">지역 선택</option>
              {MARKET_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-navy-600">거래 방법</label>
          <div className="flex gap-2">
            {MARKET_TRADE_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setTradeMethod(m.key)}
                className={`flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all ${
                  tradeMethod === m.key ? "bg-orange-500 text-white" : "bg-navy-50 text-navy-500 hover:bg-navy-100"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-navy-600">내용 *</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="상품 설명을 입력하세요"
            rows={6}
            maxLength={2000}
          />
          <p className="mt-1 text-right text-[11px] text-navy-300">{description.length} / 2000</p>
        </div>
        <Button onClick={submit} disabled={!canSubmit || loading} className="w-full">
          {loading ? <Loader2 size={18} className="animate-spin" /> : "수정 완료"}
        </Button>
      </div>
    </div>
  );
}
