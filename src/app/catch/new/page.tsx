"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ruler, MapPin, Loader2, Trophy, ChevronRight, Camera, Images } from "lucide-react";
import { PageHeader, Chip, Sheet, Button, Card, SectionTitle, Input, Select, Textarea, Badge } from "@/components/ui";
import { PhotoPicker, type PickedPhoto } from "@/components/PhotoPicker";
import { CameraCapture } from "@/components/CameraCapture";
import { ProductTagPicker } from "@/components/ProductTagPicker";
import { ProductTagPlacer, type TagPosition } from "@/components/ProductTagPlacer";
import { SmartRuler, type RulerResult } from "@/components/SmartRuler";
import { useToast } from "@/components/Toast";
import { useRecording } from "@/components/RecordingProvider";
import { ALL_SPECIES, FISHING_METHODS, FRESH_ENVIRONMENTS, SEA_ENVIRONMENTS, POINT_VISIBILITY, VISIBILITY_OPTIONS, KOREA_SPOTS } from "@/lib/taxonomy";
import { estimateWeightKg, formatWeight } from "@/lib/fishData";

export default function NewCatchPage() {
  const router = useRouter();
  const toast = useToast();
  const { status, addCatchToRecording, sessionId, lastPoint } = useRecording();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [rulerOpen, setRulerOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [ruler, setRuler] = useState<RulerResult | null>(null);
  const [species, setSpecies] = useState("");
  const [customSpecies, setCustomSpecies] = useState("");
  const [memo, setMemo] = useState("");
  const [fishingType, setFishingType] = useState("");
  const [customFishingType, setCustomFishingType] = useState("");
  const [env, setEnv] = useState("");
  const [waterType, setWaterType] = useState<"민물낚시" | "바다낚시">("바다낚시");
  const [region, setRegion] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [size, setSize] = useState("");
  const [gear, setGear] = useState({ rod: "", reel: "", line: "", lure: "", rig: "" });
  const [productIds, setProductIds] = useState<string[]>([]);
  const [tagPositions, setTagPositions] = useState<Record<string, TagPosition>>({});

  // 선택된 상품과 위치 상태 동기화 (해제된 상품 제거)
  function handleProductChange(ids: string[]) {
    setProductIds(ids);
    setTagPositions((prev) => {
      const next: Record<string, TagPosition> = {};
      for (const id of ids) if (prev[id]) next[id] = prev[id];
      // 위치 미지정 항목은 제출 시 0.5/0.5 기본값 적용
      return next;
    });
  }
  const [pointVisibility, setPointVisibility] = useState("EXACT");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [shareToFeed, setShareToFeed] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // 위치 자동 저장 시도
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, { enableHighAccuracy: true, timeout: 4000 }
      );
    }
  }, []);

  const eligible = species && Number(size) > 0; // 대회 참가 가능 여부(간단 기준)

  // 표시용 파생값: 현재 길이(직접입력 우선) → 어종별 길이-무게식으로 추정 무게 계산
  const currentLenCm = size ? Number(size) : ruler?.measuredLengthCm ?? null;
  const estWeightKg = estimateWeightKg(species, currentLenCm);

  async function submit(shareOverride?: boolean) {
    if (!species) { toast("어종을 선택하세요", "error"); return; }
    const share = shareOverride ?? shareToFeed;
    const resolvedSpecies = species === "기타" ? customSpecies : species;
    const resolvedFishingType = fishingType === "기타" ? customFishingType : fishingType;
    const resolvedRegion = region === "기타" ? customRegion : region;
    if (!resolvedSpecies) { toast("어종을 직접 입력하세요", "error"); return; }
    setLoading(true);
    try {
      const spot = KOREA_SPOTS.find((s) => s.name === resolvedRegion);
      const lat = coords?.lat ?? spot?.lat;
      const lng = coords?.lng ?? spot?.lng;
      const photo = photos[0]?.submitUrl;
      const res = await fetch("/api/catch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speciesName: resolvedSpecies, fishingType: resolvedFishingType, categoryPath: `${waterType} > ${env || resolvedFishingType}`,
          caption: memo || undefined,
          sizeCm: size ? Number(size) : ruler?.measuredLengthCm, region: resolvedRegion, lat, lng,
          photoUrl: photo, pointVisibility, visibility, shareToFeed: share,
          gearSummary: [gear.rod, gear.reel, gear.rig, gear.lure].filter(Boolean).join(" / "),
          gear, productIds,
          productTags: productIds.map((pid) => {
            const pos = tagPositions[pid] ?? { posX: 0.5, posY: 0.5 };
            return { productId: pid, posX: pos.posX, posY: pos.posY };
          }),
          ...(ruler ? {
            originalImageUrl: photo, measuredImageUrl: photo,
            calibrationStart: ruler.calibrationStart, calibrationEnd: ruler.calibrationEnd,
            calibrationLengthCm: ruler.calibrationLengthCm, fishHeadPoint: ruler.fishHeadPoint,
            fishTailPoint: ruler.fishTailPoint, measuredLengthCm: ruler.measuredLengthCm, confidence: ruler.confidence,
          } : {}),
          ...(status !== "idle" && sessionId ? { tripId: sessionId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      // 데이터피싱 기록 중 잡은 물고기 — 현재 세션에 등록해 공유 시 사진 + 마커 위치 포함
      if (status !== "idle") {
        // GPS 위치: 기기 좌표 우선, 실패 시 워킹 세션의 마지막 GPS 포인트로 폴백
        addCatchToRecording({ photoUrl: photo || null, speciesName: resolvedSpecies || null, lat: coords?.lat ?? lastPoint?.lat ?? null, lng: coords?.lng ?? lastPoint?.lng ?? null });
      }
      toast("기록 완료", "success");
      router.push(share && data.postId ? `/post/${data.postId}` : "/trip");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const envOptions = waterType === "민물낚시" ? FRESH_ENVIRONMENTS : SEA_ENVIRONMENTS;

  function handleCameraCapture(dataUrl: string, estimatedCm: number) {
    setShowCameraCapture(false);
    const seed = `camera-${Date.now()}`;
    setPhotos((prev) => [...prev, { preview: dataUrl, submitUrl: `https://picsum.photos/seed/${seed}/800/800` }].slice(0, 3));
    // 패스 배지 기준으로 추정된 크기 자동 입력 (기존 값 없을 때만)
    if (!size) setSize(String(estimatedCm));
  }

  function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: PickedPhoto[] = [];
    Array.from(files).slice(0, 3 - photos.length).forEach((f, i) => {
      try {
        const preview = URL.createObjectURL(f);
        const seed = `${f.name.replace(/\W/g, "")}-${Date.now()}-${i}`;
        next.push({ preview, submitUrl: `https://picsum.photos/seed/${seed}/800/800` });
      } catch { /* ignore */ }
    });
    if (next.length > 0) setPhotos((prev) => [...prev, ...next].slice(0, 3));
    setPhotoSheetOpen(false);
  }

  return (
    <div className="pb-10">
      <PageHeader title="물고기 기록" back right={
        <Button onClick={() => submit()} disabled={loading} size="sm" className="rounded-full">
          {loading ? <Loader2 size={16} className="animate-spin" /> : "저장"}
        </Button>
      } />
      {/* 상단: 사진/미리보기 영역 */}
      <div className="relative aspect-[4/3] w-full bg-orange-500">
        {photos[0] ? (
          <div className="h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0].preview} alt="물고기 사진" className="h-full w-full object-cover" />
            {/* 우상단: 사진 추가/삭제 버튼 */}
            <button
              type="button"
              onClick={() => setPhotoSheetOpen(true)}
              className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              사진 변경
            </button>
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-3 flex gap-1">
                {photos.map((p, i) => (
                  <button key={i} type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    className="relative h-9 w-9 overflow-hidden rounded-lg border-2 border-white/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 사진 없을 때: 전체 영역을 탭하면 바텀 시트 */
          <button
            type="button"
            onClick={() => setPhotoSheetOpen(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
          >
            <Camera size={48} className="text-white/40" />
            <p className="text-[13px] text-white/60">사진을 선택하거나 촬영하세요</p>
          </button>
        )}
        {rulerOpen && (
          <span className="absolute bottom-3 right-3 inline-flex items-center rounded-full bg-aqua-500/90 px-3 py-1.5 text-[12px] font-semibold text-white">스마트 자 측정 중</span>
        )}
      </div>

      {/* 사진 선택 hidden inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handlePhotoFiles(e.target.files)} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handlePhotoFiles(e.target.files)} />

      <div className="flex flex-col gap-3.5 px-4 py-5">
        {/* 측정 결과 */}
        <div>
          <SectionTitle className="mb-2 uppercase tracking-[.05em] text-navy-300">측정 결과</SectionTitle>
          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="tracking-[-0.02em]">
                <span className="text-[28px] font-extrabold text-aqua-500">{size || (ruler ? ruler.measuredLengthCm.toFixed(1) : "--")}</span>
                <span className="ml-1 text-[16px] font-semibold text-navy-300">cm</span>
              </p>
              <p className="mt-0.5 text-[12px] text-navy-300">신뢰도 {ruler ? ruler.confidence : "--"}%</p>
              {estWeightKg != null && (
                <p className="mt-0.5 text-[12px] font-semibold text-navy-400">추정 무게 {formatWeight(estWeightKg)}</p>
              )}
              {ruler?.referenceLabel && (
                <p className="mt-0.5 text-[11px] text-navy-300">기준물체: {ruler.referenceLabel} {ruler.calibrationLengthCm}cm</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {species && <Badge tone="aqua">{species}</Badge>}
              <span className="text-[11px] text-navy-300">개인 기록</span>
            </div>
          </Card>
        </div>

        {/* 스마트 자 측정 진입 */}
        <button onClick={() => photos[0] ? setRulerOpen(true) : toast("먼저 사진을 추가하세요", "error")}
          className="flex w-full items-center justify-between rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-3 text-sm transition-colors hover:bg-navy-50 btn-press">
          <span className="flex items-center gap-2 font-semibold text-navy-700"><Ruler size={18} className="text-aqua-500" /> 스마트 자로 사이즈 측정</span>
          {ruler
            ? <span className="font-bold text-aqua-600">{ruler.measuredLengthCm.toFixed(1)}cm · {ruler.confidence}%</span>
            : <span className="flex items-center gap-0.5 text-navy-300">측정하기 <ChevronRight size={16} /></span>}
        </button>

        {/* 어종 / 크기 */}
        <div>
          <SectionTitle className="mb-2 uppercase tracking-[.05em] text-navy-300">어종</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
                <option value="">선택</option>{ALL_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="기타">기타(직접입력)</option>
              </Select>
              {species === "기타" && (
                <Input value={customSpecies} onChange={(e) => setCustomSpecies(e.target.value)} placeholder="어종 직접 입력" className="mt-2" />
              )}
            </div>
            <Input type="number" value={size} onChange={(e) => setSize(e.target.value)} placeholder={ruler ? String(ruler.measuredLengthCm) : "예: 42.5"} />
          </div>
        </div>

        {/* 메모 */}
        <div>
          <SectionTitle className="mb-2 uppercase tracking-[.05em] text-navy-300">메모</SectionTitle>
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="오늘의 낚시 기록을 남겨보세요..." />
        </div>

        <Card className="space-y-3 p-4">
          <SectionTitle>낚시 분류</SectionTitle>
          <div className="flex gap-2">
            {(["바다낚시", "민물낚시"] as const).map((w) => (
              <Chip key={w} active={waterType === w} onClick={() => { setWaterType(w); setEnv(""); }}>{w}</Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={env} onChange={(e) => setEnv(e.target.value)}>
              <option value="">장소/환경</option>{envOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <div>
              <Select value={fishingType} onChange={(e) => setFishingType(e.target.value)}>
                <option value="">낚시 방식</option>{FISHING_METHODS.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="기타">기타(직접입력)</option>
              </Select>
              {fishingType === "기타" && (
                <Input value={customFishingType} onChange={(e) => setCustomFishingType(e.target.value)} placeholder="낚시 방식 직접 입력" className="mt-2" />
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle>채비 / 장비</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="낚싯대" value={gear.rod} onChange={(e) => setGear({ ...gear, rod: e.target.value })} />
            <Input placeholder="릴" value={gear.reel} onChange={(e) => setGear({ ...gear, reel: e.target.value })} />
            <Input placeholder="라인" value={gear.line} onChange={(e) => setGear({ ...gear, line: e.target.value })} />
            <Input placeholder="루어/미끼" value={gear.lure} onChange={(e) => setGear({ ...gear, lure: e.target.value })} />
            <Input placeholder="채비(리그)" value={gear.rig} onChange={(e) => setGear({ ...gear, rig: e.target.value })} className="col-span-2" />
          </div>
        </Card>

        <ProductTagPicker selected={productIds} onChange={handleProductChange} />

        {productIds.length > 0 && photos[0] && (
          <ProductTagPlacer
            photoUrl={photos[0].preview}
            selected={productIds}
            positions={tagPositions}
            onChange={setTagPositions}
          />
        )}

        <Card className="space-y-3 p-4">
          <div>
            <SectionTitle className="mb-2 flex items-center gap-1.5">
              <MapPin size={14} /> 위치
              <span className="font-normal normal-case tracking-normal text-navy-300">{coords ? "· 현재 위치 자동 저장됨" : "· 수동 선택"}</span>
            </SectionTitle>
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">지역 선택</option>{KOREA_SPOTS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              <option value="기타">기타(직접입력)</option>
            </Select>
            {region === "기타" && (
              <Input value={customRegion} onChange={(e) => setCustomRegion(e.target.value)} placeholder="지역 직접 입력" className="mt-2" />
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-navy-500">포인트 위치 공개</p>
            <div className="flex flex-wrap gap-2">
              {POINT_VISIBILITY.map((v) => <Chip key={v.key} active={pointVisibility === v.key} onClick={() => setPointVisibility(v.key)}>{v.label}</Chip>)}
            </div>
          </div>
        </Card>

        <Card className="space-y-2.5 bg-navy-50/40 p-4">
          <button onClick={() => setShareToFeed((v) => !v)} className="flex w-full items-center justify-between">
            <span className="text-sm font-semibold text-navy-700">피싱 피드에도 공유하기</span>
            <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${shareToFeed ? "bg-orange-500" : "bg-navy-200"}`}>
              <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${shareToFeed ? "translate-x-5" : ""}`} />
            </span>
          </button>
          {shareToFeed && (
            <div className="flex flex-wrap gap-2">
              {VISIBILITY_OPTIONS.map((v) => <Chip key={v.key} active={visibility === v.key} onClick={() => setVisibility(v.key)}>{v.label}</Chip>)}
            </div>
          )}
          <div className={`flex items-center gap-1.5 text-xs ${eligible ? "text-aqua-600" : "text-navy-300"}`}>
            <Trophy size={13} /> {eligible ? "대회 참가 가능한 기록입니다" : "어종·크기 입력 시 대회 참가 가능"}
          </div>
        </Card>

        <div className="flex flex-col gap-2.5">
          <Button onClick={() => { setShareToFeed(true); submit(true); }} disabled={loading} variant="primary" full size="lg" leftIcon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}>
            {loading ? "저장 중..." : "피싱 피드에 공유하기"}
          </Button>
          <Button onClick={() => { setShareToFeed(false); submit(false); }} disabled={loading} variant="outline" full size="lg">
            비공개로 저장
          </Button>
        </div>
      </div>

      {/* 사진 선택 바텀 시트 */}
      <Sheet open={photoSheetOpen} onClose={() => setPhotoSheetOpen(false)} title="사진 추가">
        <div className="flex flex-col gap-3 pb-4">
          <button
            type="button"
            onClick={() => { setPhotoSheetOpen(false); setShowCameraCapture(true); }}
            className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 px-4 py-3.5 text-sm font-semibold text-navy-700 transition-colors active:bg-navy-100"
          >
            <Camera size={20} className="text-orange-500" /> 카메라로 촬영
          </button>
          <button
            type="button"
            onClick={() => { galleryInputRef.current!.value = ""; galleryInputRef.current!.click(); }}
            className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 px-4 py-3.5 text-sm font-semibold text-navy-700 transition-colors active:bg-navy-100"
          >
            <Images size={20} className="text-aqua-500" /> 갤러리에서 선택
          </button>
        </div>
      </Sheet>

      {/* 배스 실루엣 기준 커스텀 카메라 */}
      {showCameraCapture && (
        <CameraCapture
          onCapture={(url, cm) => handleCameraCapture(url, cm)}
          onClose={() => setShowCameraCapture(false)}
        />
      )}

      <Sheet open={rulerOpen} onClose={() => setRulerOpen(false)} title="스마트 자 · 사이즈 측정">
        {photos[0] && (
          <SmartRuler
            imageUrl={photos[0].preview}
            species={species || undefined}
            onComplete={(r) => { setRuler(r); setSize(String(r.measuredLengthCm)); setRulerOpen(false); toast(`측정 완료: ${r.measuredLengthCm.toFixed(1)}cm`, "success"); }}
          />
        )}
      </Sheet>
    </div>
  );
}
