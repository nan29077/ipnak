"use client";
/**
 * 실시간 AI 스캐너 (앱 내 카메라 스트림)
 * - getUserMedia 후면 카메라 라이브 프리뷰
 * - 2초마다 현재 프레임을 캡처 → base64 → /api/measure/scan 폴링
 * - 감지 성공(입낚볼 + 머리/꼬리 + pose=flat + 신뢰도 충분) 시:
 *     캔버스 오버레이(입낚볼 원 + 머리/꼬리 점 + 연결선) + 길이 미리보기 + "측정하기" 활성화
 * - "측정하기": 마지막 성공 프레임 + 감지 좌표를 부모로 넘겨 기존 결과 파이프라인 재사용
 * - "직접 측정": 스트림 종료 → 부모의 수동 점찍기 모드로 전환 (onSwitchToManual)
 * - 권한 거부 등 어떤 에러도 수동 모드로 폴백 가능하도록 설계
 * - 세로/가로 방향 모두 풀스크린. 가로 모드는 우측 세로 사이드바로 UI 재배치
 *
 * ⚠️ 오버레이 정렬을 위해 video / overlay 모두 object-cover 사용 (동일 크롭 → 좌표 일치)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Camera, Loader2, RefreshCw, ScanLine, RotateCw, Check, Ruler } from "lucide-react";
import { hasCameraConsent, setCameraConsent } from "./LiveMeasureCamera";

type Point = { x: number; y: number };
type Norm = { x: number; y: number };
type NormBall = { x: number; y: number; r: number };

/** measure 페이지 autoScan 성공 경로와 동일한 형태의 결과 */
export type LiveScanResult = {
  work: HTMLCanvasElement;
  ball: {
    found: true;
    centerX: number;
    centerY: number;
    diameterPx: number;
    mmPerPixel: number;
    confidence: number;
    method: "ai-scan";
  };
  head: Point;
  tail: Point;
  confidence: number;
};

type Props = {
  onConfirm: (result: LiveScanResult) => void; // "측정하기" — 결과 화면으로
  onSwitchToManual: () => void;                 // "직접 측정" / 권한 거부 — 수동 점찍기 모드로 전환
  onClose: () => void;                          // X — 닫기
};

const POLL_INTERVAL_MS = 2000; // 스캔 폴링 주기
const SCAN_MAX_PX = 1024;      // 전송 프레임 최대 해상도 (속도/정확도 균형)
const REQ_TIMEOUT_MS = 9000;   // 개별 요청 하드 타임아웃
const CONFIDENCE_MIN = 0.7;    // 이 미만이면 실패 처리 (measure 페이지와 동일 기준)

type Cam = "loading" | "ready" | "error";

type Detection = {
  ballN: NormBall;
  headN: Norm;
  tailN: Norm;
  confidence: number;
  lengthCm: number | null;
};

