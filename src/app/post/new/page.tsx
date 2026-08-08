"use client";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Loader2, Share2 } from "lucide-react";
import { PageHeader, Chip, Button, Card, SectionTitle, Input, Select, Textarea } from "@/components/ui";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { ProductTagPicker } from "@/components/ProductTagPicker";
import { PostRewardNotice } from "@/components/PointRewardNotice";
import { useToast } from "@/components/Toast";
import { useAppSettings } from "@/lib/appSettingsContext";
import { ALL_SPECIES, BASS_ONLY_SPECIES, FISHING_METHODS, VISIBILITY_OPTIONS, KOREA_SPOTS, KOREA_PROVINCES } from "@/lib/taxonomy";

function NewPostContent() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const isGeneral = searchParams.get("type") === "general";
  const { shopTagEnabled, bassOnlyMode } = useAppSettings();
  const speciesList = bassOnlyMode ? BASS_ONLY_SPECIES : ALL_SPECIES;
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

  // 피싱/일상 피드 공통 필수값: 사진 1장 이상 + 내용. 나머지(지역·어종·태그 등)는 모두 선택
  const uploading = photos.some((p) => p.uploading);
  const hasPhoto = photos.some((p) => p.submitUrl);
  const canSubmit = hasPhoto && !!caption.trim() && !uploading;

  async function submit() {
    if (uploading) { toast("사진 업로드 중입니다. 잠시 기다려주세요", "error"); return; }
    if (!hasPhoto) { toast("사진을 1장 이상 첨부해주세요", "error"); return; }
    if (!caption.trim()) { toast("내용을 입력해주세요", "error"); return; }
    setLoading(true);
    try {
      const resolvedSpecies = species === "기타" ? customSpecies : species;
      const resolvedFishingType = fishingType === "기타" ? customFishingType : fishingType;
      const resolvedRegion = region === "기타" ? customRegion : region;
      const spot = KOREA_SPOTS.find((s) => s.name === resolvedRegion);
      const res = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: "GENERAL",
          kind: isGeneral ? "GENERAL" : "FEED",
          caption, speciesName: resolvedSpecies || null,
          fishingType: resolvedFishingType || null, region: resolvedRegion || null, sizeCm: size || null,
          // 도 단위 지역 / 어종 선택값 (둘 다 선택사항)
          location: resolvedRegion || null, fishSpecies: resolvedSpecies || null,
          lat: spot?.lat, lng: spot?.lng, visibility,
          images: photos.map((p) => p.submitUrl), productIds,
          hashtags: [resolvedRegion, resolvedSpecies].filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("게시글이 등록되었습니다", "success");
      router.replace(isGeneral ? "/general" : "/home");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const pageTitle = isGeneral ? "일상 피드 올리기" : "피싱 피드 올리기";

  return (
    <div className="pb-10">
      <PageHeader title={pageTitle} back right={
        <Button onClick={submit} disabled={loading || !canSubmit} size="sm" className="rounded-full">
          {loading ? <Loader2 size={16} className="animate-spin" /> : "공유"}
        </Button>
      } />
      <div className="space-y-4 p-4">
        <Card className="space-y-3 p-4">
          <div>
            <SectionTitle className="mb-2 uppercase tracking-[.05em] text-navy-300">사진 (필수)</SectionTitle>
            <PhotoPicker value={photos} onChange={setPhotos} max={5} />
          </div>
          <div>
            <SectionTitle className="mb-1.5 uppercase tracking-[.05em] text-navy-300">내용 (필수)</SectionTitle>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3}
              placeholder={isGeneral ? "오늘의 일상을 기록해보세요..." : "오늘의 낚시를 기록해보세요..."} className="resize-none" />
          </div>
        </Card>

        {!isGeneral && (
          <Card className="space-y-3 p-4">
            <SectionTitle className="uppercase tracking-[.05em] text-navy-300">상세 정보 (선택)</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="어종">
                <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
                  <option value="">선택</option>
                  {speciesList.map((s) => <option key={s} value={s}>{s}</option>)}
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
                  {KOREA_PROVINCES.map((s) => <option key={s} value={s}>{s}</option>)}
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
        )}

        {isGeneral && (
          <Card className="space-y-3 p-4">
            <SectionTitle className="uppercase tracking-[.05em] text-navy-300">상세 정보 (선택)</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="지역">
                <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">선택</option>
                  {KOREA_PROVINCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="기타">기타(직접입력)</option>
                </Select>
                {region === "기타" && (
                  <Input value={customRegion} onChange={(e) => setCustomRegion(e.target.value)} placeholder="지역 직접 입력" className="mt-2" />
                )}
              </Field>
            </div>
          </Card>
        )}

        <Card className="space-y-2.5 p-4">
          <SectionTitle className="uppercase tracking-[.05em] text-navy-300">공개 범위</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {VISIBILITY_OPTIONS.map((v) => (
              <Chip key={v.key} active={visibility === v.key} onClick={() => setVisibility(v.key)}>{v.label}</Chip>
            ))}
          </div>
        </Card>

        {shopTagEnabled && !isGeneral && <ProductTagPicker selected={productIds} onChange={setProductIds} />}

        <PostRewardNotice />

        <Button onClick={submit} disabled={loading || !canSubmit} full size="lg" leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}>
          {loading ? "공유 중..." : uploading ? "사진 업로드 중..." : "게시글 공유"}
        </Button>
        {!canSubmit && !loading && (
          <p className="text-center text-xs text-navy-400">사진 1장 이상과 내용을 입력하면 공유할 수 있어요.</p>
        )}
      </div>
    </div>
  );
}

export default function NewPostPage() {
  return (
    <Suspense>
      <NewPostContent />
    </Suspense>
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
