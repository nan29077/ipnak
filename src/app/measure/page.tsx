"use client";
/**
 * AI 카메라 측정 페이지
 * 상태 머신: IDLE → ANALYZING → (ERROR | MANUAL_HEAD → MANUAL_TAIL | RESULT) → SAVING → SAVED
 * - 입낚볼(40mm) 또는 ArUco 마커(20mm)를 기준으로 픽셀→실측 변환
 * - AI 모델 미탑재 시 머리/꼬리 수동 탭 측정 (목 모드)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Camera, Images, RefreshCcw, Save, Download, BookOpen, AlertTriangle,
  CircleDashed, Loader2, Fish, ScanLine, Map as MapIcon, Trophy, Ruler, ChevronRight,
} from "lucide-react";
import { PageHeader, Button, Chip } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { MEASURE_ERRORS, FISH_SPECIES } from "@/constants/errorMessages";
import { BallDetector, FishDetector, MeasurementCalculator, AROverlay } from "@/utils";
import { dbService } from "@/services/DatabaseService";
import autoTagService from "@/services/AutoTagService";
import syncService from "@/services/SyncService";
// LiveMeasureCamera 미사용 — 네이티브 카메라 앱으로 대체
import { BallLinkSection } from "@/components/BallLinkSection";
import { useRecording } from "@/components/RecordingProvider";
import { DiarySheet } from "@/components/DiarySheet";

type Phase = "IDLE" | "ANALYZING" | "ERROR" | "MANUAL_HEAD" | "MANUAL_TAIL" | "RESULT" | "SAVING" | "SAVED";
type Point = { x: number; y: number };

const MAX_WORK_PX = 1280;

export default function MeasurePage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { addCatchToRecording, status: recStatus, lastPoint, sessionId } = useRecording();

  // 대회 참가 모드 — URL ?tournamentId=xxx&species=xxx 로 진입
  const tournamentId = searchParams.get("tournamentId");
  const tournamentSpecies = searchParams.get("species");
  // 대회 페이지에서 'AI 카메라 계측' 클릭 시 카메라 자동 시작
  const autoCamera = searchParams.get("autoCamera") === "1";

  const [phase, setPhase] = useState<Phase>("IDLE");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ball, setBall] = useState<any>(null);
  const [isMockFish, setIsMockFish] = useState(false);
  const [head, setHead] = useState<Point | null>(null);
  const [tail, setTail] = useState<Point | null>(null);
  const [species, setSpecies] = useState<string>(tournamentSpecies ?? "기타");
  const [result, setResult] = useState<any>(null);
  const [hasImage, setHasImage] = useState(false);
  const [savedImageBase64, setSavedImageBase64] = useState<string | null>(null);
  const [tourSubmitting, setTourSubmitting] = useState(false);
  const [tourSubmitted, setTourSubmitted] = useState(false);
  // 첫 방문 튜토리얼
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // 데이터피싱(기록 중) 화면에서 진입했는지 (?from=fishing) — 완료 후 복귀 안내
  const [fromFishing, setFromFishing] = useState(false);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("from") === "fishing") setFromFishing(true);
    } catch { /* noop */ }
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null); // 네이티브 카메라 앱
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const enginesRef = useRef<{ ball: any; fish: any; calc: any; overlay: any } | null>(null);

  function engines() {
    if (!enginesRef.current) {
      enginesRef.current = {
        ball: new BallDetector(),
        fish: new FishDetector(),
        calc: new MeasurementCalculator(),
        overlay: new AROverlay(),
      };
    }
    return enginesRef.current;
  }

  /* ── 촬영/선택 → 작업 캔버스(최대 1280px) 준비 → 분석 ── */
  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setErrorMsg(null);
    setBall(null);
    setHead(null);
    setTail(null);
    setResult(null);
    setIsMockFish(false);
    setPhase("ANALYZING");
    setLoadingMsg("사진 준비 중...");

    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("이미지를 읽을 수 없어요."));
        im.src = url;
      });

      const scale = Math.min(1, MAX_WORK_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const work = document.createElement("canvas");
      work.width = Math.round(img.naturalWidth * scale);
      work.height = Math.round(img.naturalHeight * scale);
      work.getContext("2d")!.drawImage(img, 0, 0, work.width, work.height);
      workCanvasRef.current = work;
      URL.revokeObjectURL(url);
      setHasImage(true);

      await analyze(work);
    } catch (e: any) {
      setErrorMsg(e?.message || "사진을 불러오지 못했어요.");
      setPhase(hasImage ? "ERROR" : "IDLE");
    }
  }

  /* ── (미사용) 실시간 카메라 촬영본 핸들러 — 네이티브 카메라로 대체 ── */
  async function handleLiveCapture(work: HTMLCanvasElement) {
    setErrorMsg(null);
    setBall(null);
    setHead(null);
    setTail(null);
    setResult(null);
    setIsMockFish(false);
    workCanvasRef.current = work;
    setHasImage(true);
    setPhase("ANALYZING");
    setLoadingMsg("촬영본 분석 중...");
    await analyze(work);
  }

  async function analyze(_work: HTMLCanvasElement) {
    // 입낚볼 없이도 즉시 동작 — 볼 감지 건너뜀, 수동 탭 모드로 바로 진입
    // (입낚볼 연동 시: 볼 감지 코드 재활성화 예정)
    setIsMockFish(true);
    setPhase("MANUAL_HEAD");
  }

  /* ── 측정값 계산 ── */
  useEffect(() => {
    if (!head || !tail) { setResult(null); return; }
    if (!ball) {
      // 볼 없음 — 길이 계산 불가, 사진 기록은 가능
      setResult({ lengthCm: null, weightG: null, grade: { label: "사진 기록", color: "#888", grade: "N/A" }, legal: null });
      return;
    }
    const eng = engines();
    const lengthCm = eng.calc.calculateLength(head, tail, ball.mmPerPixel);
    const weightG = eng.calc.estimateWeight(lengthCm, species);
    const grade = eng.calc.getConfidenceGrade(ball.confidence, ball.method);
    const legal = eng.calc.checkLegalSize(lengthCm, species);
    setResult({ lengthCm, weightG, grade, legal });
  }, [ball, head, tail, species]);

  /* ── 오버레이 렌더 ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const work = workCanvasRef.current;
    if (!canvas || !work || !hasImage) return;
    engines().overlay.draw(canvas, {
      imageElement: work,
      ballResult: ball,
      measureResult: result,
      headPoint: head,
      tailPoint: tail,
      selectedSpecies: species,
      isMockMode: isMockFish && phase !== "SAVED",
    });
  }, [hasImage, ball, result, head, tail, species, isMockFish, phase]);

  /* ── 캔버스 탭: 머리 → 꼬리 지정 / 결과 화면에서는 가까운 점 이동 ── */
  function onCanvasTap(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const p = { x, y };

    if (phase === "MANUAL_HEAD") {
      setHead(p);
      setPhase("MANUAL_TAIL");
    } else if (phase === "MANUAL_TAIL") {
      setTail(p);
      setPhase("RESULT");
    } else if (phase === "RESULT" && head && tail) {
      const dHead = Math.hypot(p.x - head.x, p.y - head.y);
      const dTail = Math.hypot(p.x - tail.x, p.y - tail.y);
      if (dHead <= dTail) setHead(p);
      else setTail(p);
    }
  }

  /* ── 저장 ── */
  async function handleSave() {
    if (!result) return;
    setPhase("SAVING");
    try {
      const tags = await autoTagService.collectAll().catch(() => null);

      // 저장용 이미지: 640px 로 축소 (localStorage 용량 보호)
      const work = workCanvasRef.current!;
      const s = Math.min(1, 640 / Math.max(work.width, work.height));
      const thumb = document.createElement("canvas");
      thumb.width = Math.round(work.width * s);
      thumb.height = Math.round(work.height * s);
      thumb.getContext("2d")!.drawImage(canvasRef.current!, 0, 0, thumb.width, thumb.height);
      const imageBase64 = thumb.toDataURL("image/jpeg", 0.6);

      await dbService.saveMeasurement({
        lengthCm: result.lengthCm,
        weightG: result.weightG,
        speciesKr: species,
        confidence: ball?.confidence ?? 0,
        confidenceGrade: result.grade?.grade ?? null,
        imageBase64,
        latitude: tags?.location?.latitude ?? null,
        longitude: tags?.location?.longitude ?? null,
        locationName: tags?.location?.locationName ?? null,
        weather: tags?.weather?.weather ?? null,
        temperature: tags?.weather?.temperature ?? null,
        tidePhase: tags?.tide?.tidePhase ?? null,
      });

      setSavedImageBase64(imageBase64);
      toast(MEASURE_ERRORS.SAVE_SUCCESS, "success");
      syncService.syncPendingMeasurements(); // 백그라운드 (서버 준비 전엔 스킵)

      // 데이터피싱 기록 중이면 catches에 추가 (워킹 피드 공유 + 피쉬 숫자 표시용)
      if (recStatus === "tracking" || recStatus === "paused") {
        const catchLat = tags?.location?.latitude ?? lastPoint?.lat ?? null;
        const catchLng = tags?.location?.longitude ?? lastPoint?.lng ?? null;
        addCatchToRecording({
          photoUrl: imageBase64,
          speciesName: species,
          lat: catchLat,
          lng: catchLng,
        });
        // DB에도 FishingPoint 저장 (tripId 연결 필수 — 상세 페이지 피쉬 기록 표시용)
        if (sessionId) {
          fetch("/api/catch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              speciesName: species,
              sizeCm: result?.lengthCm ?? null,
              photoUrl: imageBase64,
              lat: catchLat,
              lng: catchLng,
              tripId: sessionId,
              shareToFeed: false, // 워킹피드에서 별도 공유 — 여기선 피드 미공개
              pointVisibility: "EXACT",
            }),
          }).catch(() => {}); // 백그라운드 저장 — 실패해도 기록 흐름 중단 없음
        }
      }

      setPhase("SAVED");
    } catch (e: any) {
      toast(e?.message || "저장에 실패했어요.", "error");
      setPhase("RESULT");
    }
  }

  /* ── 공유 이미지 다운로드 ── */
  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await engines().overlay.getShareImage(canvas);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `입낚측정_${result?.lengthCm ?? ""}cm_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── 대회 제출 (tournamentId 모드) ── */
  async function submitToTournament() {
    if (!tournamentId || !result) return;
    setTourSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speciesName: species,
          sizeCm: result.lengthCm,
          photoUrl: savedImageBase64,
          measuredImageUrl: savedImageBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류가 발생했습니다");
      setTourSubmitted(true);
      toast("대회에 제출했습니다 (심사중)", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setTourSubmitting(false);
    }
  }

  function reset() {
    setPhase("IDLE");
    setHasImage(false);
    setErrorMsg(null);
    setBall(null);
    setHead(null);
    setTail(null);
    setResult(null);
    setIsMockFish(false);
    workCanvasRef.current = null;
  }

  /* ── 재촬영: 네이티브 카메라 재시작 ── */
  const retake = useCallback(() => {
    reset();
    cameraInputRef.current?.click();
  }, []);

  /* ── AI 카메라 계측 열기: 첫 방문이면 튜토리얼 먼저, 이후엔 네이티브 카메라 직접 ── */
  const TUTORIAL_KEY = "ipnak_ai_tutorial_done";
  const openCamera = useCallback(() => {
    try {
      if (!localStorage.getItem(TUTORIAL_KEY)) {
        setTutorialStep(0);
        setTutorialOpen(true);
        return;
      }
    } catch { /* noop */ }
    cameraInputRef.current?.click(); // 네이티브 카메라 앱 열기
  }, []);

  // autoCamera 모드: 페이지 마운트 즉시 카메라 열기 (대회 제출 플로우에서 단계 줄이기)
  useEffect(() => {
    if (!autoCamera) return;
    const t = setTimeout(() => cameraInputRef.current?.click(), 200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [diaryOpen, setDiaryOpen] = useState(false);

  const showCanvas = hasImage && phase !== "IDLE";
  const busy = phase === "ANALYZING" || phase === "SAVING";

  return (
    <div className={showCanvas ? "pb-2" : "pb-10"}>
      <PageHeader
        title="AI 측정"
        back
        sub="입낚볼 기준 물고기 자동 계측"
        right={
          <button
            type="button"
            onClick={() => setDiaryOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-[12px] font-semibold text-navy-600 transition-colors hover:bg-navy-100"
          >
            <BookOpen size={15} strokeWidth={1.9} />
            측정일지
          </button>
        }
      />

      {/* 갤러리 파일 입력 */}
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />
      {/* 네이티브 카메라 앱 입력 */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />

      <div className={showCanvas ? "space-y-2 px-3 py-2" : "space-y-3 p-4"}>
        {/* ── IDLE: 안내 + 촬영 버튼 ── */}
        {phase === "IDLE" && (
          <>
            {/* 데이터피싱(기록 중)에서 진입한 경우 복귀 안내 */}
            {fromFishing && (
              <div className="flex items-center gap-2 rounded-xl border border-aqua-500/30 bg-aqua-500/10 px-3 py-2">
                <MapIcon size={15} strokeWidth={1.9} className="shrink-0 text-aqua-400" />
                <p className="text-[12px] font-medium text-aqua-300">데이터피싱 기록 중 — 측정 후 뒤로가면 기록 화면으로 돌아가요.</p>
              </div>
            )}

            {/* 안내 카드 */}
            <div className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-surface-200 px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                <ScanLine size={20} strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-navy-900">입낚볼 기준 AI 자동 계측</p>
                <p className="text-[11px] text-navy-400">입낚볼 없이 머리·꼬리를 직접 탭해도 측정 가능</p>
              </div>
            </div>

            {/* AI 카메라 계측 + 갤러리 선택 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={openCamera}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-orange-500/50 bg-orange-500/5 py-6 text-orange-500 transition-colors hover:bg-orange-500/10 active:scale-[0.98]"
              >
                <Camera size={26} strokeWidth={1.7} />
                <span className="text-[13px] font-bold">AI 카메라 계측</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-navy-200 py-6 text-navy-400 transition-colors hover:border-aqua-400 hover:text-aqua-400 active:scale-[0.98]"
              >
                <Images size={26} strokeWidth={1.7} />
                <span className="text-[13px] font-bold">갤러리 선택</span>
              </button>
            </div>

            {/* 입낚볼 연동 */}
            <BallLinkSection />
          </>
        )}

        {/* ── 측정 캔버스 ── */}
        {showCanvas && (
          <div className="relative overflow-hidden rounded-card ring-1 ring-navy-100">
            <canvas
              ref={canvasRef}
              onPointerDown={onCanvasTap}
              className="block touch-none select-none"
              style={{ width: "100%", height: "auto", maxHeight: "38vh" }}
            />
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-[2px]">
                <Loader2 className="animate-spin text-orange-400" size={30} />
                <p className="px-6 text-center text-[13px] font-medium text-white">
                  {phase === "SAVING" ? "위치·날씨 태그 수집 후 저장 중..." : loadingMsg}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── 수동 탭 안내 ── */}
        {(phase === "MANUAL_HEAD" || phase === "MANUAL_TAIL") && (
          <div className="flex items-center gap-2 rounded-2xl border border-aqua-500/30 bg-aqua-500/10 px-3 py-2">
            <Fish size={16} strokeWidth={1.9} className="shrink-0 text-aqua-400" />
            <p className="text-[13px] font-medium text-aqua-300">
              {phase === "MANUAL_HEAD"
                ? "물고기 머리(입) 끝을 탭해 주세요"
                : "이번엔 꼬리 끝을 탭해 주세요"}
            </p>
          </div>
        )}

        {/* ── 에러 ── */}
        {phase === "ERROR" && errorMsg && (
          <div className="rounded-card border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} strokeWidth={1.9} className="mt-0.5 shrink-0 text-red-400" />
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-red-300">{errorMsg}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => cameraInputRef.current?.click()} leftIcon={<Camera size={15} />}>AI 카메라 재촬영</Button>
              <Button size="sm" variant="outline" onClick={() => galleryInputRef.current?.click()} leftIcon={<Images size={15} />}>
                갤러리 선택
              </Button>
            </div>
          </div>
        )}

        {/* ── 어종 선택 + 결과 ── */}
        {(phase === "RESULT" || phase === "SAVING" || phase === "MANUAL_TAIL") && (
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            {FISH_SPECIES.map((s: any) => (
              <Chip key={s.key} size="sm" active={species === s.key} onClick={() => setSpecies(s.key)}>
                {s.key}
              </Chip>
            ))}
          </div>
        )}

        {phase === "RESULT" && result && (
          <>
            {result.legal?.belowLimit && result.lengthCm != null && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/15 px-3.5 py-3">
                <AlertTriangle size={18} strokeWidth={2} className="shrink-0 text-red-400" />
                <p className="text-[13px] font-semibold text-red-300">
                  {species} 금지체장 {result.legal.minSize}cm 미만이에요. 방생해 주세요.
                </p>
              </div>
            )}

            <div className="rounded-card border border-navy-100 bg-surface-200 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[12px] font-medium text-navy-400">{species} · 전장</p>
                  {result.lengthCm != null ? (
                    <p className="mt-0.5 text-[32px] font-extrabold leading-none tracking-tight text-navy-900">
                      {result.lengthCm}
                      <span className="ml-1 text-[16px] font-bold text-navy-400">cm</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[16px] font-bold text-navy-600">사진으로 기록</p>
                  )}
                </div>
                {result.weightG != null && (
                  <div className="text-right">
                    <p className="text-[12px] text-navy-400">추정 무게</p>
                    <p className="text-[18px] font-bold text-navy-800">약 {result.weightG}g</p>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-navy-100 pt-3">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ color: result.grade.color, backgroundColor: `${result.grade.color}22` }}
                >
                  {result.grade.label}
                </span>
                {result.lengthCm != null ? (
                  <p className="text-[11px] text-navy-300">
                    기준: {ball?.method === "aruco" ? "ArUco 마커 20mm" : "입낚볼 40mm"} · 점 탭으로 미세조정 가능
                  </p>
                ) : (
                  <p className="text-[11px] text-navy-400">입낚볼 연동 시 정확한 길이 측정 가능</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={retake} leftIcon={<RefreshCcw size={15} />}>재촬영</Button>
              <Button variant="outline" size="sm" onClick={handleDownload} leftIcon={<Download size={15} />}>이미지</Button>
              <Button size="sm" onClick={handleSave} leftIcon={<Save size={15} />}>저장</Button>
            </div>
          </>
        )}

        {/* ── 저장 완료 ── */}
        {phase === "SAVED" && result && (
          <div className="space-y-3">
            <div className="rounded-card border border-aqua-500/30 bg-aqua-500/10 p-4 text-center">
              <p className="text-[15px] font-bold text-aqua-300">
                {species}{result.lengthCm != null ? ` ${result.lengthCm}cm` : ""} 기록 완료
              </p>
              <p className="mt-1 text-[12px] text-navy-400">측정일지에서 언제든 다시 볼 수 있어요.</p>
            </div>

            {/* 대회 참가 모드 */}
            {tournamentId && (
              tourSubmitted ? (
                <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 px-4 py-3">
                  <Trophy size={16} className="shrink-0 text-orange-400" />
                  <p className="text-[13px] font-semibold text-orange-400">대회에 제출 완료! 관리자 심사 후 랭킹에 반영됩니다.</p>
                </div>
              ) : (
                <Button
                  full
                  size="lg"
                  onClick={submitToTournament}
                  disabled={tourSubmitting}
                  leftIcon={tourSubmitting ? <Loader2 size={17} className="animate-spin" /> : <Trophy size={17} />}
                >
                  {tourSubmitting ? "제출 중..." : "대회에 제출하기"}
                </Button>
              )
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={reset} leftIcon={<Camera size={16} />}>새 측정</Button>
              <button
                type="button"
                onClick={() => setDiaryOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-orange-500 px-4 py-2.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-orange-600 active:scale-[0.97]"
              >
                <BookOpen size={16} strokeWidth={1.9} />
                측정일지 보기
              </button>
            </div>
            {/* 데이터피싱에서 진입한 경우: 기록 화면으로 복귀 */}
            {fromFishing && (
              <Link
                href="/map"
                className="flex items-center justify-center gap-2 rounded-[16px] bg-aqua-500 px-4 py-2.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-aqua-600 active:scale-[0.97]"
              >
                <MapIcon size={16} strokeWidth={1.9} />
                데이터피싱으로 돌아가기
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── 첫 방문 튜토리얼 오버레이 ── */}
      {tutorialOpen && (
        <AiMeasureTutorial
          step={tutorialStep}
          onNext={() => {
            if (tutorialStep < TUTORIAL_STEPS.length - 1) {
              setTutorialStep((s) => s + 1);
            } else {
              // 마지막 단계: "카메라 촬영" 버튼 → 네이티브 카메라 열기
              try { localStorage.setItem("ipnak_ai_tutorial_done", "1"); } catch { /* noop */ }
              setTutorialOpen(false);
              setTimeout(() => cameraInputRef.current?.click(), 100);
            }
          }}
          onSkip={() => {
            try { localStorage.setItem("ipnak_ai_tutorial_done", "1"); } catch { /* noop */ }
            setTutorialOpen(false);
            setTimeout(() => cameraInputRef.current?.click(), 100);
          }}
        />
      )}

      {/* ── 측정일지 바텀시트 ── */}
      <DiarySheet open={diaryOpen} onClose={() => setDiaryOpen(false)} />
    </div>
  );
}

/* ─────────────────────────────────────────
   첫 방문 AI 측정 튜토리얼 오버레이
───────────────────────────────────────── */
const TUTORIAL_STEPS = [
  {
    icon: <CircleDashed size={36} strokeWidth={1.6} className="text-orange-400" />,
    title: "입낚볼과 함께 촬영하세요",
    desc: "40mm 입낚볼을 물고기 옆에 놓고 함께 촬영하면\n길이가 자동으로 계산됩니다.\n입낚볼이 없어도 직접 탭해서 측정할 수 있어요.",
    hint: "입낚볼 ≈ 40mm",
  },
  {
    icon: <Fish size={36} strokeWidth={1.6} className="text-aqua-400" />,
    title: "물고기 머리를 탭하세요",
    desc: "촬영 후 사진에서 물고기 머리(입) 끝부분을\n손가락으로 탭하세요.\n드래그로 미세 조정도 가능합니다.",
    hint: "1번 탭 → 머리 지정",
  },
  {
    icon: <Ruler size={36} strokeWidth={1.6} className="text-aqua-400" />,
    title: "꼬리 끝을 탭하세요",
    desc: "이어서 물고기 꼬리 끝을 탭하면\n전장(cm)이 자동으로 계산됩니다.\n탭한 점을 다시 탭해 위치를 조정할 수 있어요.",
    hint: "2번 탭 → 꼬리 지정 → 계산",
  },
  {
    icon: <Save size={36} strokeWidth={1.6} className="text-orange-400" />,
    title: "어종 선택 후 저장",
    desc: "길이가 표시되면 어종을 선택하고\n저장 버튼을 누르면 측정일지에 기록됩니다.\n진행 중인 대회에 바로 제출할 수도 있어요.",
    hint: "저장 → 측정일지 / 대회 제출",
  },
];

import { createPortal } from "react-dom";

function AiMeasureTutorial({
  step, onNext, onSkip,
}: {
  step: number; onNext: () => void; onSkip: () => void;
}) {
  const s = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[500] flex flex-col items-center justify-end bg-black/85 backdrop-blur-[3px]">
      {/* 배경 탭으로 닫기 방지 — 버튼으로만 진행 */}
      <div className="w-full max-w-[480px] overflow-hidden rounded-t-[28px] bg-[#161c24] ring-1 ring-white/[0.08]">
        {/* 상단 진행 바 */}
        <div className="flex gap-1 px-5 pt-5">
          {TUTORIAL_STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-orange-500" : "bg-white/15"}`} />
          ))}
        </div>

        {/* 아이콘 + 내용 */}
        <div className="px-6 py-6 text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex h-[80px] w-[80px] items-center justify-center rounded-[24px] bg-white/[0.06] ring-1 ring-white/10">
              {s.icon}
            </div>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400">STEP {step + 1} / {TUTORIAL_STEPS.length}</p>
          <h2 className="mt-2 text-[18px] font-extrabold tracking-tight text-white">{s.title}</h2>
          <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-white/55">{s.desc}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-[11px] font-semibold text-orange-400">
            <ChevronRight size={12} /> {s.hint}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 px-5 pb-8">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-2xl px-4 py-3 text-[13px] font-medium text-white/35 transition-colors hover:text-white/60"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
          >
            {isLast ? "카메라 촬영" : "다음"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
