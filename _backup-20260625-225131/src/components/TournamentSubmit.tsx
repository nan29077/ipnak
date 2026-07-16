"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Loader2, ShieldCheck } from "lucide-react";
import { Sheet, Button, Input, Select } from "@/components/ui";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { SmartRuler, type RulerResult } from "@/components/SmartRuler";
import { useToast } from "@/components/Toast";
import { KOREA_SPOTS } from "@/lib/taxonomy";

export function TournamentSubmit({ tournamentId, species, loggedIn }: { tournamentId: string; species: string | null; loggedIn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [ruler, setRuler] = useState<RulerResult | null>(null);
  const [size, setSize] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const finalSize = size ? Number(size) : ruler?.measuredLengthCm;
    if (!finalSize) { toast("크기를 측정하거나 입력하세요", "error"); return; }
    setLoading(true);
    try {
      const spot = KOREA_SPOTS.find((s) => s.name === region);
      const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speciesName: species, sizeCm: finalSize, region,
          lat: spot?.lat, lng: spot?.lng,
          photoUrl: photos[0]?.submitUrl, measuredImageUrl: photos[0]?.submitUrl,
          calibrationStart: ruler?.calibrationStart, calibrationEnd: ruler?.calibrationEnd,
          calibrationLengthCm: ruler?.calibrationLengthCm,
          fishHeadPoint: ruler?.fishHeadPoint, fishTailPoint: ruler?.fishTailPoint,
          measuredLengthCm: ruler?.measuredLengthCm, confidence: ruler?.confidence,
          originalImageUrl: photos[0]?.submitUrl ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("계측 기록을 제출했습니다 (심사중)", "success");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button full size="lg" leftIcon={<Trophy size={18} />}
        onClick={() => loggedIn ? setOpen(true) : toast("로그인이 필요합니다", "error")}>
        대회 참가 · 계측 기록 제출
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="계측 기록 제출">
        <div className="space-y-4">
          <PhotoPicker value={photos} onChange={setPhotos} max={1} single capture />
          {photos[0] && <SmartRuler imageUrl={photos[0].preview} onComplete={(r) => { setRuler(r); setSize(String(r.measuredLengthCm)); }} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-navy-700">크기 (cm)</label>
              <Input type="number" value={size} onChange={(e) => setSize(e.target.value)} placeholder="측정값" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-navy-700">지역</label>
              <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택</option>{KOREA_SPOTS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </Select>
            </div>
          </div>
          {ruler && (
            <div className="flex items-center gap-2 rounded-xl bg-aqua-50 px-3 py-2 text-xs font-semibold text-aqua-700">
              <ShieldCheck size={16} className="shrink-0" />
              <span>AI 계측 검증 데이터 첨부됨 · 신뢰도 {Math.round(ruler.confidence)}%</span>
            </div>
          )}
          <Button full onClick={submit} disabled={loading}
            leftIcon={loading ? <Loader2 size={16} className="animate-spin" /> : undefined}>
            제출하기
          </Button>
          <p className="text-center text-xs text-navy-300">제출 후 관리자 심사를 거쳐 리더보드에 반영됩니다.</p>
        </div>
      </Sheet>
    </>
  );
}
