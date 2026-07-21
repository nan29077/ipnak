"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Share2 } from "lucide-react";
import { PageHeader, Chip, Button, Card, SectionTitle, Input, Select, Textarea } from "@/components/ui";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { ProductTagPicker } from "@/components/ProductTagPicker";
import { useToast } from "@/components/Toast";
import { useAppSettings } from "@/lib/appSettingsContext";
import { ALL_SPECIES, FISHING_METHODS, VISIBILITY_OPTIONS, KOREA_SPOTS } from "@/lib/taxonomy";

export default function NewPostPage() {
  const router = useRouter();
  const toast = useToast();
  const { shopMenuEnabled } = useAppSettings();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [species, setSpecies] = useState("");
  const [customSpecies, setCustomSpecies] = useState("");
  const [fishingType, setFishingType] = useState("");
  const [customFishingType, setCustomFishingType] = useState("");
  const [region, setRegion] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [size, setSize] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const resolvedSpecies = species === "기타" ? customSpecies : species;
      const resolvedFishingType = fishingType === "기타" ? customFishingType : fishingType;
      const resolvedRegion = region === "기타" ? customRegion : region;
      const spot = KOREA_SPOTS.find((s) => s.name === resolvedRegion);
      const res = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: "GENERAL", caption, speciesName: resolvedSpecies || null,
          fishingType: resolvedFishingType || null, region: resolvedRegion || null, sizeCm: size || null,
          lat: spot?.lat, lng: spot?.lng, visibility,
          images: photos.map((p) => p.submitUrl), productIds,
          hashtags: [resolvedRegion, resolvedSpecies].filter(Boolean),
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
            <SectionTitle className="mb-1.5 uppercase tracking-[.05em] text-navy-300">내용</SectionTitle>
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
                <option value="기타">기타(직접입력)</option>
              </Select>
              {species === "기타" && (
                <Input value={customSpecies} onChange={(e) => setCustomSpecies(e.target.value)} placeholder="어종 직접 입력" className="mt-2" />
              )}
            </Field>
            <Field label="낚시 방식">
              <Select value={fishingType} onChange={(e) => setFishingType(e.target.value)}>
                <option value="">선택</option>
                {FISHING_METHODS.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="기타">기타(직접입력)</option>
              </Select>
              {fishingType === "기타" && (
                <Input value={customFishingType} onChange={(e) => setCustomFishingType(e.target.value)} placeholder="낚시 방식 직접 입력" className="mt-2" />
              )}
            </Field>
            <Field label="지역">
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택</option>
                {KOREA_SPOTS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                <option value="기타">기타(직접입력)</option>
              </Select>
              {region === "기타" && (
                <Input value={customRegion} onChange={(e) => setCustomRegion(e.target.value)} placeholder="지역 직접 입력" className="mt-2" />
              )}
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

        {shopMenuEnabled && <ProductTagPicker selected={productIds} onChange={setProductIds} />}

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
