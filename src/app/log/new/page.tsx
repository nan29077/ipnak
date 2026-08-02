"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, BookOpen } from "lucide-react";
import { PageHeader, Chip, Button, Card, SectionTitle, Input, Select, Textarea } from "@/components/ui";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { ProductTagPicker } from "@/components/ProductTagPicker";
import { PostRewardNotice } from "@/components/PointRewardNotice";
import { useToast } from "@/components/Toast";
import { useAppSettings } from "@/lib/appSettingsContext";
import { LOG_CATEGORIES, ALL_SPECIES, BASS_ONLY_SPECIES, KOREA_SPOTS, KOREA_PROVINCES } from "@/lib/taxonomy";

export default function NewLogPage() {
  const router = useRouter();
  const toast = useToast();
  const { shopTagEnabled, bassOnlyMode } = useAppSettings();
  const speciesList = bassOnlyMode ? BASS_ONLY_SPECIES : ALL_SPECIES;
  const [boardCategory, setBoardCategory] = useState("WALKING");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [region, setRegion] = useState("");
  const [species, setSpecies] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 조행기 필수값: 제목 + 본문. 사진·지역·어종 등 나머지는 모두 선택
  const uploading = photos.some((p) => p.uploading);
  const canSubmit = !!title.trim() && !!body.trim() && !uploading;

  async function submit() {
    if (!title.trim()) { toast("제목을 입력해주세요", "error"); return; }
    if (!body.trim()) { toast("내용을 입력해주세요", "error"); return; }
    if (uploading) { toast("사진 업로드 중입니다. 잠시 기다려주세요", "error"); return; }
    setLoading(true);
    try {
      const spot = KOREA_SPOTS.find((s) => s.name === region);
      const res = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "LOG", postType: "GENERAL", boardCategory,
          title, body, caption: title,
          speciesName: species || null, region: region || null,
          // 도 단위 지역 / 어종 선택값 (둘 다 선택사항)
          location: region || null, fishSpecies: species || null,
          lat: spot?.lat, lng: spot?.lng, visibility: "PUBLIC",
          images: photos.map((p) => p.submitUrl), productIds,
          hashtags: [region, species].filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("조행기가 등록되었습니다", "success");
      router.push(`/log/${data.id}`);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader title="조행기 쓰기" back right={
        <Button onClick={submit} disabled={loading || !canSubmit} className="rounded-full">
          {loading ? <Loader2 size={16} className="animate-spin" /> : "등록"}
        </Button>
      } />
      <div className="space-y-4 p-4">
        <Card className="space-y-3 p-4">
          <div>
            <SectionTitle className="mb-2 uppercase tracking-[.05em] text-navy-300">게시판</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {LOG_CATEGORIES.map((c) => (
                <Chip key={c.key} active={boardCategory === c.key} onClick={() => setBoardCategory(c.key)}>{c.label}</Chip>
              ))}
            </div>
          </div>
          <div>
            <SectionTitle className="mb-1.5 uppercase tracking-[.05em] text-navy-300">제목 (필수)</SectionTitle>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 첫 광어 다운샷 조행기 (전남 여수)" maxLength={80} />
          </div>
          <div>
            <SectionTitle className="mb-1.5 uppercase tracking-[.05em] text-navy-300">본문 (필수)</SectionTitle>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
              placeholder={"출조 일정, 물때, 채비, 조황, 팁 등을 자유롭게 적어주세요...\n\n사진은 아래에서 첨부할 수 있어요."} className="min-h-[220px] resize-y" />
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle className="uppercase tracking-[.05em] text-navy-300">상세 정보 (선택)</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="지역">
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택</option>
                {KOREA_PROVINCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="대상 어종">
              <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
                <option value="">선택</option>
                {speciesList.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="기타">기타</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle className="uppercase tracking-[.05em] text-navy-300">사진 첨부 (선택)</SectionTitle>
          <PhotoPicker value={photos} onChange={setPhotos} max={8} />
        </Card>

        {shopTagEnabled && <ProductTagPicker selected={productIds} onChange={setProductIds} />}

        <PostRewardNotice />

        <Button onClick={submit} disabled={loading || !canSubmit} full size="lg" leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}>
          {loading ? "등록 중..." : uploading ? "사진 업로드 중..." : "조행기 등록"}
        </Button>
        {!canSubmit && !loading && (
          <p className="text-center text-xs text-navy-400">제목과 본문을 입력하면 등록할 수 있어요.</p>
        )}
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
