"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Tag } from "lucide-react";
import { PageHeader, Chip, Button, Card, SectionTitle, Input, Select, Textarea } from "@/components/ui";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { useToast } from "@/components/Toast";
import { MARKET_CATEGORIES, MARKET_REGIONS, MARKET_CONDITIONS } from "@/lib/taxonomy";

export default function NewMarketListingPage() {
  const router = useRouter();
  const toast = useToast();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("USED");
  const [price, setPrice] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!title.trim()) { toast("제목을 입력해주세요", "error"); return; }
    if (!category) { toast("카테고리를 선택해주세요", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/market", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, category, condition,
          price: price || 0, region: region || null, description: description || null,
          images: photos.map((p) => p.submitUrl),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("판매글이 등록되었습니다", "success");
      router.push(`/market/${data.id}`);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader title="중고 판매글 등록" back right={
        <Button onClick={submit} disabled={loading} size="sm" className="rounded-full">
          {loading ? <Loader2 size={16} className="animate-spin" /> : "등록"}
        </Button>
      } />
      <div className="space-y-4 p-4">
        <Card className="space-y-3 p-4">
          <div>
            <SectionTitle className="mb-2 uppercase tracking-[.05em] text-navy-300">사진 (최대 10장)</SectionTitle>
            <PhotoPicker value={photos} onChange={setPhotos} max={10} />
          </div>
          <div>
            <SectionTitle className="mb-1.5 uppercase tracking-[.05em] text-navy-300">제목</SectionTitle>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 다이와 루비아스 2500 릴 판매합니다" maxLength={60} />
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle className="uppercase tracking-[.05em] text-navy-300">상품 정보</SectionTitle>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-700">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {MARKET_CATEGORIES.map((c) => (
                <Chip key={c.key} size="sm" active={category === c.key} onClick={() => setCategory(c.key)}>{c.label}</Chip>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-700">상태</label>
            <div className="flex gap-2">
              {MARKET_CONDITIONS.map((c) => (
                <Chip key={c.key} active={condition === c.key} onClick={() => setCondition(c.key)}>{c.label}</Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="가격 (원)">
              <Input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="예: 85000" />
            </Field>
            <Field label="거래 지역">
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택</option>
                {MARKET_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="space-y-2 p-4">
          <SectionTitle className="uppercase tracking-[.05em] text-navy-300">설명</SectionTitle>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="상품 상태, 사용 기간, 구성품, 거래 방식(직거래/택배) 등을 적어주세요."
            className="resize-none"
          />
        </Card>

        <Button onClick={submit} disabled={loading} full size="lg" leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : <Tag size={18} />}>
          {loading ? "등록 중..." : "판매글 등록"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-navy-700">{label}</label>
      {children}
    </div>
  );
}
