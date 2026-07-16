"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Share2 } from "lucide-react";
import { PageHeader, Chip, Button, Card, SectionTitle, Input, Select, Textarea } from "@/components/ui";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { ProductTagPicker } from "@/components/ProductTagPicker";
import { useToast } from "@/components/Toast";
import { ALL_SPECIES, FISHING_METHODS, VISIBILITY_OPTIONS, KOREA_SPOTS } from "@/lib/taxonomy";

export default function NewPostPage() {
  const router = useRouter();
  const toast = useToast();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [species, setSpecies] = useState("");
  const [fishingType, setFishingType] = useState("");
  const [region, setRegion] = useState("");
  const [size, setSize] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const spot = KOREA_SPOTS.find((s) => s.name === region);
      const res = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: "GENERAL", caption, speciesName: species || null,
          fishingType: fishingType || null, region: region || null, sizeCm: size || null,
          lat: spot?.lat, lng: spot?.lng, visibility,
          images: photos.map((p) => p.submitUrl), productIds,
          hashtags: [region, species].filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("게시글이 등록되었습니다", "success");
      router.push("/");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader title="피싱 피드 올리기" back right={
        <Button onClick={submit} disabled={loading} size="sm" className="rounded-full">
          {loading ? <Loader2 size={16} className="animate-spin" /> : "공유"}
        </Button>
      } />
      <div className="space-y-4 p-4">
        <Card className="space-y-3 p-4">
          <div>
            <SectionTitle className="mb-2 uppercase tracking-[.05em] text-navy-300">사진</SectionTitle>
            <PhotoPicker value={photos} onChange={setPhotos} max={5} />
          </div>
          <div>
            <SectionTitle className="mb-1.5 uppercase tracking-[.05em] text-navy-300">캡션</SectionTitle>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3}
              placeholder="오늘의 낚시를 기록해보세요..." className="resize-none" />
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle className="uppercase tracking-[.05em] text-navy-300">상세 정보</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="어종">
              <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
                <option value="">선택</option>
                {ALL_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="낚시 방식">
              <Select value={fishingType} onChange={(e) => setFishingType(e.target.value)}>
                <option value="">선택</option>
                {FISHING_METHODS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="지역">
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택</option>
                {KOREA_SPOTS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="크기 (cm)">
              <Input type="number" value={size} onChange={(e) => setSize(e.target.value)} placeholder="예: 42.5" />
            </Field>
          </div>
        </Card>

        <Card className="space-y-2.5 p-4">
          <SectionTitle className="uppercase tracking-[.05em] text-navy-300">공개 범위</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {VISIBILITY_OPTIONS.map((v) => (
              <Chip key={v.key} active={visibility === v.key} onClick={() => setVisibility(v.key)}>{v.label}</Chip>
            ))}
          </div>
        </Card>

        <ProductTagPicker selected={productIds} onChange={setProductIds} />

        <Button onClick={submit} disabled={loading} full size="lg" leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}>
          {loading ? "공유 중..." : "게시글 공유"}
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
