"use client";
/**
 * AI 카메라 측정 페이지
 * 상태 머신: IDLE → ANALYZING → CHOICE → SCANNING → (SCAN_FAILED | RESULT) → SAVING → SAVED
 * - 입낚볼(40mm) 또는 ArUco 마커(20mm)를 기준으로 픽셀→실측 변환
 * - 측정은 AI 자동 스캔으로만 진행 (수동 점찍기 모드 제거)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
import { useUser } from "@/lib/userContext";
import {
  Camera, Images, RefreshCcw, Save, Download, BookOpen, AlertTriangle,
  CircleDashed, Loader2, Fish, ScanLine, Map as MapIcon, Trophy, ChevronRight, FolderOpen, X, Smartphone, QrCode, KeyRound, MapPin, Nfc,
} from "lucide-react";
import { FishingSpotSaveModal, type FishingSpotDraft } from "@/components/FishingSpotSaveModal";
import { PageHeader, Button, Chip } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { MEASURE_ERRORS, FISH_SPECIES } from "@/constants/errorMessages";
import { MeasurementCalculator, AROverlay } from "@/utils";
import { dbService } from "@/services/DatabaseService";
import autoTagService from "@/services/AutoTagService";
import syncService from "@/services/SyncService";
// 실시간 AI 스캐너 (앱 내 카메라 스트림 + /api/measure/scan 폴링)
import { LiveScanCamera, type LiveScanResult } from "@/components/LiveScanCamera";
import { FishScanGlow } from "@/components/FishScanGlow";
import { FishShimmer } from "@/components/FishShimmer";
import { estimateWeightByWidth } from "@/lib/weightEstimation";
import { AI_REFERENCE_RADIUS_MARGIN, refineReferenceCircle } from "@/lib/measurementRefinement";
import { BallLinkSection, KeyringLinkSection } from "@/components/BallLinkSection";
import { SpeciesIdentifySection } from "@/components/SpeciesIdentifySection";
import { useRecording } from "@/components/RecordingProvider";
import { DiarySheet } from "@/components/DiarySheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { entryFeeConfirmText, fetchEntryFeeInfo, type EntryFeeInfo } from "@/lib/tournamentFee";
import { IphoneTagGuideModal, IOS_TAG_GUIDE_KEY } from "@/components/IphoneTagGuideModal";
import { isIOSDevice } from "@/lib/device";

type Phase =
  | "IDLE"
  | "ANALYZING"
  | "CHOICE"       // 사진 로드 후: 자동 스캔 / 수동 점찍기 선택
  | "SCANNING"     // AI 자동 스캔 진행 중
  | "SHIMMER"      // 인식 성공 → 윤슬(빛 포인트) 한 바퀴 후 결과 확정
  | "SCAN_FAILED"  // 자동 스캔 실패 → 잠시 안내 후 선택 화면 복귀
  | "ERROR"
  | "RESULT"
  | "SAVING"
  | "SAVED";
type Point = { x: number; y: number };

const MAX_WORK_PX = 1280;
const SCAN_TIMEOUT_MS = 12000; // 자동 스캔 하드 타임아웃 — 무한 로딩 방지
const SCAN_MIN_CONFIDENCE = 0.7; // 이 미만이면 실패 처리
const SHIMMER_MS = 1800; // 윤슬(빛 포인트)이 물고기 외곽을 한 바퀴 도는 시간

export default function MeasurePage() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addCatchToRecording, status: recStatus, lastPoint, sessionId } = useRecording();
  const currentUser = useUser();
  const loggedIn = !!currentUser;
  const [loginModal, setLoginModal] = useState(false);

  // 대회 참가 모드 — URL ?tournamentId=xxx&species=xxx 로 진입
  const tournamentId = searchParams.get("tournamentId");
  const tournamentSpecies = searchParams.get("species");
  // 대회 페이지에서 'AI 카메라 계측' 클릭 시 카메라 자동 시작
  const autoCamera = searchParams.get("autoCamera") === "1";

  // NFC 태그 URL(/ball?id=XXX, /keyring?id=XXX)에서 넘어온 진입
  // — 태그한 볼·키링 ID 가 선택된 상태로 계측 화면이 열린다.
  const tagBallId = (searchParams.get("ballId") || "").trim().toUpperCase() || null;
  const tagKeyringId = (searchParams.get("keyringId") || "").trim().toUpperCase() || null;
  const fromTag = searchParams.get("fromTag") === "1";

  const [phase, setPhase] = useState<Phase>("IDLE");
  const [liveScanOpen, setLiveScanOpen] = useState(false); // 실시간 AI 스캐너 열림 여부
  const browserLandscape = false; // 가로 방향에서도 정상 표시
  const [loadingMsg, setLoadingMsg] = useState("");
  const [scanFailMsg, setScanFailMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ball, setBall] = useState<any>(null);
  const [head, setHead] = useState<Point | null>(null);
  const [tail, setTail] = useState<Point | null>(null);
  // 몸통 최대 너비 양 끝점 (AI 자동 스캔에서만 감지 — 수동 측정 시 null)
  const [widthPts, setWidthPts] = useState<{ top: Point; bottom: Point } | null>(null);
  const [species, setSpecies] = useState<string>(tournamentSpecies ?? "기타");
  const [result, setResult] = useState<any>(null);
  const [hasImage, setHasImage] = useState(false);
  const [savedImageBase64, setSavedImageBase64] = useState<string | null>(null);
  // 어장포인트로 저장 — 측정 위치·어종·사진을 자동 입력한다 (기존 저장 흐름과 독립)
  const [spotDraft, setSpotDraft] = useState<FishingSpotDraft | null>(null);
  const [spotCatchId, setSpotCatchId] = useState<string | null>(null);
  const [spotModalOpen, setSpotModalOpen] = useState(false);
  // 어종 자동 인식에 넘길 사진 (RESULT 진입 시 작업 캔버스에서 1회 생성)
  const [speciesImageUrl, setSpeciesImageUrl] = useState<string | null>(null);
  const [tourSubmitting, setTourSubmitting] = useState(false);
  const [tourSubmitted, setTourSubmitted] = useState(false);
  // 참가비 차감 확인 모달 (null 이면 닫힘)
  const [feeConfirm, setFeeConfirm] = useState<EntryFeeInfo | null>(null);
  // 첫 방문 튜토리얼
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // 스마트피싱(기록 중) 화면에서 진입했는지 (?from=fishing) — 완료 후 복귀 안내
  const [fromFishing, setFromFishing] = useState(false);
  // 현재 연동된 입낚볼 ID (측정 저장 시 ballId 연결에 사용)
  // 태그로 들어왔으면 태그한 ID 를 그대로 선택 상태로 둔다.
  const [activeBallId, setActiveBallId] = useState<string | null>(tagBallId);
  // 현재 연동된 입낚키링 ID (키링 모드 측정 저장 시 keyringId 연결에 사용)
  const [activeKeyringId, setActiveKeyringId] = useState<string | null>(tagKeyringId);
  // 연동 조회 완료 여부 — 조회가 끝나기 전에는 "미연동"으로 단정하지 않는다 (오탐 방지)
  const [ballLinkLoaded, setBallLinkLoaded] = useState(false);
  const [keyringLinkLoaded, setKeyringLinkLoaded] = useState(false);
  // 연동된 입낚볼·입낚키링이 하나도 없을 때 카메라 대신 띄우는 안내 모달
  const [noLinkModal, setNoLinkModal] = useState(false);

  // 입낚볼 / 입낚키링 서비스 스위치 (관리자 설정) — 측정 모드·연동 섹션 노출 기준
  const [ballEnabled, setBallEnabled] = useState(true);
  const [keyringEnabled, setKeyringEnabled] = useState(false);
  // 기준물 측정 모드 — 볼(구, 어느 각도든 40mm) / 키링(평면 디스크, 수직 촬영 필요)
  // 키링 태그로 들어왔으면 키링 모드로 시작한다.
  const [refType, setRefType] = useState<"ball" | "keyring">(tagKeyringId ? "keyring" : "ball");
  const anyRefEnabled = ballEnabled || keyringEnabled;
  // 스위치 로딩 완료 여부 — 로딩 전에는 카메라 자동 열기를 보류한다.
  const [flagsLoaded, setFlagsLoaded] = useState(false);

  useEffect(() => {
    // 워치독: 스위치 조회가 지연돼도 2초 뒤에는 기존 동작(카메라 자동 열기)을 그대로 진행한다.
    const fallback = setTimeout(() => setFlagsLoaded(true), 2000);
    fetch("/api/ipnak/service-flags", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const ball = d.ballEnabled !== false;
        const keyring = d.keyringEnabled === true;
        setBallEnabled(ball);
        setKeyringEnabled(keyring);
        // 꺼진 상품이 선택돼 있으면 켜져 있는 쪽으로 보정.
        // 단, NFC 태그로 진입한 경우(ballId/keyringId 지정)에는 보정하지 않는다.
        // 보정해 버리면 태그한 기준물과 다른 종류로 바뀌어, 저장 시 태그한 ID 가 빠지고
        // 엉뚱한 연동 ID(내 첫 번째 볼/키링)가 기록에 붙는다.
        setRefType((prev) => {
          if (tagBallId || tagKeyringId) return prev;
          return prev === "ball" && !ball && keyring ? "keyring" : prev === "keyring" && !keyring ? "ball" : prev;
        });
      })
      .catch(() => {})
      .finally(() => { clearTimeout(fallback); setFlagsLoaded(true); });
    return () => clearTimeout(fallback);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("from") === "fishing") setFromFishing(true);
    } catch { /* noop */ }
  }, []);

  // 연동된 입낚볼 ID 로드 (측정 기록과 볼 연결)
  // 태그로 지정된 ID 가 있으면 그것이 우선이므로 덮어쓰지 않는다.
  useEffect(() => {
    if (tagBallId) { setBallLinkLoaded(true); return; }
    fetch("/api/balls", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const first = Array.isArray(data?.balls) ? data.balls[0] : null;
        if (first?.ballId) setActiveBallId(first.ballId);
      })
      .catch(() => {})
      .finally(() => setBallLinkLoaded(true));
  }, [tagBallId]);

  // 연동된 입낚키링 ID 로드 (키링 모드 측정 기록과 키링 연결)
  useEffect(() => {
    if (tagKeyringId) { setKeyringLinkLoaded(true); return; }
    fetch("/api/keyrings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const first = Array.isArray(data?.keyrings) ? data.keyrings[0] : null;
        if (first?.keyringId) setActiveKeyringId(first.keyringId);
      })
      .catch(() => {})
      .finally(() => setKeyringLinkLoaded(true));
  }, [tagKeyringId]);

  // 연동 조회 워치독 — 응답이 지연돼도 2.5초 뒤에는 판정 가능 상태로 넘긴다.
  useEffect(() => {
    const t = setTimeout(() => { setBallLinkLoaded(true); setKeyringLinkLoaded(true); }, 2500);
    return () => clearTimeout(t);
  }, []);

  // 연동 상태 판정 — 조회가 끝났고(오탐 방지) 볼·키링 둘 다 연동되지 않은 경우에만 true
  const linksLoaded = ballLinkLoaded && keyringLinkLoaded;
  const noRefLinked = linksLoaded && !activeBallId && !activeKeyringId;

  /* ── 볼 / 키링 연동 탭 ──
     한 화면에 두 카드를 같이 쌓지 않고 탭으로 나눠, 고른 쪽 내용만 보여준다.
     각 카드는 자기 연동 상태에 따라 "연동 현황(해제 버튼)" 또는 "연동 방법 안내"를 스스로 그린다. */
  const [linkTab, setLinkTab] = useState<"ball" | "keyring">(tagKeyringId ? "keyring" : "ball");
  // 스위치·연동 조회가 끝난 뒤 초기 탭을 한 번만 보정한다 (사용자가 고른 탭을 나중에 덮어쓰지 않도록)
  const linkTabAutoRef = useRef(false);
  useEffect(() => {
    if (linkTabAutoRef.current || !flagsLoaded || !linksLoaded) return;
    linkTabAutoRef.current = true;
    if (tagBallId || tagKeyringId) return; // 태그로 들어왔으면 태그한 기준물 탭 유지
    if (!ballEnabled && keyringEnabled) { setLinkTab("keyring"); return; }
    if (ballEnabled && !keyringEnabled) { setLinkTab("ball"); return; }
    // 둘 다 노출 중이면 이미 연동된 쪽을 먼저 보여준다
    if (!activeBallId && activeKeyringId) setLinkTab("keyring");
  }, [flagsLoaded, linksLoaded, ballEnabled, keyringEnabled, activeBallId, activeKeyringId, tagBallId, tagKeyringId]);
  // 노출 스위치가 꺼진 탭이 선택돼 있으면 켜져 있는 쪽으로 강제 보정한다.
  const activeLinkTab: "ball" | "keyring" =
    ballEnabled && keyringEnabled ? linkTab : (ballEnabled ? "ball" : "keyring");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null); // 네이티브 카메라 앱
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const enginesRef = useRef<{ ball: any; fish: any; calc: any; overlay: any } | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null); // 자동 스캔 fetch 취소용
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 인식 성공 결과 임시 보관 — 윤슬 애니메이션이 끝난 뒤 화면에 반영
  const pendingScanRef = useRef<{
    ball: any; head: Point; tail: Point; width: { top: Point; bottom: Point } | null;
  } | null>(null);
  // 기준물(입낚볼·입낚키링) 미감지 안내 팝업
  const [refMissing, setRefMissing] = useState(false);

  function engines() {
    if (!enginesRef.current) {
      enginesRef.current = {
        ball: null, // 미사용 (서버사이드 AI 스캔으로 대체)
        fish: null, // 미사용 (서버사이드 AI 스캔으로 대체)
        calc: new MeasurementCalculator(),
        overlay: new AROverlay(),
      };
    }
    return enginesRef.current;
  }

  /* ── 촬영/선택 → 작업 캔버스(최대 1280px) 준비 → 분석 ── */
  async function handleFile(file: File | undefined | null) {
    if (!loggedIn) { setLoginModal(true); return; }
    if (!file) return;
    setErrorMsg(null);
    setScanFailMsg(null);
    setBall(null);
    setHead(null);
    setTail(null);
    setWidthPts(null);
    setResult(null);
    setPhase("ANALYZING");
    setLoadingMsg("사진 준비 중...");

    try {
      let work: HTMLCanvasElement;
      try {
        // createImageBitmap with imageOrientation applies EXIF rotation automatically
        // Supported: Chrome 81+, Safari 15+, Firefox 93+
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
        const scale = Math.min(1, MAX_WORK_PX / Math.max(bitmap.width, bitmap.height));
        work = document.createElement("canvas");
        work.width = Math.round(bitmap.width * scale);
        work.height = Math.round(bitmap.height * scale);
        work.getContext("2d")!.drawImage(bitmap, 0, 0, work.width, work.height);
        bitmap.close();
      } catch {
        // Fallback for older browsers (no EXIF correction)
        const url = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error("이미지를 읽을 수 없어요."));
          im.src = url;
        });
        const scale = Math.min(1, MAX_WORK_PX / Math.max(img.naturalWidth, img.naturalHeight));
        work = document.createElement("canvas");
        work.width = Math.round(img.naturalWidth * scale);
        work.height = Math.round(img.naturalHeight * scale);
        work.getContext("2d")!.drawImage(img, 0, 0, work.width, work.height);
        URL.revokeObjectURL(url);
      }
      workCanvasRef.current = work;
      setHasImage(true);

      // 사진 로드 완료 → 측정 방식 선택 화면
      setPhase("CHOICE");
    } catch (e: any) {
      setErrorMsg(e?.message || "사진을 불러오지 못했어요.");
      setPhase(hasImage ? "ERROR" : "IDLE");
    }
  }

  /* ── 자동 스캔: AI로 입낚볼·물고기 머리/꼬리 인식 (12초 하드 타임아웃) ── */
  async function autoScan() {
    const work = workCanvasRef.current;
    if (!work) { setPhase("IDLE"); return; }

    // 이전 스캔 정리
    scanAbortRef.current?.abort();
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);

    setScanFailMsg(null);
    setBall(null);
    setHead(null);
    setTail(null);
    setWidthPts(null);
    setResult(null);
    setPhase("SCANNING");
    setLoadingMsg(`물고기와 ${refType === "keyring" ? "입낚키링" : "입낚볼"}을 인식 중이에요...`);

    const controller = new AbortController();
    scanAbortRef.current = controller;
    // 12초 하드 타임아웃 — fetch도 함께 중단
    const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
    scanTimerRef.current = timeoutId;

    try {
      const dataUrl = work.toDataURL("image/jpeg", 0.92);
      const res = await fetch("/api/measure/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl, width: work.width, height: work.height, testBall: searchParams.get("testBall") === "1", refType }),
        signal: controller.signal,
      });
      if (!res.ok) {
        // 이미지 크기 초과 시 전용 안내 메시지 표시
        const errData = await res.json().catch(() => null);
        if (errData?.reason === "image-too-large") {
          scanFailToChoice("사진 용량이 너무 커요. 더 작은 사진을 선택해 주세요.");
          return;
        }
        throw new Error("ai-error");
      }
      const data = await res.json();

      // 키링이 너무 찌그러진 타원(종횡비 미달) → 수직 촬영 안내 후 선택 화면 복귀
      if (data?.ok === false && data.reason === "keyring-tilted") {
        scanFailToChoice("키링을 바닥에 수평으로 놓고 카메라를 더 수직으로 세워서 다시 찍어주세요.");
        return;
      }

      // 기준물(입낚볼·입낚키링) 미감지 → 측정 불가 안내 후 선택 화면 복귀
      if (data?.ok === false && data.reason === "no-ball") {
        setPhase("CHOICE");
        setRefMissing(true);
        return;
      }

      // ── 자세(pose) 게이트 ──
      // 입낚볼은 지름 40mm 구(球)라 어느 각도·위치에서 봐도 정원으로 보인다. 따라서 볼을 들고
      // 찍은 사진(pose="held")도 바닥에 눕힌 사진과 동일한 정확도로 환산할 수 있다.
      // 반면 입낚키링은 평면 디스크라 기울면 타원으로 찌그러지므로 flat 만 허용한다.
      // (실시간 스캐너 LiveScanCamera 도 볼 경로에서 flat/held 를 모두 통과시킨다 — 두 경로 일치)
      const poseOk =
        refType === "keyring"
          ? data?.pose === "flat"
          : data?.pose === "flat" || data?.pose === "held";
      // 볼을 들고 찍은 프레임은 AI 가 신뢰도를 다소 보수적으로 매기는 경향이 있어
      // 볼 경로만 임계값을 0.6 으로 낮춘다. 키링은 기존 기준(0.7)을 그대로 유지한다.
      const minConf = refType === "keyring" ? SCAN_MIN_CONFIDENCE : Math.min(SCAN_MIN_CONFIDENCE, 0.6);

      // 실패 조건: 입낚볼/물고기 미감지, 허용되지 않는 자세, 신뢰도 부족, 응답 이상
      if (
        !data?.ok ||
        !data.ball || !data.head || !data.tail ||
        !poseOk ||
        typeof data.confidence !== "number" ||
        data.confidence < minConf
      ) {
        throw new Error("scan-unreliable");
      }

      // ── 원근 안전장치 ──
      // 볼이 렌즈 쪽으로 튀어나오고 물고기는 멀리 있으면 볼이 실제보다 크게 찍혀
      // mmPerPixel 이 과소 추정되고 길이가 과대 측정된다. 서버(AI)가 두 피사체의 거리가
      // 명백히 다르다고 판정한 경우에만 차단한다. 필드가 없거나 true 면 그대로 진행.
      if (data.planeConsistent === false) {
        scanFailToChoice(
          `${refType === "keyring" ? "입낚키링" : "볼"}과 물고기가 비슷한 거리에 있도록 맞춰 주세요.`,
        );
        return;
      }

      // ── 정규화 좌표(0~1) → 작업 캔버스 픽셀 좌표 ──
      // 기준물 반지름은 실시간 스캐너(LiveScanCamera)와 완전히 동일한 규칙으로 구한다.
      //   ① 노란 외곽을 픽셀 단위로 정밀화(refineReferenceCircle) → 성공하면 실측 반지름 사용
      //   ② 실패하면 AI 반지름 × AI_REFERENCE_RADIUS_MARGIN (AI 과소 추정 보정)
      // 두 경로의 mmPerPixel 이 달라 같은 물고기가 다르게 측정되던 문제를 없앤다.
      const aiRadiusPx = data.ball.r * work.width;
      let refCenterX = data.ball.x * work.width;
      let refCenterY = data.ball.y * work.height;
      let refRadiusPx = aiRadiusPx * AI_REFERENCE_RADIUS_MARGIN;
      try {
        const wctx = work.getContext("2d", { willReadFrequently: true });
        if (wctx) {
          const pixels = wctx.getImageData(0, 0, work.width, work.height);
          const refined = refineReferenceCircle(
            { data: pixels.data, width: work.width, height: work.height },
            { centerX: refCenterX, centerY: refCenterY, radiusPx: aiRadiusPx },
            searchParams.get("testBall") === "1",
          );
          if (refined.refined) {
            refCenterX = refined.centerX;
            refCenterY = refined.centerY;
            // 키링은 원근 타원이라 픽셀 원 피팅 반지름을 스케일로 쓰지 않는다
            // (서버가 검증한 장축 기준값 + 보정 유지, 중심만 바로잡는다).
            if (refType !== "keyring") refRadiusPx = refined.radiusPx;
          }
        }
      } catch { /* 픽셀 접근 실패 시 AI 원본 + 보정 유지 */ }

      const diameterPx = 2 * refRadiusPx;
      if (!(diameterPx > 0)) throw new Error("scan-unreliable");

      const ballObj = {
        found: true,
        centerX: refCenterX,
        centerY: refCenterY,
        diameterPx,
        // 표시용 지름도 측정 스케일과 동일한 반지름 기준 — 화면의 원이 곧 40mm 기준임을 보장한다
        drawDiameterPx: diameterPx,
        mmPerPixel: 40 / diameterPx, // 입낚볼·입낚키링 실지름 40mm
        confidence: data.confidence,
        method: "ai-scan",
      };
      const headP: Point = { x: data.head.x * work.width, y: data.head.y * work.height };
      const tailP: Point = { x: data.tail.x * work.width, y: data.tail.y * work.height };
      // 몸통 최대 너비 (선택 — 감지 실패 시 null, 무게는 길이 공식으로 폴백)
      const widthP =
        data.width?.top && data.width?.bottom
          ? {
              top: { x: data.width.top.x * work.width, y: data.width.top.y * work.height },
              bottom: { x: data.width.bottom.x * work.width, y: data.width.bottom.y * work.height },
            }
          : null;

      // 기준물까지 인식됨 → 윤슬 한 바퀴 후 결과 확정 (길이·너비 계산은 result useEffect가 처리)
      pendingScanRef.current = { ball: ballObj, head: headP, tail: tailP, width: widthP };
      setPhase("SHIMMER");
    } catch {
      // 어떤 실패든 안내 후 선택 화면으로 복귀
      scanFailToChoice();
    } finally {
      // 하드 타임아웃 타이머만 정리한다. 실패 폴백(scanFailToChoice)이 catch에서
      // scanTimerRef에 '2초 후 선택 화면 복귀' 타이머를 새로 걸어두므로, 그 타이머까지
      // null 처리하지 않도록 이 로컬 timeoutId 기준으로만 정리한다.
      clearTimeout(timeoutId);
      if (scanTimerRef.current === timeoutId) scanTimerRef.current = null;
      scanAbortRef.current = null;
    }
  }

  /* ── 윤슬 한 바퀴 완료 → 인식 결과를 화면에 반영 ── */
  function applyPendingScan() {
    const p = pendingScanRef.current;
    pendingScanRef.current = null;
    if (!p) { setPhase("CHOICE"); return; }
    setBall(p.ball);
    setHead(p.head);
    setTail(p.tail);
    setWidthPts(p.width);
    setPhase("RESULT");
  }

  /* ── 자동 스캔 실패 → 안내 후 2초 뒤 선택 화면 복귀 ── */
  function scanFailToChoice(msg?: string) {
    // 기본 안내는 기준물 종류에 맞춘다.
    //   볼: 어느 자세로 들고 찍어도 되므로 "눕히라"고 안내하면 안 된다 — 함께 잘 보이는지만 확인.
    //   키링: 평면 디스크라 눕힌 물고기 + 바닥에 놓인 키링이 필요하다.
    const fallbackMsg =
      refType === "keyring"
        ? "자동 측정이 어려운 사진이에요. 물고기를 옆으로 눕히고 입낚키링과 함께 다시 촬영해 주세요."
        : "자동 측정이 어려운 사진이에요. 볼과 물고기가 함께 잘 보이는지 확인 후 다시 시도해 주세요.";
    setScanFailMsg(msg ?? fallbackMsg);
    setPhase("SCAN_FAILED");
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(() => {
      setScanFailMsg(null);
      setPhase("CHOICE");
    }, 2000);
  }

  /* ── 실시간 AI 스캐너 "측정하기" 확정 → 기존 결과 파이프라인 재사용 ──
     autoScan 성공 경로와 동일하게 ball/head/tail 설정 후 RESULT 진입
     (길이 계산은 result useEffect가 처리) ── */
  function handleLiveScanConfirm(res: LiveScanResult) {
    setErrorMsg(null);
    setScanFailMsg(null);
    setResult(null);
    workCanvasRef.current = res.work;
    setHasImage(true);
    setBall(res.ball);
    setHead(res.head);
    setTail(res.tail);
    setWidthPts(res.width ?? null);
    // 스캐너 결과 패널에서 선택한 어종 승계 (대회 모드는 어종 고정이라 무시)
    if (res.species && !tournamentSpecies) setSpecies(res.species);
    setLiveScanOpen(false);
    setPhase("RESULT");
  }

  /* ── 측정값 계산 ── */
  useEffect(() => {
    if (!head || !tail) { setResult(null); return; }
    if (!ball) {
      // 볼 없음 — 길이 계산 불가 (자동 스캔은 항상 볼을 요구하므로 방어적 처리)
      setResult({ lengthCm: null, widthCm: null, weightG: null, grade: { label: "사진 기록", color: "#888", grade: "N/A" }, legal: null });
      return;
    }
    const eng = engines();
    const lengthCm = eng.calc.calculateLength(head, tail, ball.mmPerPixel);
    // 너비를 감지했으면 둘레(G = 너비 × π × 계수) 기반 공식, 아니면 기존 a × L^b 폴백
    const widthCm = widthPts ? eng.calc.calculateWidth(widthPts.top, widthPts.bottom, ball.mmPerPixel) : null;
    const byWidth = widthCm != null ? estimateWeightByWidth(lengthCm, widthCm, species) : null;
    const weightG = byWidth ?? eng.calc.estimateWeight(lengthCm, species);
    const grade = eng.calc.getConfidenceGrade(ball.confidence, ball.method);
    const legal = eng.calc.checkLegalSize(lengthCm, species);
    setResult({
      lengthCm,
      widthCm: byWidth != null ? widthCm : null, // 무게에 반영되지 않은 비정상 너비는 표시하지 않음
      weightG,
      weightMethod: byWidth != null ? "girth" : "length",
      grade,
      legal,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ball, head, tail, widthPts, species]);

  /* ── 어종 자동 인식용 사진 준비 (결과 화면 진입 시 1회) ──
     원본 대신 640px 축소본을 쓴다 (전송량·AI 비용 절감). 실패해도 계측 흐름에는 영향 없음. */
  useEffect(() => {
    if (phase !== "RESULT") return;
    const work = workCanvasRef.current;
    if (!work) return;
    try {
      const s = Math.min(1, 640 / Math.max(work.width, work.height));
      const c = document.createElement("canvas");
      c.width = Math.round(work.width * s);
      c.height = Math.round(work.height * s);
      c.getContext("2d")!.drawImage(work, 0, 0, c.width, c.height);
      setSpeciesImageUrl(c.toDataURL("image/jpeg", 0.7));
    } catch {
      setSpeciesImageUrl(null);
    }
  }, [phase]);

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
      widthPoints: result?.widthCm != null ? widthPts : null,
      selectedSpecies: species,
      isMockMode: false,
    });
  }, [hasImage, ball, result, head, tail, widthPts, species, phase]);

  /* ── 캔버스 탭: 결과 화면에서 AI가 잡은 머리/꼬리 점 미세조정 ── */
  function onCanvasTap(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (phase !== "RESULT" || !head || !tail) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const p = { x, y };

    const dHead = Math.hypot(p.x - head.x, p.y - head.y);
    const dTail = Math.hypot(p.x - tail.x, p.y - tail.y);

    // widthPts가 있으면 폭 끝점 거리도 비교 — 더 가까운 점을 이동
    if (widthPts) {
      const dWTop = Math.hypot(p.x - widthPts.top.x, p.y - widthPts.top.y);
      const dWBot = Math.hypot(p.x - widthPts.bottom.x, p.y - widthPts.bottom.y);
      const minWidth = Math.min(dWTop, dWBot);
      const minHeadTail = Math.min(dHead, dTail);

      if (minWidth < minHeadTail) {
        // 폭 끝점이 더 가까움
        if (dWTop <= dWBot) setWidthPts({ ...widthPts, top: p });
        else setWidthPts({ ...widthPts, bottom: p });
        return;
      }
    }

    if (dHead <= dTail) setHead(p);
    else setTail(p);
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

      // 이미지를 먼저 서버에 업로드 (base64 → /api/upload → URL).
      // 로컬 기록에는 가능하면 URL 만 남긴다 — base64 를 그대로 쌓으면 localStorage 5MB 를 금방 넘긴다.
      let uploadedPhotoUrl: string | null = null;
      try {
        const blob = await fetch(imageBase64).then((r) => r.blob());
        const form = new FormData();
        form.append("file", blob, "measure.jpg");
        const up = await fetch("/api/upload", { method: "POST", body: form });
        if (up.ok) {
          const upData = await up.json();
          uploadedPhotoUrl = upData.url ?? null;
        }
      } catch { /* 업로드 실패 시 photoUrl null 로 저장 */ }

      const { id: localId, photoDropped } = await dbService.saveMeasurement({
        lengthCm: result.lengthCm,
        bodyWidth: result.widthCm ?? null,
        weightG: result.weightG,
        speciesKr: species,
        confidence: ball?.confidence ?? 0,
        confidenceGrade: result.grade?.grade ?? null,
        imageUrl: uploadedPhotoUrl,
        imageBase64,
        latitude: tags?.location?.latitude ?? null,
        longitude: tags?.location?.longitude ?? null,
        locationName: tags?.location?.locationName ?? null,
        weather: tags?.weather?.weather ?? null,
        // 기온: 기상청 초단기실황(클라이언트 키) → 없으면 해양 스냅샷 기온으로 폴백
        temperature: tags?.weather?.temperature ?? tags?.tide?.airTemp ?? null,
        tidePhase: tags?.tide?.tidePhase ?? null,
        tideName: tags?.tide?.mulddae ?? null,   // 물때 이름 (예: "7물")
        waterTemp: tags?.tide?.waterTemp ?? null, // 수온(°C) — 해양 관측/Open-Meteo
        ballId: refType === "ball" ? (activeBallId ?? null) : null,
        keyringId: refType === "keyring" ? activeKeyringId ?? null : null,
      });

      setSavedImageBase64(imageBase64);
      toast(MEASURE_ERRORS.SAVE_SUCCESS, "success");
      // 사진만 실패한 경우 — 수치는 저장됐다는 점을 분명히 알린다
      if (!uploadedPhotoUrl) toast("사진 저장에 실패했어요. 수치는 저장됩니다.", "error");
      // photoDropped 토스트는 DatabaseService 가 ipnak:storage-warning CustomEvent 로 발생시키고
      // StorageWarningListener(글로벌)가 수신해 표시한다 — 여기서 중복 노출하지 않는다.
      syncService.syncPendingMeasurements(); // 백그라운드 (서버 준비 전엔 스킵)

      const catchLat = tags?.location?.latitude ?? lastPoint?.lat ?? null;
      const catchLng = tags?.location?.longitude ?? lastPoint?.lng ?? null;

      // 스마트피싱 여부와 무관하게 항상 서버 DB에 저장
      fetch("/api/catch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speciesName: species,
          sizeCm: result?.lengthCm ?? null,
          bodyWidth: result?.widthCm ?? null,
          estimatedWeight: result?.weightG ?? null,
          photoUrl: uploadedPhotoUrl,
          lat: catchLat,
          lng: catchLng,
          tripId: sessionId ?? null,
          shareToFeed: false,
          pointVisibility: "EXACT",
          ballId: refType === "ball" ? (activeBallId ?? null) : null,
          keyringId: refType === "keyring" ? activeKeyringId ?? null : null,
        }),
      })
        // 어장포인트 저장 버튼에 쓸 catch id 확보 (실패해도 무시)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.catchId) return;
          setSpotCatchId(d.catchId as string);
          // 로컬 기록 ↔ 서버 기록 연결 — 계측일지에서 같은 조과가 두 번 보이지 않게 한다
          void dbService.attachServerId(localId, d.catchId as string);
        })
        .catch(() => {}); // 백그라운드 저장 — 실패해도 기록 흐름 중단 없음

      // 어장포인트 자동 입력값 — 위치가 있을 때만 버튼을 띄운다
      setSpotCatchId(null);
      setSpotDraft(
        catchLat != null && catchLng != null
          ? {
              name: tags?.location?.locationName ?? "",
              lat: catchLat,
              lng: catchLng,
              species: species || null,
              photoUrl: uploadedPhotoUrl,
            }
          : null
      );

      // 스마트피싱 기록 중이면 catches에 추가 (워킹 피드 공유 + 피쉬 숫자 표시용)
      if (recStatus === "tracking" || recStatus === "paused") {
        addCatchToRecording({
          photoUrl: uploadedPhotoUrl ?? imageBase64,
          speciesName: species,
          lat: catchLat,
          lng: catchLng,
        });
      }

      setPhase("SAVED");
    } catch (e: any) {
      toast(e?.message || "저장에 실패했어요.", "error");
      setPhase("RESULT");
    }
  }

  /* ── 이미지 저장 — iOS·Android 사진첩 / 데스크톱 다운로드 ── */
  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await engines().overlay.getShareImage(canvas);
    if (!blob) return;
    const fileName = `입낚측정_${result?.lengthCm ?? ""}cm_${new Date().toISOString().slice(0, 10)}.png`;

    // iOS·Android: Web Share API(files) 지원 시 공유 시트로 사진첩 저장
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const file = new File([blob], fileName, { type: "image/png" });
      const canShare = typeof navigator.canShare === "function"
        ? navigator.canShare({ files: [file] })
        : true; // canShare 미지원 브라우저는 share 시도
      if (canShare) {
        try {
          await navigator.share({ files: [file], title: "입낚 측정 결과" });
          return;
        } catch (e: any) {
          if (e?.name === "AbortError") return; // 사용자가 공유 시트 취소
          // 기타 오류 → 앵커 다운로드로 fallback
        }
      }
    }

    // Fallback: 앵커 다운로드 (데스크톱 / Web Share 미지원 환경)
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── 대회 제출 (tournamentId 모드) — 참가비가 차감될 때만 확인 모달을 거친다 ── */
  async function submitToTournament() {
    if (!tournamentId || !result) return;
    setTourSubmitting(true);
    const info = await fetchEntryFeeInfo(tournamentId);
    setTourSubmitting(false);
    if (info?.willCharge) { setFeeConfirm(info); return; }
    await doSubmitToTournament();
  }

  async function doSubmitToTournament() {
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
    // 진행 중인 자동 스캔 중단 (네트워크 요청 + 타이머)
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
    pendingScanRef.current = null;
    setRefMissing(false);
    setPhase("IDLE");
    setHasImage(false);
    setErrorMsg(null);
    setScanFailMsg(null);
    setBall(null);
    setHead(null);
    setTail(null);
    setWidthPts(null);
    setResult(null);
    setSpeciesImageUrl(null);
    setSpotDraft(null);
    setSpotCatchId(null);
    setSpotModalOpen(false);
    workCanvasRef.current = null;
  }

  // 언마운트 시 진행 중인 스캔 정리
  useEffect(() => () => {
    scanAbortRef.current?.abort();
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
  }, []);

  /* ── 자동 스캔 취소 → CHOICE 복귀 ── */
  function cancelScan() {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
    setScanFailMsg(null);
    setPhase("CHOICE");
  }

  /* ── 재촬영: 실시간 AI 스캐너 재시작 ── */
  const retake = useCallback(() => {
    reset();
    setLiveScanOpen(true);
  }, []);

  /* ── AI 카메라 계측 열기: 비로그인이면 로그인 안내, 첫 방문이면 튜토리얼 먼저 ── */
  const TUTORIAL_KEY = "ipnak_ai_tutorial_done";
  const openCamera = useCallback(() => {
    // 볼·키링 서비스가 모두 꺼져 있으면 기준물이 없어 측정할 수 없다.
    if (!anyRefEnabled) return;
    // PC(1024px 이상)에서는 카메라 계측 불가 → 안내 팝업 표시
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setShowPcModal(true);
      return;
    }
    if (!loggedIn) { setLoginModal(true); return; }
    // 연동된 입낚볼·입낚키링이 하나도 없으면 측정 기록을 연결할 기준물이 없다 → 연동 안내
    if (noRefLinked) { setNoLinkModal(true); return; }
    try {
      if (!localStorage.getItem(TUTORIAL_KEY)) {
        setTutorialStep(0);
        setTutorialOpen(true);
        return;
      }
    } catch { /* noop */ }
    setLiveScanOpen(true); // 앱 내 실시간 AI 스캐너 열기
  }, [loggedIn, anyRefEnabled, noRefLinked]);

  /* ── 아이폰 1회성 태그 안내 ──
     태그로 계측 화면에 진입한 아이폰 사용자에게 처음 한 번만 사용법을 알려준다.
     안내가 떠 있는 동안에는 카메라 자동 열기를 미룬다(팝업 뒤에서 카메라가 열리는 것 방지). */
  const [iosTagGuide, setIosTagGuide] = useState(false);
  const iosTagGuideRef = useRef(false);

  useEffect(() => {
    if (!fromTag || !isIOSDevice()) return;
    try {
      if (localStorage.getItem(IOS_TAG_GUIDE_KEY)) return;
    } catch { return; }
    iosTagGuideRef.current = true;
    setIosTagGuide(true);
  }, [fromTag]);

  const closeIosTagGuide = useCallback(() => {
    try { localStorage.setItem(IOS_TAG_GUIDE_KEY, "1"); } catch { /* noop */ }
    iosTagGuideRef.current = false;
    setIosTagGuide(false);
    // 안내를 닫으면 이어서 평소처럼 카메라를 연다 (PC·비로그인·첫 튜토리얼은 openCamera 가 처리)
    openCamera();
  }, [openCamera]);

  // autoCamera 모드: 페이지 마운트 즉시 카메라 열기 (대회 제출 플로우에서 단계 줄이기)
  // 또는 일반 진입 시에도 모바일이면 자동 카메라 열기
  // (볼·키링 스위치를 확인한 뒤 실행 — 둘 다 꺼져 있으면 열지 않는다)
  useEffect(() => {
    // 연동 조회(linksLoaded)까지 기다린다 — 연동 여부를 모른 채 카메라를 열면
    // 미연동 안내가 카메라 뒤에 가려진다.
    if (!flagsLoaded || !anyRefEnabled || !linksLoaded) return;
    const t = setTimeout(() => {
      // 아이폰 태그 안내가 떠 있으면 안내를 닫은 뒤에 연다
      if (iosTagGuideRef.current) return;
      // 로그인 사용자인데 연동된 기준물이 없으면 카메라 대신 연동 안내를 띄운다.
      // (비로그인은 애초에 연동 정보를 조회할 수 없으므로 기존 흐름을 그대로 둔다)
      if (loggedIn && noRefLinked) { setNoLinkModal(true); return; }
      // autoCamera 파라미터가 있으면 무조건 열기 (대회 모드)
      if (autoCamera) { setLiveScanOpen(true); return; }
      // 모바일 진입 시 자동으로 AI 카메라 열기 (비로그인이면 IDLE에서 클릭 유도)
      if (!loggedIn) return;
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (!isMobile) return;
      try {
        if (!localStorage.getItem(TUTORIAL_KEY)) {
          setTutorialStep(0);
          setTutorialOpen(true);
          return;
        }
      } catch { /* noop */ }
      setLiveScanOpen(true);
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagsLoaded, anyRefEnabled, linksLoaded, noRefLinked]);

  const [diaryOpen, setDiaryOpen] = useState(false);
  const [showGallerySheet, setShowGallerySheet] = useState(false); // 갤러리 선택 커스텀 바텀시트
  const [showPcModal, setShowPcModal] = useState(false); // PC 미지원 안내 팝업

  const showCanvas = hasImage && phase !== "IDLE";
  const busy = phase === "ANALYZING" || phase === "SCANNING" || phase === "SAVING";

  return (
    <>
    {/* ── 세로 고정 wrapper: 브라우저 가로 시 -90deg 반대 회전으로 항상 세로 표시 ── */}
    <div
      style={browserLandscape ? {
        position: "fixed",
        width: "100dvh",
        height: "100vw",
        top: "calc(50dvh - 50vw)",
        left: "calc(50vw - 50dvh)",
        transform: "rotate(-90deg)",
        zIndex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "#0d1b2a",
      } : {}}
    >
    <div className={showCanvas ? "pb-2" : "pb-10"}>
      <LoginRequiredModal open={loginModal} onClose={() => setLoginModal(false)} feature="AI 측정 기능" />

      {/* ── PC 미지원 안내 팝업 ── */}
      {showPcModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
          onClick={() => setShowPcModal(false)}
        >
          <div
            className="w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1b2a] shadow-2xl shadow-black/70"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 그라디언트 배너 */}
            <div className="relative flex flex-col items-center bg-gradient-to-b from-[#0f2540] to-[#0d1b2a] px-6 pb-6 pt-8">
              {/* 아이콘 배지 */}
              <div className="relative mb-4">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border border-white/10 bg-white/5 ring-4 ring-white/5">
                  <Camera size={30} strokeWidth={1.4} className="text-navy-300" />
                </div>
                <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/40 ring-2 ring-[#0d1b2a]">
                  <Smartphone size={14} strokeWidth={2.2} className="text-white" />
                </span>
              </div>

              <h3 className="text-[17px] font-extrabold tracking-tight text-white">
                PC에서는 지원되지 않아요
              </h3>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-navy-400">
                AI 카메라 계측은 카메라가 있는{" "}
                <span className="font-semibold text-aqua-300">모바일 기기</span>
                에서만<br />이용할 수 있어요.
              </p>

              {/* 구분선 + 힌트 */}
              <div className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-aqua-500/20 bg-aqua-500/8 px-3.5 py-2.5">
                <QrCode size={16} strokeWidth={1.7} className="shrink-0 text-aqua-400" />
                <p className="text-[12px] text-aqua-300/80">
                  갤러리 사진 업로드는 PC에서도 이용 가능합니다.
                </p>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex flex-col gap-2 border-t border-white/5 px-6 pb-6 pt-4">
              <a
                href="/landing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-3 text-[14px] font-bold text-gray-900 shadow-md shadow-orange-500/30 transition-all hover:bg-orange-600 active:scale-[0.97]"
              >
                <Smartphone size={15} strokeWidth={2} />
                모바일 앱으로 이용하기
              </a>
              <button
                type="button"
                onClick={() => setShowPcModal(false)}
                className="flex w-full items-center justify-center rounded-[14px] border border-white/10 py-3 text-[14px] font-medium text-navy-400 transition-all hover:border-white/20 hover:text-navy-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── 입낚볼·입낚키링 미연동 안내 팝업 ──
          연동된 기준물이 없으면 측정 기록을 볼·키링에 연결할 수 없어 카메라 대신 안내를 띄운다. */}
      {noLinkModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
          onClick={() => setNoLinkModal(false)}
        >
          <div
            className="w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1b2a] shadow-2xl shadow-black/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex flex-col items-center bg-gradient-to-b from-[#0f2540] to-[#0d1b2a] px-6 pb-6 pt-8">
              <div className="relative mb-4">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border border-white/10 bg-white/5 ring-4 ring-white/5">
                  <CircleDashed size={30} strokeWidth={1.4} className="text-navy-300" />
                </div>
                <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/40 ring-2 ring-[#0d1b2a]">
                  <Nfc size={14} strokeWidth={2.2} className="text-white" />
                </span>
              </div>

              <h3 className="text-[17px] font-extrabold tracking-tight text-white">
                연동된 입낚볼이 없습니다
              </h3>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-navy-400">
                입낚볼 또는 입낚 키링을<br />NFC 태그로 연동해 주세요.
              </p>

              <div className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-aqua-500/20 bg-aqua-500/8 px-3.5 py-2.5">
                <KeyRound size={16} strokeWidth={1.7} className="shrink-0 text-aqua-400" />
                <p className="text-[12px] text-aqua-300/80">
                  휴대폰 뒷면을 입낚볼·키링에 가까이 대면 연동됩니다.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-white/5 px-6 pb-6 pt-4">
              <button
                type="button"
                onClick={() => setNoLinkModal(false)}
                className="flex w-full items-center justify-center rounded-[14px] border border-white/10 py-3 text-[14px] font-medium text-navy-400 transition-all hover:border-white/20 hover:text-navy-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      <PageHeader
        title="AI 측정"
        back
        // 측정 진행 중이면 페이지를 벗어나지 않고 초기 상태(사진 선택 전)로 리셋.
        // 이미 IDLE(사진 선택 전)이면 그때만 이전 페이지로 나간다.
        onBack={() => {
          if (phase !== "IDLE") { reset(); return; }
          if (window.history.length > 1) router.back(); else router.replace("/home");
        }}
        sub="입낚볼 기준 물고기 자동 계측"
        right={
          <button
            type="button"
            onClick={() => setDiaryOpen(true)}
            className="mr-1 flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-[12px] font-semibold text-navy-600 transition-colors hover:bg-navy-100"
          >
            <BookOpen size={15} strokeWidth={1.9} />
            계측일지
          </button>
        }
      />

      {/* 갤러리 파일 입력 */}
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />
      {/* 네이티브 카메라 앱 입력 */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />

      <div className={showCanvas ? "space-y-2 px-3 py-2" : "space-y-2 px-4 pt-2 pb-4"}>
        {/* ── IDLE: 안내 + 촬영 버튼 ── */}
        {phase === "IDLE" && (
          <>
            {/* 스마트피싱(기록 중)에서 진입한 경우 복귀 안내 */}
            {fromFishing && (
              <div className="flex items-center gap-2 rounded-xl border border-aqua-500/30 bg-aqua-500/10 px-3 py-2">
                <MapIcon size={15} strokeWidth={1.9} className="shrink-0 text-aqua-400" />
                <p className="text-[12px] font-medium text-aqua-300">스마트피싱 기록 중 — 측정 후 뒤로가면 기록 화면으로 돌아가요.</p>
              </div>
            )}

            {/* NFC 태그로 진입한 경우 — 어떤 볼·키링이 선택됐는지 알려준다 */}
            {fromTag && (tagBallId || tagKeyringId) && (
              <div className="flex items-center gap-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5">
                {tagKeyringId ? (
                  <KeyRound size={15} strokeWidth={1.9} className="shrink-0 text-orange-400" />
                ) : (
                  <CircleDashed size={15} strokeWidth={1.9} className="shrink-0 text-orange-400" />
                )}
                <p className="min-w-0 text-[12px] font-medium text-orange-200">
                  {tagKeyringId ? "입낚키링" : "입낚볼"}{" "}
                  <span className="font-mono font-bold">{tagKeyringId ?? tagBallId}</span> 선택됨 — 바로 측정할 수 있어요
                </p>
              </div>
            )}

            {/* 안내 카드 */}
            <div className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-surface-200 px-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                <ScanLine size={20} strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-navy-900">
                  {refType === "keyring" ? "입낚키링" : "입낚볼"} 기준 AI 자동 계측
                </p>
                <p className="text-[12px] text-navy-400">
                  {refType === "keyring"
                    ? "물고기를 옆으로 눕혀 입낚키링과 함께 촬영하세요"
                    : "입낚볼과 물고기를 함께 촬영하세요 (들고 찍어도 돼요)"}
                </p>
              </div>
            </div>

            {/* ── 측정 모드 선택 (기준물 종류) — 스위치가 켜진 상품만 노출 ── */}
            {anyRefEnabled && (
              <div className="rounded-2xl border border-navy-100 bg-surface-200 p-2.5">
                <p className="mb-2 px-1 text-[11px] font-bold text-navy-400">측정 기준물 선택</p>
                <div className="flex gap-2">
                  {ballEnabled && (
                    <button
                      type="button"
                      onClick={() => setRefType("ball")}
                      className={
                        "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-bold transition-colors " +
                        (refType === "ball"
                          ? "border-orange-500 bg-orange-500 text-gray-900"
                          : "border-navy-100 text-navy-400 hover:text-navy-600")
                      }
                    >
                      <CircleDashed size={15} strokeWidth={2} />
                      입낚볼
                    </button>
                  )}
                  {keyringEnabled && (
                    <button
                      type="button"
                      onClick={() => setRefType("keyring")}
                      className={
                        "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-bold transition-colors " +
                        (refType === "keyring"
                          ? "border-orange-500 bg-orange-500 text-gray-900"
                          : "border-navy-100 text-navy-400 hover:text-navy-600")
                      }
                    >
                      <KeyRound size={15} strokeWidth={2} />
                      입낚키링
                    </button>
                  )}
                </div>
                {refType === "keyring" && (
                  <div className="mt-2 flex gap-2 rounded-xl bg-aqua-500/10 px-3 py-2.5">
                    <KeyRound size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 text-aqua-400" />
                    <p className="text-[12px] leading-relaxed text-aqua-200">
                      키링을 평평한 바닥에 내려놓고 카메라를 바로 위에서 수직으로 찍어주세요
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* AI 카메라 계측 + 갤러리 선택 — 기준물 서비스가 모두 꺼져 있으면 측정 불가 */}
            {anyRefEnabled ? (
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
                  onClick={() => { if (!loggedIn) { setLoginModal(true); return; } setShowGallerySheet(true); }}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-navy-200 py-6 text-navy-400 transition-colors hover:border-aqua-400 hover:text-aqua-400 active:scale-[0.98]"
                >
                  <Images size={26} strokeWidth={1.7} />
                  <span className="text-[13px] font-bold">갤러리 선택</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-navy-100 bg-surface-200 px-4 py-8 text-center">
                <p className="text-[13px] font-semibold text-navy-500">AI 측정 서비스 준비 중이에요</p>
                <p className="mt-1 text-[12px] text-navy-400">입낚볼·입낚키링 서비스가 모두 중지되어 있어 측정할 수 없습니다.</p>
              </div>
            )}

            {/* 입낚볼 / 입낚키링 연동 — 탭으로 분리해 고른 쪽 내용만 보여준다.
                서비스 스위치가 꺼진 상품은 탭 자체를 노출하지 않고,
                둘 중 하나만 켜져 있으면 탭 바 없이 그 상품 카드만 그린다. */}
            {anyRefEnabled && (
              <div className="space-y-2">
                {ballEnabled && keyringEnabled && (
                  <div className="flex gap-2 rounded-2xl border border-navy-100 bg-surface-200 p-2">
                    <button
                      type="button"
                      onClick={() => { linkTabAutoRef.current = true; setLinkTab("ball"); }}
                      aria-pressed={activeLinkTab === "ball"}
                      className={
                        "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-bold transition-colors " +
                        (activeLinkTab === "ball"
                          ? "border-orange-500 bg-orange-500 text-gray-900"
                          : "border-navy-100 text-navy-400 hover:text-navy-600")
                      }
                    >
                      <CircleDashed size={15} strokeWidth={2} />
                      입낚볼
                    </button>
                    <button
                      type="button"
                      onClick={() => { linkTabAutoRef.current = true; setLinkTab("keyring"); }}
                      aria-pressed={activeLinkTab === "keyring"}
                      className={
                        "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-bold transition-colors " +
                        (activeLinkTab === "keyring"
                          ? "border-orange-500 bg-orange-500 text-gray-900"
                          : "border-navy-100 text-navy-400 hover:text-navy-600")
                      }
                    >
                      <KeyRound size={15} strokeWidth={2} />
                      입낚키링
                    </button>
                  </div>
                )}

                {activeLinkTab === "ball" ? (
                  <BallLinkSection
                    ballEnabled={ballEnabled}
                    keyringEnabled={keyringEnabled}
                    onUnlinked={() => setActiveBallId(null)}
                  />
                ) : (
                  <KeyringLinkSection
                    ballEnabled={ballEnabled}
                    keyringEnabled={keyringEnabled}
                    onUnlinked={() => setActiveKeyringId(null)}
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* ── 측정 캔버스 ── */}
        {showCanvas && (
          <div className="relative overflow-hidden rounded-card ring-1 ring-navy-100">
            <canvas
              ref={canvasRef}
              onPointerDown={onCanvasTap}
              className="block touch-none select-none"
              style={{ width: "100%", height: "auto", maxHeight: phase === "SAVED" ? "26vh" : "55vh" }}
            />
            {/* 자동 스캔 중: 물고기 윤곽선 반짝임 애니메이션 (측정 완료 시 자동 종료) */}
            {phase === "SCANNING" && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-black/35" />
                {/* 캡처 프레임에서 실제 물고기 윤곽을 추출해 그 위에 반짝임 표시
                    (canvas 는 컨테이너를 그대로 채우므로 fit=fill 로 좌표 정합) */}
                <FishScanGlow
                  active
                  sourceRef={canvasRef}
                  objectFit="fill"
                  label={loadingMsg || "스캔 중..."}
                />
              </>
            )}
            {/* 인식 성공 → 윤슬(빛 포인트)이 물고기 외곽을 한 바퀴 돈 뒤 결과 확정 */}
            {phase === "SHIMMER" && (
              <FishShimmer
                active
                sourceRef={canvasRef}
                objectFit="fill"
                durationMs={SHIMMER_MS}
                onComplete={applyPendingScan}
              />
            )}
            {busy && phase !== "SCANNING" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-[2px]">
                <Loader2 className="animate-spin text-orange-400" size={30} />
                <p className="px-6 text-center text-[13px] font-medium text-white">
                  {phase === "SAVING" ? "위치·날씨 태그 수집 후 저장 중..." : loadingMsg}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── 자동 스캔 취소 버튼 ── */}
        {phase === "SCANNING" && (
          <button
            type="button"
            onClick={cancelScan}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-navy-200 py-3 text-[13px] font-semibold text-navy-400 transition-colors hover:border-navy-300 hover:text-navy-500 active:scale-[0.98]"
          >
            <X size={15} strokeWidth={2} />
            취소
          </button>
        )}

        {/* ── 측정 방식 선택 (자동 스캔 / 수동 점찍기) ── */}
        {phase === "CHOICE" && (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 rounded-2xl border border-navy-100 bg-surface-200 px-3 py-2.5">
              <Fish size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 text-aqua-400" />
              <p className="text-[12px] leading-relaxed text-navy-500">
                {refType === "keyring"
                  ? "물고기를 바닥에 옆으로 눕히고, 입낚키링도 바닥에 평평하게 놓아 위에서 수직으로 찍으면 자동 측정이 가능해요."
                  : "입낚볼은 어느 각도에서도 동그랗게 보여서, 바닥에 눕혀 찍든 손에 들고 찍든 자동 측정이 가능해요. 볼과 물고기만 비슷한 거리에서 함께 잘 보이면 돼요."}
              </p>
            </div>

            <button
              type="button"
              onClick={autoScan}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-orange-500/50 bg-orange-500/5 px-4 py-3.5 text-left transition-colors hover:bg-orange-500/10 active:scale-[0.98]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                <ScanLine size={20} strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-navy-900">자동 스캔으로 측정</span>
                <span className="block text-[11px] text-navy-400">물고기가 옆으로 눕혀진 사진에 추천</span>
              </span>
              <ChevronRight size={18} className="ml-auto shrink-0 text-navy-300" />
            </button>

            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={reset}
                aria-label="닫기"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50/60 text-navy-400 transition-all hover:bg-navy-100/80 hover:text-navy-600 active:scale-[0.93]"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}

        {/* ── 자동 스캔 실패 안내 (2초 후 자동으로 수동 전환) ── */}
        {phase === "SCAN_FAILED" && scanFailMsg && (
          <div className="flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5">
            <AlertTriangle size={16} strokeWidth={1.9} className="shrink-0 text-orange-400" />
            <p className="text-[13px] font-medium text-orange-300">{scanFailMsg}</p>
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
              <Button size="sm" onClick={() => setLiveScanOpen(true)} leftIcon={<Camera size={15} />}>AI 카메라 재촬영</Button>
              <Button size="sm" variant="outline" onClick={() => galleryInputRef.current?.click()} leftIcon={<Images size={15} />}>
                갤러리 선택
              </Button>
            </div>
          </div>
        )}

        {/* ── 어종 자동 인식 (AI) ──
            대회 모드(?species=)는 어종이 정해져 있으므로 노출하지 않는다. */}
        {phase === "RESULT" && !tournamentSpecies && speciesImageUrl && (
          <SpeciesIdentifySection
            imageUrl={speciesImageUrl}
            currentSpecies={species}
            onApply={setSpecies}
          />
        )}

        {/* ── 어종 선택 + 결과 ── */}
        {(phase === "RESULT" || phase === "SAVING") && (
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
                <div className="flex items-end gap-4">
                  {result.widthCm != null && (
                    <div className="text-right">
                      <p className="text-[12px] text-navy-400">몸통 너비</p>
                      <p className="text-[18px] font-bold text-aqua-500">{result.widthCm}cm</p>
                    </div>
                  )}
                  {result.weightG != null && (
                    <div className="text-right">
                      <p className="text-[12px] text-navy-400">추정 무게</p>
                      <p className="text-[18px] font-bold text-navy-800">약 {result.weightG}g</p>
                    </div>
                  )}
                </div>
              </div>
              {result.weightG != null && (
                <p className="mt-2 text-[11px] text-navy-400">
                  {result.weightMethod === "girth"
                    ? "무게 산출: 전장 + 몸통 둘레 기반 (정밀)"
                    : "무게 산출: 전장 기반 추정 — 너비 미감지"}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-navy-100 pt-3">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ color: result.grade.color, backgroundColor: `${result.grade.color}22` }}
                >
                  {result.grade.label}
                </span>
                {result.lengthCm != null ? (
                  <p className="text-[11px] text-navy-300">
                    기준: {ball?.method === "aruco" ? "ArUco 마커 20mm" : refType === "keyring" ? "입낚키링 40mm" : "입낚볼 40mm"} · 점 탭으로 미세조정 가능
                  </p>
                ) : (
                  <p className="text-[11px] text-navy-400">입낚볼 연동 시 정확한 길이 측정 가능</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" onClick={retake} leftIcon={<RefreshCcw size={15} />}>재촬영</Button>
              <Button variant="outline" size="sm" onClick={handleDownload} leftIcon={<Download size={15} />}>이미지</Button>
              <Button size="sm" onClick={handleSave} leftIcon={<Save size={15} />}>저장</Button>
              <Button variant="outline" size="sm" onClick={reset} leftIcon={<X size={15} />}>닫기</Button>
            </div>
          </>
        )}

        {/* ── 저장 완료 화면은 아래 전체화면 오버레이(portal)로 표시 ── */}
      </div>

      {/* ── 어장포인트 저장 모달 (기존 저장 흐름과 독립) ── */}
      <FishingSpotSaveModal
        open={spotModalOpen}
        onClose={() => setSpotModalOpen(false)}
        initial={spotDraft}
        sourceType="ai"
        sourceCatchId={spotCatchId}
      />

      {/* ── 아이폰 태그 사용법 1회성 안내 (태그로 진입한 아이폰 사용자 한정) ── */}
      <IphoneTagGuideModal open={iosTagGuide} onClose={closeIosTagGuide} />

      {/* ── 첫 방문 튜토리얼 오버레이 ── */}
      {tutorialOpen && (
        <AiMeasureTutorial
          step={tutorialStep}
          onNext={() => {
            if (tutorialStep < TUTORIAL_STEPS.length - 1) {
              setTutorialStep((s) => s + 1);
            } else {
              // 마지막 단계: "카메라 촬영" 버튼 → 실시간 AI 스캐너 열기
              try { localStorage.setItem("ipnak_ai_tutorial_done", "1"); } catch { /* noop */ }
              setTutorialOpen(false);
              setTimeout(() => setLiveScanOpen(true), 100);
            }
          }}
          onSkip={() => {
            try { localStorage.setItem("ipnak_ai_tutorial_done", "1"); } catch { /* noop */ }
            setTutorialOpen(false);
            setTimeout(() => setLiveScanOpen(true), 100);
          }}
        />
      )}

      {/* LiveScanCamera는 아래 portal로 이동 (세로 고정 wrapper 밖에서 독립 렌더) */}

      {/* ── 갤러리 선택 커스텀 바텀시트 (네이티브 iOS 팝업 대체) ── */}
      {showGallerySheet && createPortal(
        <div
          className="fixed inset-0 z-[9000] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          onClick={() => setShowGallerySheet(false)}
        >
          <div
            className="w-full max-w-[480px] overflow-hidden rounded-t-[28px] shadow-2xl ring-1 ring-white/[0.08]"
            style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#132233 60%,#1a2a3a 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 노랑 라인 */}
            <div className="h-[2.5px] w-full bg-gradient-to-r from-orange-700/30 via-orange-400/90 to-orange-700/30" />
            {/* 드래그 핸들 */}
            <div className="mx-auto mt-3.5 h-1 w-10 rounded-full bg-white/[0.14]" />

            {/* 헤더 */}
            <div className="px-6 pb-4 pt-5">
              <p className="text-[18px] font-extrabold tracking-tight text-white">사진 가져오기</p>
              <p className="mt-1 text-[12px] text-white/40">측정할 물고기 사진을 선택해 주세요</p>
            </div>

            {/* 옵션 */}
            <div className="space-y-2 px-4 pb-4">
              {/* 사진 라이브러리 */}
              <button
                type="button"
                onClick={() => { galleryInputRef.current?.click(); setShowGallerySheet(false); }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 ring-white/[0.09] transition-colors active:bg-white/[0.09]"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                  <Images size={20} strokeWidth={1.8} className="text-orange-400" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-white">사진 라이브러리</span>
                  <span className="block text-[11px] text-white/40">갤러리에서 사진 선택</span>
                </span>
                <ChevronRight size={16} strokeWidth={2} className="ml-auto shrink-0 text-white/25" />
              </button>

              {/* 파일에서 선택 */}
              <button
                type="button"
                onClick={() => { galleryInputRef.current?.click(); setShowGallerySheet(false); }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 ring-white/[0.09] transition-colors active:bg-white/[0.09]"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                  <FolderOpen size={20} strokeWidth={1.8} className="text-white/60" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-white">파일에서 선택</span>
                  <span className="block text-[11px] text-white/40">Google Drive, iCloud 등</span>
                </span>
                <ChevronRight size={16} strokeWidth={2} className="ml-auto shrink-0 text-white/25" />
              </button>
            </div>

            {/* 취소 */}
            <div className="px-4 pb-10 pt-1">
              <button
                type="button"
                onClick={() => setShowGallerySheet(false)}
                className="w-full rounded-2xl py-3 text-[14px] font-semibold text-white/35 transition-colors active:text-white/65"
              >
                취소
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 기준물 미감지 안내 (갤러리 사진) ──
          '확인' 시 사진을 버리고 선택 화면(IDLE)으로 복귀 */}
      {refMissing && createPortal(
        <div className="fixed inset-0 z-[9100] flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-[340px] overflow-hidden rounded-[24px] shadow-2xl ring-1 ring-white/[0.09]"
            style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#132233 60%,#1a2a3a 100%)" }}
          >
            <div className="h-[2.5px] w-full bg-gradient-to-r from-orange-700/30 via-orange-400/90 to-orange-700/30" />
            <div className="flex flex-col items-center px-6 pb-5 pt-7">
              <div className="mb-4 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-orange-500/15 ring-1 ring-orange-500/25">
                <AlertTriangle size={30} strokeWidth={1.6} className="text-orange-400" />
              </div>
              <p className="text-[17px] font-extrabold tracking-tight text-white">측정할 수 없는 사진이에요</p>
              <p className="mt-2.5 text-center text-[13px] leading-relaxed text-white/50">
                기준물(입낚볼·입낚키링)이 없는 사진은<br />측정할 수 없습니다.
              </p>
            </div>
            <div className="px-4 pb-6 pt-1">
              <button
                type="button"
                onClick={() => { setRefMissing(false); reset(); }}
                className="w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-gray-900 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
              >
                확인
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 계측일지 바텀시트 ── */}
      <DiarySheet open={diaryOpen} onClose={() => setDiaryOpen(false)} />

      {/* ── 대회 참가비 차감 확인 ── */}
      <ConfirmDialog
        open={!!feeConfirm}
        title={feeConfirm ? entryFeeConfirmText(feeConfirm).title : ""}
        message={feeConfirm ? entryFeeConfirmText(feeConfirm).message : undefined}
        confirmLabel="참가하기"
        cancelLabel="취소"
        onConfirm={() => { setFeeConfirm(null); void doSubmitToTournament(); }}
        onCancel={() => setFeeConfirm(null)}
      />
    </div>
    </div>{/* /portrait-lock wrapper */}

    {/* ── 저장 완료 화면 — 화면 전체를 채우는 오버레이 ──
        상단: 측정선이 그려진 사진 / 중간: 수치 카드 2열 / 하단: 액션 버튼 (화면 하단 고정).
        모달·바텀시트(z-9000 이상)보다 아래에 두어 계측일지·어장포인트 저장이 위로 뜬다. */}
    {phase === "SAVED" && result && typeof window !== "undefined" && createPortal(
      <div
        className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[#0d1b2a]"
        style={{ height: "100dvh" }}
      >
        {/* 상단 바 */}
        <div
          className="flex shrink-0 items-center justify-between px-4 pb-2"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-aqua-500/15 text-aqua-400">
              <ScanLine size={15} strokeWidth={2} />
            </span>
            <p className="truncate text-[15px] font-extrabold tracking-tight text-white">
              {species}{result.lengthCm != null ? ` ${result.lengthCm}cm` : ""} 기록 완료
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            aria-label="닫기"
            className="shrink-0 rounded-full bg-white/8 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* 사진 — 남는 세로 공간을 모두 사용 (측정선 오버레이 포함된 저장 이미지) */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-black/40">
          {savedImageBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={savedImageBase64}
              alt="측정 결과"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-navy-400">
              <Fish size={34} strokeWidth={1.5} />
            </div>
          )}
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-aqua-300 ring-1 ring-aqua-400/30 backdrop-blur-sm">
            계측일지에 저장됨
          </span>
        </div>

        {/* 수치 카드 (2열 그리드) */}
        <div className="grid shrink-0 grid-cols-2 gap-2 px-4 pt-3">
          <SavedStat label="어종" value={species} accent="#ffffff" />
          <SavedStat
            label="전장"
            value={result.lengthCm != null ? `${result.lengthCm} cm` : "—"}
            accent="#eab308"
          />
          <SavedStat
            label="몸통 너비"
            value={result.widthCm != null ? `${result.widthCm} cm` : "—"}
            accent="#06b6d4"
          />
          <SavedStat
            label="추정 무게"
            value={result.weightG != null ? `약 ${result.weightG}g` : "—"}
            accent="#ffffff"
          />
        </div>

        {/* 액션 버튼 — 화면 하단에 붙여 배치 */}
        <div
          className="shrink-0 space-y-2 px-4 pt-3"
          style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom, 0px))" }}
        >
          {/* 대회 참가 모드 */}
          {tournamentId && (
            tourSubmitted ? (
              <div className="flex items-center gap-2 rounded-[14px] bg-orange-500/10 px-4 py-2.5">
                <Trophy size={15} className="shrink-0 text-orange-400" />
                <p className="text-[12.5px] font-semibold text-orange-400">대회 제출 완료 — 심사 후 랭킹에 반영됩니다.</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={submitToTournament}
                disabled={tourSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 py-3 text-[14px] font-bold text-gray-900 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {tourSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                {tourSubmitting ? "제출 중..." : "대회에 제출하기"}
              </button>
            )
          )}

          {/* 어장포인트로 저장 — 측정 위치가 있을 때만 노출 */}
          {spotDraft && (
            <button
              type="button"
              onClick={() => setSpotModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-aqua-400/40 bg-aqua-400/10 py-3 text-[14px] font-bold text-aqua-300 transition-colors active:bg-aqua-400/20"
            >
              <MapPin size={16} strokeWidth={2} />
              어장포인트로 저장
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex items-center justify-center gap-2 rounded-[14px] border border-white/12 py-3 text-[14px] font-bold text-white/80 transition-colors active:bg-white/10"
            >
              <Camera size={16} strokeWidth={2} />
              새 측정
            </button>
            <button
              type="button"
              onClick={() => setDiaryOpen(true)}
              className="flex items-center justify-center gap-2 rounded-[14px] py-3 text-[14px] font-bold text-[#0d1b2a] transition-all active:scale-[0.98]"
              style={{ background: "#eab308" }}
            >
              <BookOpen size={16} strokeWidth={2} />
              계측일지 보기
            </button>
          </div>

          <div className={fromFishing ? "flex gap-2" : ""}>
            {fromFishing && (
              <Link
                href="/map"
                className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-aqua-500 py-3 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
              >
                <MapIcon size={16} strokeWidth={2} />
                스마트피싱으로
              </Link>
            )}
            <button
              type="button"
              onClick={reset}
              className={
                "flex items-center justify-center gap-2 rounded-[14px] py-3 text-[13.5px] font-semibold text-white/45 transition-colors active:text-white/80 " +
                (fromFishing ? "flex-1 border border-white/10" : "w-full")
              }
            >
              <X size={15} strokeWidth={2} />
              닫기
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* ── 실시간 AI 스캐너: 세로 고정 wrapper 밖으로 portal (진짜 풀스크린 보장) ── */}
    {liveScanOpen && typeof window !== "undefined" && createPortal(
      <LiveScanCamera
        onConfirm={handleLiveScanConfirm}
        onClose={() => setLiveScanOpen(false)}
        testBall={true}
        refType={refType}
      />,
      document.body
    )}
    </>
  );
}

/* ─────────────────────────────────────────
   저장 완료 화면 수치 카드 (2열 그리드 셀)
───────────────────────────────────────── */
function SavedStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3.5 py-2.5">
      <p className="text-[11px] font-medium text-navy-400">{label}</p>
      <p
        className="mt-0.5 truncate text-[19px] font-extrabold leading-tight tracking-tight"
        style={{ color: accent }}
      >
        {value}
      </p>
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
    desc: "40mm 입낚볼을 물고기 옆에 놓고 함께 촬영하면\n길이가 자동으로 계산됩니다.",
    hint: "입낚볼 ≈ 40mm",
  },
  {
    icon: <Fish size={36} strokeWidth={1.6} className="text-aqua-400" />,
    title: "물고기를 옆으로 눕혀 주세요",
    desc: "바닥에 물고기를 옆으로 눕히고\n머리부터 꼬리까지 화면에 모두 들어오게 맞춰주세요.\n인식되면 물고기 윤곽선이 반짝입니다.",
    hint: "인식되면 윤곽선 반짝임",
  },
  {
    icon: <ScanLine size={36} strokeWidth={1.6} className="text-aqua-400" />,
    title: "'측정하기'를 누르세요",
    desc: "'물고기 인식됨' 배지가 뜨면\n측정하기 버튼을 눌러 전장(cm)을 확정합니다.\n결과 화면에서 점을 탭해 미세 조정도 가능해요.",
    hint: "인식 완료 → 측정하기",
  },
  {
    icon: <Save size={36} strokeWidth={1.6} className="text-orange-400" />,
    title: "어종 선택 후 저장",
    desc: "길이가 표시되면 어종을 선택하고\n저장 버튼을 누르면 계측일지에 기록됩니다.\n진행 중인 대회에 바로 제출할 수도 있어요.",
    hint: "저장 → 계측일지 / 대회 제출",
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
            className="flex-1 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-gray-900 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
          >
            {isLast ? "카메라 촬영" : "다음"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