export function LiveScanCamera({ onConfirm, onSwitchToManual, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstScanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScanningRef = useRef(false); // 동시 요청 방지
  const abortRef = useRef<AbortController | null>(null);
  // 마지막 성공 프레임 + 정규화 감지 좌표 (측정하기 확정용)
  const successRef = useRef<{ work: HTMLCanvasElement; det: Detection } | null>(null);

  const [camStatus, setCamStatus] = useState<Cam>("loading");
  const [camError, setCamError] = useState("");
  const [videoHasData, setVideoHasData] = useState(false);
  const [retry, setRetry] = useState(0);
  const [det, setDet] = useState<Detection | null>(null);
  // 브라우저 권한 요청 전 커스텀 안내 팝업 (LiveMeasureCamera 와 동일 UX)
  const [consented, setConsented] = useState(false);
  // 가로/세로 방향
  const [isLandscape, setIsLandscape] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false); // 기본값: 세로 모드
  const [showRotateHint, setShowRotateHint] = useState(false);
  const rotateHintRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── 스트림/폴링 정리 (재사용) ── */
  const cleanupStream = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (firstScanRef.current) { clearTimeout(firstScanRef.current); firstScanRef.current = null; }
    abortRef.current?.abort();
    abortRef.current = null;
    isScanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* ── 마운트 시 권한 상태 확인 → 이미 허용된 경우 커스텀 모달 스킵 ── */
  useEffect(() => {
    if (!hasCameraConsent()) return; // 동의 기록 없음 → 안내 모달 표시
    if (typeof navigator === "undefined") { setConsented(true); return; }
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((r) => { if (r.state === "granted") setConsented(true); })
        .catch(() => setConsented(true));
    } else {
      setConsented(true);
    }
  }, []);

  /* ── 화면 방향 감지 (가로/세로 레이아웃 전환) ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      // 방향 변경 시 우측 패널 상태는 유지 — 사용자가 명시적으로 세로 전환 시에만 변경
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  /* ── 카메라 시작 (LiveMeasureCamera 검증 로직 기반, iOS Safari 대응) ── */
  useEffect(() => {
    if (!consented) return; // 안내 팝업에서 '허용하기' 전에는 getUserMedia 호출 안 함
    let cancelled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let hardId: ReturnType<typeof setTimeout> | null = null;
    setCamStatus("loading");
    setCamError("");
    setVideoHasData(false);

    const clearWatchdog = () => { if (watchdog) { clearTimeout(watchdog); watchdog = null; } };
    const markReady = () => { if (!cancelled) { clearWatchdog(); setCamStatus("ready"); } };
    const markVideoData = () => { if (!cancelled) setVideoHasData(true); };
    const markError = (msg: string) => {
      if (cancelled) return;
      clearWatchdog();
      setCamError(msg);
      setCamStatus("error");
    };

    async function init() {
      if (typeof window === "undefined") return;
      if (!navigator.mediaDevices?.getUserMedia) {
        markError(
          window.isSecureContext
            ? "이 브라우저는 카메라를 지원하지 않아요.\n크롬/사파리 최신 버전으로 열어 주세요."
            : "HTTPS 환경에서만 카메라를 사용할 수 있습니다.\n주소가 https:// 로 시작하는지 확인해 주세요."
        );
        return;
      }

      // 권한 팝업 방치 등 무한 대기 대비 (10초 워치독)
      watchdog = setTimeout(() => {
        if (cancelled) return;
        if (streamRef.current) { markReady(); return; }
        markError("카메라 응답이 없어요.\n권한 요청 창이 떠 있다면 '허용'을 누른 뒤 재시도해 주세요.");
      }, 10000);

      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: { facingMode: "environment" }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      let lastError: unknown = null;
      for (const c of attempts) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; }
        catch (e) { lastError = e; }
      }
      if (!stream) {
        const name = (lastError as DOMException)?.name ?? "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          markError("카메라 권한을 허용해주세요.\n브라우저 주소창 옆 자물쇠 아이콘을 눌러\n카메라를 허용한 뒤 재시도해 주세요.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          markError("카메라 기기를 찾을 수 없어요.");
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          markError("카메라가 다른 앱에서 사용 중이에요.\n다른 앱을 닫고 재시도해 주세요.");
        } else {
          markError("카메라를 시작할 수 없어요.\n권한 확인 후 재시도해 주세요.");
        }
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;

      const attach = () => {
        if (cancelled) return;
        const v = videoRef.current;
        if (!v) { requestAnimationFrame(attach); return; }

        // iOS Safari: React가 muted를 DOM에 반영 못 하는 버그 → srcObject 전에 직접 지정
        v.muted = true;
        v.setAttribute("muted", "");
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.autoplay = true;

        const tryPlay = () => { v.play().catch(() => { /* autoplay policy */ }); };
        const start = () => { if (!cancelled) { tryPlay(); markReady(); } };

        v.onloadedmetadata = start;
        v.oncanplay = tryPlay;
        v.onplaying = () => { markReady(); markVideoData(); };
        v.onloadeddata = () => { if (v.videoWidth > 0) markVideoData(); };
        v.ontimeupdate = () => { if (!cancelled && v.videoWidth > 0) { markReady(); markVideoData(); } };

        v.srcObject = stream;
        const p0 = v.play();
        if (p0) p0.catch(() => {});

        // iOS autoplay 폴백: 재생 상태 확인 및 play() 재시도
        pollId = setInterval(() => {
          if (cancelled || !streamRef.current) { if (pollId) clearInterval(pollId); return; }
          if (v.paused) v.play().catch(() => {});
          if (v.readyState >= 2 && v.videoWidth > 0) {
            if (pollId) { clearInterval(pollId); pollId = null; }
            markReady();
            markVideoData();
          }
        }, 500);

        // 하드 폴백: 1.5초 후 강제 ready
        hardId = setTimeout(() => {
          if (pollId) { clearInterval(pollId); pollId = null; }
          if (!cancelled && streamRef.current) {
            v.play().catch(() => {});
            markReady();
            if (v.readyState >= 2 && v.videoWidth > 0) markVideoData();
          }
        }, 1500);

        if (v.readyState >= 1) start();
        if (v.readyState >= 2 && v.videoWidth > 0) markVideoData();
      };
      attach();
    }

    init().catch(() => markError("카메라를 시작할 수 없어요.\n권한 확인 후 재시도해 주세요."));

    return () => {
      cancelled = true;
      clearWatchdog();
      if (pollId) { clearInterval(pollId); pollId = null; }
      if (hardId) { clearTimeout(hardId); hardId = null; }
      const v = videoRef.current;
      if (v) {
        v.onloadedmetadata = null;
        v.oncanplay = null;
        v.onplaying = null;
        v.onloadeddata = null;
        v.ontimeupdate = null;
        v.srcObject = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [retry, consented]);

  /* ── 언마운트 시 폴링/요청 정리 (스트림은 위 effect가 정리) ── */
  useEffect(() => {
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (firstScanRef.current) { clearTimeout(firstScanRef.current); firstScanRef.current = null; }
      if (rotateHintRef.current) { clearTimeout(rotateHintRef.current); rotateHintRef.current = null; }
      abortRef.current?.abort();
    };
  }, []);

  /* ── 오버레이 렌더 (감지 좌표 → 프리뷰 좌표) ── */
  const drawOverlay = useCallback((d: Detection | null) => {
    const ov = overlayRef.current;
    const v = videoRef.current;
    if (!ov) return;
    const W = v?.videoWidth || ov.width;
    const H = v?.videoHeight || ov.height;
    if (!W || !H) return;
    if (ov.width !== W) ov.width = W;
    if (ov.height !== H) ov.height = H;
    const ctx = ov.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (!d) return;

    const bx = d.ballN.x * W, by = d.ballN.y * H, br = d.ballN.r * W;
    const hx = d.headN.x * W, hy = d.headN.y * H;
    const tx = d.tailN.x * W, ty = d.tailN.y * H;
    const base = Math.max(W, H);

    // 머리-꼬리 연결선
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(34,197,94,0.9)";
    ctx.lineWidth = Math.max(3, base * 0.006);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 입낚볼 원 (오렌지)
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = Math.max(3, br * 0.08);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.stroke();

    // 머리(초록) / 꼬리(청록) 점
    const dot = (x: number, y: number, color: string) => {
      const r = Math.max(6, base * 0.016);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r + Math.max(2, r * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(hx, hy, "#22c55e");
    dot(tx, ty, "#22d3ee");
  }, []);

  useEffect(() => { drawOverlay(det); }, [det, videoHasData, drawOverlay]);

  /* ── 프레임 캡처 → /api/measure/scan 폴링 ── */
  useEffect(() => {
    if (camStatus !== "ready" || !videoHasData) return;
    let stopped = false;

    const runScan = async () => {
      if (stopped || isScanningRef.current) return;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      isScanningRef.current = true;
      try {
        const s = Math.min(1, SCAN_MAX_PX / Math.max(v.videoWidth, v.videoHeight));
        const frame = document.createElement("canvas");
        frame.width = Math.max(1, Math.round(v.videoWidth * s));
        frame.height = Math.max(1, Math.round(v.videoHeight * s));
        frame.getContext("2d")!.drawImage(v, 0, 0, frame.width, frame.height);
        const dataUrl = frame.toDataURL("image/jpeg", 0.8);

        const controller = new AbortController();
        abortRef.current = controller;
        const to = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
        let data: any = null;
        try {
          const res = await fetch("/api/measure/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: dataUrl, width: frame.width, height: frame.height }),
            signal: controller.signal,
          });
          if (res.ok) data = await res.json();
        } finally {
          clearTimeout(to);
          if (abortRef.current === controller) abortRef.current = null;
        }
        if (stopped) return;

        const ok =
          data?.ok &&
          data.ball && data.head && data.tail &&
          data.pose === "flat" &&
          typeof data.confidence === "number" &&
          data.confidence >= CONFIDENCE_MIN &&
          typeof data.ball.r === "number" && data.ball.r > 0;

        if (ok) {
          const w = frame.width, h = frame.height;
          const diameterPx = 2 * data.ball.r * w;
          let lengthCm: number | null = null;
          if (diameterPx > 0) {
            const mmPerPixel = 40 / diameterPx; // 입낚볼 실지름 40mm
            const hx = data.head.x * w, hy = data.head.y * h;
            const tx = data.tail.x * w, ty = data.tail.y * h;
            const px = Math.hypot(tx - hx, ty - hy);
            lengthCm = Math.round((px * mmPerPixel) / 10 * 10) / 10; // cm, 소수 1자리
          }
          const detection: Detection = {
            ballN: { x: data.ball.x, y: data.ball.y, r: data.ball.r },
            headN: { x: data.head.x, y: data.head.y },
            tailN: { x: data.tail.x, y: data.tail.y },
            confidence: data.confidence,
            lengthCm,
          };
          successRef.current = { work: frame, det: detection };
          setDet(detection);
        } else {
          // 실패/인식 안 됨 → 오버레이 제거 (스펙: 카메라 화면만 유지)
          successRef.current = null;
          setDet(null);
        }
      } catch {
        if (!stopped) { successRef.current = null; setDet(null); }
      } finally {
        isScanningRef.current = false;
      }
    };

    firstScanRef.current = setTimeout(runScan, 700); // 첫 스캔은 조금 빨리
    pollRef.current = setInterval(runScan, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (firstScanRef.current) { clearTimeout(firstScanRef.current); firstScanRef.current = null; }
      abortRef.current?.abort();
    };
  }, [camStatus, videoHasData]);

  /* ── "측정하기": 마지막 성공 프레임 확정 → 부모로 ── */
  const confirm = useCallback(() => {
    const s = successRef.current;
    if (!s) return;
    cleanupStream();
    const w = s.work.width, h = s.work.height;
    const diameterPx = 2 * s.det.ballN.r * w;
    if (!(diameterPx > 0)) { onClose(); return; }
    const result: LiveScanResult = {
      work: s.work,
      ball: {
        found: true,
        centerX: s.det.ballN.x * w,
        centerY: s.det.ballN.y * h,
        diameterPx,
        mmPerPixel: 40 / diameterPx,
        confidence: s.det.confidence,
        method: "ai-scan",
      },
      head: { x: s.det.headN.x * w, y: s.det.headN.y * h },
      tail: { x: s.det.tailN.x * w, y: s.det.tailN.y * h },
      confidence: s.det.confidence,
    };
    onConfirm(result);
  }, [cleanupStream, onConfirm, onClose]);

  /* ── "직접 측정" / 권한 거부: 스트림 종료 후 부모의 수동 점찍기 모드로 ── */
  const switchToManual = useCallback(() => {
    cleanupStream();
    onSwitchToManual();
  }, [cleanupStream, onSwitchToManual]);

  /* ── "가로로 촬영하기" 힌트 토스트 ── */
  const triggerRotateHint = useCallback(() => {
    setShowRotateHint(true);
    if (rotateHintRef.current) clearTimeout(rotateHintRef.current);
    rotateHintRef.current = setTimeout(() => setShowRotateHint(false), 2000);
  }, []);

  const canConfirm = !!det;

  /* ── 안내 텍스트 (세로/가로 공용) ── */
  const guidance = canConfirm ? (
    <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-green-400">
      <Check size={15} strokeWidth={2.5} />
      인식 완료 — '측정하기'를 눌러 확정하세요
    </p>
  ) : (
    <div className="flex flex-col items-center gap-1 text-center" style={{ animation: "slowBlink 3s ease-in-out infinite" }}>
      <p className="text-[13px] font-semibold text-white/90">
        물고기를 바닥에 옆으로 눕혀주세요
      </p>
      <p className="text-[11px] text-white/55">입낚볼과 물고기가 함께 보이도록 맞춰주세요</p>
    </div>
  );

  /* ── 측정하기 버튼 (세로/가로 공용) ── */
  const measureButton = (
    <button
      type="button"
      onClick={confirm}
      disabled={!canConfirm}
      className={
        "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold transition-all active:scale-[0.98] " +
        (canConfirm
          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600"
          : "bg-white/10 text-white/35")
      }
    >
      <ScanLine size={18} strokeWidth={2} />
      측정하기
    </button>
  );

  /* ── 직접 측정 버튼 (세로/가로 공용) ── */
  const manualButton = (
    <button
      type="button"
      onClick={switchToManual}
      className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-semibold text-white/70 transition-colors hover:text-white/95"
    >
      <Ruler size={15} strokeWidth={1.9} />
      직접 측정
    </button>
  );

  return (
    <div className="fixed inset-0 z-[400] overflow-hidden bg-black">
      {/* 안내 텍스트 느린 깜빡임 keyframe */}
      <style>{`@keyframes slowBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* ── 카메라 프리뷰 + 오버레이 (진짜 풀스크린, object-cover) ── */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0 }}
      />
      <canvas
        ref={overlayRef}
        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 10 }}
      />

      {/* ── 상단 바 ── */}
      <div
        className={
          "pt-safe absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent " +
          (isLandscape ? "px-3 py-1.5" : "px-4 py-3")
        }
      >
        <div className="flex items-center gap-2">
          <ScanLine size={isLandscape ? 15 : 17} strokeWidth={1.9} className="text-orange-400" />
          <span className={"font-bold text-white " + (isLandscape ? "text-[12px]" : "text-[14px]")}>AI 실시간 스캐너</span>
          {!isLandscape && (
            <span className="animate-pulse rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400 ring-1 ring-orange-500/30">
              입낚 AI 측정 중
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="닫기"
          className={"rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 " + (isLandscape ? "p-1.5" : "p-2")}
        >
          <X size={isLandscape ? 17 : 19} />
        </button>
      </div>

      {/* 감지 시 상단 배지 */}
      {canConfirm && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-20 -translate-x-1/2">
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/90 px-3 py-1.5 text-[12px] font-bold text-white shadow-lg">
            <Check size={14} strokeWidth={2.6} />
            물고기 인식됨
            {det?.lengthCm != null && <span className="ml-0.5">· 약 {det.lengthCm}cm</span>}
          </span>
        </div>
      )}

      {camStatus === "loading" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-white/80">
          <Loader2 size={30} className="animate-spin text-orange-400" />
          <p className="text-[13px]">카메라 준비 중...</p>
        </div>
      )}

      {camStatus === "error" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/85">{camError}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setRetry((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-[14px] bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <RefreshCw size={15} /> 재시도
            </button>
            <button
              onClick={switchToManual}
              className="inline-flex items-center gap-1.5 rounded-[14px] bg-aqua-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-aqua-600"
            >
              <Ruler size={15} /> 직접 측정
            </button>
            <button
              onClick={onClose}
              className="rounded-[14px] bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 하단(세로) 컨트롤 ── */}
      {camStatus !== "error" && !isLandscape && !showRightPanel && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-4 pb-5 pt-10">
          <div className="mb-3">{guidance}</div>
          {measureButton}
          <div className="mt-2">{manualButton}</div>
        </div>
      )}

      {/* ── 안내 오버레이 — 우측 패널 활성 시 카메라 긴쪽 중앙에 표시 ── */}
      {camStatus !== "error" && (isLandscape || showRightPanel) && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-20 flex flex-col items-center justify-center"
          style={{ right: "88px" }}
        >
          {guidance}
        </div>
      )}

      {/* ── 우측 컨트롤 패널 — 기본값 (가로 구도, 짧은쪽) ── */}
      {camStatus !== "error" && (isLandscape || showRightPanel) && (
        <div
          className="pb-safe absolute inset-y-0 right-0 z-30 flex flex-col items-center"
          style={{ background: "rgba(0,0,0,0.75)", width: "88px" }}
        >
          {/* 상단 여백 (헤더 높이) */}
          <div className="h-14 shrink-0" />

          {/* 상단 여백 — 측정하기를 중앙 위쪽에 배치 */}
          <div className="flex-1" />

          {/* 측정하기 (원형 버튼) */}
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className={
              "flex h-[60px] w-[60px] flex-col items-center justify-center gap-1 rounded-full text-[10px] font-bold transition-all active:scale-[0.94] " +
              (canConfirm
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
                : "bg-white/10 text-white/35")
            }
          >
            <ScanLine size={19} strokeWidth={2} />
            <span>측정하기</span>
          </button>

          {/* 중간 여백 — 직접측정을 하단으로 밀어냄 */}
          <div className="flex-[2]" />

          {/* 직접측정 (원형 버튼, 짧은쪽 하단) */}
          <button
            type="button"
            onClick={switchToManual}
            className="mb-6 flex h-[48px] w-[48px] flex-col items-center justify-center gap-0.5 rounded-full bg-white/10 text-[9px] font-semibold text-white/65 transition-colors hover:bg-white/20 hover:text-white/90 active:scale-[0.93]"
          >
            <Ruler size={15} strokeWidth={1.9} />
            <span>직접측정</span>
          </button>
        </div>
      )}

      {/* ── '가로로 촬영하기' 안내 토스트 (2초 후 자동 사라짐) ── */}
      {showRotateHint && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-8">
          <div className="flex items-center gap-2 rounded-2xl bg-black/80 px-5 py-3 text-[14px] font-semibold text-white shadow-xl ring-1 ring-white/10">
            <RotateCw size={18} className="text-orange-400" />
            {isLandscape ? "기기를 세로로 돌려주세요" : "기기를 가로로 돌려주세요"}
          </div>
        </div>
      )}

      {/* ── 권한 사전 안내 오버레이 (컨테이너 내부 절대위치 — iOS portal 터치 버그 회피) ── */}
      {!consented && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
        >
          <div
            className="w-full max-w-[430px] overflow-hidden rounded-t-[32px] shadow-2xl ring-1 ring-white/[0.1]"
            style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#162434 60%,#1a2a3a 100%)" }}
          >
            <div className="h-[3px] w-full bg-gradient-to-r from-aqua-700/30 via-orange-400/90 to-aqua-700/30" />
            <div className="mx-auto mt-3.5 h-1 w-10 rounded-full bg-white/[0.14]" />

            <div className="flex flex-col items-center px-6 pb-4 pt-5">
              <div className="relative mb-4">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-orange-500 shadow-lg shadow-orange-500/30">
                  <Camera size={33} strokeWidth={1.6} className="text-white" />
                </div>
                <span className="absolute -right-1.5 -top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-aqua-500 ring-2 ring-[#0b1e2e]">
                  <ScanLine size={13} strokeWidth={2.2} className="text-white" />
                </span>
              </div>
              <p className="text-[19px] font-extrabold tracking-tight text-white">카메라 접근</p>
              <p className="mt-1.5 text-center text-[13px] leading-relaxed text-white/45">
                실시간 물고기 측정을 위해<br />카메라 권한이 필요합니다
              </p>
            </div>

            <p className="px-6 py-3 text-center text-[12px] leading-relaxed text-white/32">
              다음 화면의 권한 팝업에서 <span className="font-semibold text-white/55">허용</span>을 눌러 주세요
            </p>

            <div className="space-y-2 px-4 pb-8 pt-1">
              <button
                type="button"
                onClick={() => { setCameraConsent(); setConsented(true); }}
                className="w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
              >
                카메라 허용하기
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl py-2.5 text-[13px] font-medium text-white/28 transition-colors active:text-white/55"
              >
                나중에 하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
