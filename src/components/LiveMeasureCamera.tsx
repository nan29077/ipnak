"use client";
/**
 * 실시간 카메라 측정 뷰
 * - getUserMedia 라이브 프리뷰 + requestAnimationFrame 분석 루프
 * - BallDetector.detectBest() 로 입낚볼/ArUco 마커를 실시간 감지해 캔버스 오버레이 표시
 *   · 대기: 오렌지 점선 원형 가이드 + "입낚볼을 원 안에 위치시켜주세요"
 *   · 감지: 초록 원 + 체크 + "물고기를 프레임 안에 맞추세요"
 *   · ArUco 마커 감지 시: "정밀 측정 모드" 배지
 * - 촬영 시 프레임(최대 1280px)을 부모(measure 페이지)로 넘겨 기존 분석 파이프라인 재사용
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Check, Loader2, RefreshCw, ScanLine, Ruler, Crosshair, Images } from "lucide-react";

type Props = {
  detector: any; // BallDetector 인스턴스 (@/utils)
  onCapture: (work: HTMLCanvasElement) => void;
  onClose: () => void;
};

/* ── 카메라 사전 안내 팝업 (브라우저 권한 요청 전 커스텀 안내) ── */
const CAM_CONSENT_KEY = "ipnak_camera_consent";

/** 사용자가 커스텀 안내 팝업에서 이미 '허용하기'를 눌렀는지 */
export function hasCameraConsent(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(CAM_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCameraConsent() {
  try {
    localStorage.setItem(CAM_CONSENT_KEY, "1");
  } catch { /* noop */ }
}

export function CameraPermissionModal({ onAllow, onCancel }: { onAllow: () => void; onCancel: () => void }) {
  if (typeof document === "undefined") return null;

  const features = [
    {
      icon: <Camera size={17} strokeWidth={1.7} />,
      label: "실시간 카메라 측정",
      desc: "물고기를 촬영하면 바로 길이를 잴 수 있어요",
      accent: "bg-orange-500/15 text-orange-400",
    },
    {
      icon: <Ruler size={17} strokeWidth={1.7} />,
      label: "머리·꼬리 수동 측정",
      desc: "입낚볼 없이도 직접 탭해서 측정합니다",
      accent: "bg-aqua-500/15 text-aqua-400",
    },
    {
      icon: <Images size={17} strokeWidth={1.7} />,
      label: "갤러리 사진 분석",
      desc: "이미 찍은 사진으로도 길이 측정이 가능해요",
      accent: "bg-orange-500/15 text-orange-400",
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 backdrop-blur-[3px] sm:items-center">
      <div
        className="w-full max-w-[430px] overflow-hidden rounded-t-[32px] shadow-2xl ring-1 ring-aqua-500/[0.15] sm:mx-4 sm:rounded-[28px]"
        style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#162434 60%,#1a2a3a 100%)" }}
      >
        {/* 상단 웨이브 스트라이프 */}
        <div className="h-[3px] w-full bg-gradient-to-r from-aqua-700/30 via-orange-400/90 to-aqua-700/30" />

        {/* 드래그 핸들 */}
        <div className="mx-auto mt-3.5 h-1 w-10 rounded-full bg-white/[0.14]" />

        {/* 아이콘 + 타이틀 */}
        <div className="flex flex-col items-center px-6 pb-4 pt-5">
          <div className="relative mb-4">
            {/* 카메라 아이콘: 오렌지 + aqua 글로우 */}
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

        {/* 기능 카드 */}
        <div className="mx-4 space-y-0.5 rounded-2xl border border-aqua-500/[0.12] bg-white/[0.03] p-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${f.accent}`}>
                {f.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white/90">{f.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/38">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 권한 요청 안내 */}
        <p className="px-6 py-3 text-center text-[12px] leading-relaxed text-white/32">
          다음 화면의 권한 팝업에서{" "}
          <span className="font-semibold text-white/55">허용</span>을 눌러 주세요
        </p>

        {/* 버튼 */}
        <div className="space-y-2 px-4 pb-8 pt-1">
          <button
            type="button"
            onClick={onAllow}
            className="w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] active:bg-orange-600"
          >
            카메라 허용하기
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-2xl py-2.5 text-[13px] font-medium text-white/28 transition-colors active:text-white/55"
          >
            나중에 하기
          </button>
        </div>

      </div>
    </div>,
    document.body,
  );
}

const DETECT_INTERVAL_MS = 550; // 감지 주기 (OpenCV 부하 보호)
const DETECT_MAX_PX = 640;      // 감지용 다운스케일
const CAPTURE_MAX_PX = 1280;    // 촬영본 최대 크기

type Cam = "loading" | "ready" | "error";
type Engine = "loading" | "ready" | "failed";

export function LiveMeasureCamera({ detector, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ballRef = useRef<{ cx: number; cy: number; r: number; method: string } | null>(null);

  const [camStatus, setCamStatus] = useState<Cam>("loading");
  const [camError, setCamError] = useState("");
  const [engineStatus, setEngineStatus] = useState<Engine>("loading");
  const [ballFound, setBallFound] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [retry, setRetry] = useState(0);
  // 실제로 비디오 프레임 데이터가 준비됐는지 (videoWidth > 0 + playing)
  const [videoHasData, setVideoHasData] = useState(false);
  // 브라우저 권한 요청 전 커스텀 안내 팝업
  // 항상 false로 시작 → Permissions API / localStorage 확인 후 자동 업데이트
  const [consented, setConsented] = useState(false);

  // 마운트 시 카메라 권한 상태 확인 → 이미 허용된 경우 커스텀 모달 스킵
  useEffect(() => {
    if (!hasCameraConsent()) return; // localStorage에 동의 없음 → 모달 표시

    if (typeof navigator === "undefined") { setConsented(true); return; }

    if (navigator.permissions) {
      // Permissions API 지원 (Chrome/Android): 실제 권한 상태 확인
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((r) => {
          if (r.state === "granted") setConsented(true);
          // "prompt" / "denied" → 권한 재요청 필요, 모달 다시 표시
        })
        .catch(() => setConsented(true)); // iOS Safari (Permissions API 미지원) → localStorage 신뢰
    } else {
      setConsented(true); // Permissions API 없음 → localStorage 신뢰
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 카메라 시작 ── */
  useEffect(() => {
    if (!consented) return; // 사전 안내 팝업에서 '허용하기' 전에는 getUserMedia 를 호출하지 않음
    let cancelled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null; // iOS 폴링 타이머
    setCamStatus("loading");
    setCamError("");

    const clearWatchdog = () => {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    };
    const markReady = () => {
      if (cancelled) return;
      clearWatchdog();
      setCamStatus("ready");
    };
    const markVideoData = () => {
      if (cancelled) return;
      setVideoHasData(true);
    };
    const markError = (msg: string) => {
      if (cancelled) return;
      clearWatchdog();
      setCamError(msg);
      setCamStatus("error");
    };

    async function init() {
      if (typeof window === "undefined") return;
      // getUserMedia 자체가 없는 환경 (비보안 컨텍스트 / 구형 웹뷰)
      if (!navigator.mediaDevices?.getUserMedia) {
        markError(
          window.isSecureContext
            ? "이 브라우저는 카메라를 지원하지 않아요.\n크롬/사파리 최신 버전으로 열어 주세요."
            : "HTTPS 환경에서만 카메라를 사용할 수 있습니다.\n주소가 https:// 로 시작하는지 확인해 주세요."
        );
        return;
      }

      // 권한 팝업 방치 등으로 getUserMedia 가 무한 대기하는 경우 대비 (10초 워치독)
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
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastError = e;
        }
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
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      // video ref 가 아직 연결 전이면 다음 프레임에 재시도 (마운트 직후 타이밍 보호)
      const attach = () => {
        if (cancelled) return;
        const v = videoRef.current;
        if (!v) { requestAnimationFrame(attach); return; }

        // [iOS 화면 멈춤 버그 수정]
        // React 는 JSX 의 muted 프로퍼티를 실제 DOM 속성으로 반영하지 않는 버그가 있어
        // (facebook/react#10389) iOS Safari 가 자동재생을 거부 → play() 실패 → 첫 프레임에서 정지.
        // srcObject 설정 전에 muted/playsInline 을 DOM 에 직접 지정해야 한다.
        v.muted = true;
        v.setAttribute("muted", "");
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.autoplay = true;

        const tryPlay = () => { v.play().catch(() => { /* autoplay policy */ }); };
        const start = () => {
          if (cancelled) return;
          tryPlay();
          markReady();
        };

        v.onloadedmetadata = start;
        v.oncanplay = tryPlay;
        v.onplaying = () => { markReady(); markVideoData(); };
        v.onloadeddata = () => { if (v.videoWidth > 0) markVideoData(); };
        // ontimeupdate: iOS Safari 에서 onplaying 이 발화 안 돼도 재생 시작 감지
        v.ontimeupdate = () => { if (!cancelled && v.videoWidth > 0) { markReady(); markVideoData(); } };

        v.srcObject = stream;
        // 주의: 여기서 v.load() 를 호출하면 iOS Safari 가 srcObject 스트림을 리셋해
        // 프리뷰가 멈추므로 호출하지 않는다.

        // iOS: srcObject 설정 직후 즉시 play() 호출 (일부 iOS 버전 필요)
        const p0 = v.play();
        if (p0) p0.catch(() => {});

        // 폴링 폴백: 500ms 마다 재생 상태 확인 및 play() 재시도 (iOS autoplay 대응)
        pollId = setInterval(() => {
          if (cancelled || !streamRef.current) { if (pollId) clearInterval(pollId); return; }
          // 재생 중이 아니면 다시 시도
          if (v.paused) v.play().catch(() => {});
          // 실제 프레임이 있으면 즉시 ready
          if (v.readyState >= 2 && v.videoWidth > 0) {
            if (pollId) { clearInterval(pollId); pollId = null; }
            markReady();
            markVideoData();
          }
        }, 500);

        // 하드 폴백: 1.5초 후 강제 ready (3초에서 단축 — iOS onloadedmetadata 미발화 대응)
        setTimeout(() => {
          if (pollId) { clearInterval(pollId); pollId = null; }
          if (!cancelled && streamRef.current) {
            v.play().catch(() => {});
            markReady();
            if (v.readyState >= 2 && v.videoWidth > 0) markVideoData();
          }
        }, 1500);

        if (v.readyState >= 1 /* HAVE_METADATA */) start();
        if (v.readyState >= 2 /* HAVE_CURRENT_DATA */ && v.videoWidth > 0) markVideoData();
      };
      attach();
    }

    init();
    return () => {
      cancelled = true;
      clearWatchdog();
      if (pollId) { clearInterval(pollId); pollId = null; }
      setVideoHasData(false);
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

  /* ── 측정 엔진(OpenCV + ArUco) 지연 로드 — 3초 타임아웃 (볼 없이도 카메라 동작) ── */
  useEffect(() => {
    let alive = true;
    Promise.race([
      detector.init(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ])
      .then(() => { if (alive) setEngineStatus("ready"); })
      .catch(() => { if (alive) setEngineStatus("failed"); });
    return () => { alive = false; };
  }, [detector]);

  /* ── 실시간 분석 루프 (video → work canvas → detectBest → overlay) ── */
  useEffect(() => {
    if (camStatus !== "ready") return;
    let raf = 0;
    let last = 0;
    let disposed = false;
    const work = document.createElement("canvas");
    const wctx = work.getContext("2d", { willReadFrequently: true })!;

    const loop = (t: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const v = videoRef.current;
      const ov = overlayRef.current;
      if (!v || !ov || v.readyState < 2 || !v.videoWidth) return;
      if (ov.width !== v.videoWidth || ov.height !== v.videoHeight) {
        ov.width = v.videoWidth;
        ov.height = v.videoHeight;
      }
      if (t - last < DETECT_INTERVAL_MS) return;
      last = t;

      if (engineStatus === "ready") {
        const s = Math.min(1, DETECT_MAX_PX / Math.max(v.videoWidth, v.videoHeight));
        work.width = Math.max(1, Math.round(v.videoWidth * s));
        work.height = Math.max(1, Math.round(v.videoHeight * s));
        wctx.drawImage(v, 0, 0, work.width, work.height);
        let res: any = null;
        try { res = detector.detectBest(work); } catch { res = null; }
        if (res && res.found && res.confidence >= 0.4) {
          const f = v.videoWidth / work.width;
          ballRef.current = {
            cx: res.centerX * f,
            cy: res.centerY * f,
            r: (res.diameterPx * f) / 2,
            method: res.method || "ball",
          };
        } else {
          ballRef.current = null;
        }
      }
      // 루프에서도 videoWidth 확인 → 실제 프레임 존재 여부 추적
      if (v.videoWidth > 0) setVideoHasData(true);
      setBallFound(!!ballRef.current);
      setMethod(ballRef.current?.method ?? null);
      drawOverlay(ov, ballRef.current);
    };

    raf = requestAnimationFrame(loop);
    return () => { disposed = true; cancelAnimationFrame(raf); };
  }, [camStatus, engineStatus, detector]);

  /* ── 오버레이 렌더 ── */
  function drawOverlay(ov: HTMLCanvasElement, ball: { cx: number; cy: number; r: number } | null) {
    const ctx = ov.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, ov.width, ov.height);
    if (ball) {
      // 감지 완료: 초록 원 + 중심점 + 체크 배지
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = Math.max(3, ball.r * 0.08);
      ctx.beginPath();
      ctx.arc(ball.cx, ball.cy, ball.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(ball.cx, ball.cy, Math.max(3, ball.r * 0.08), 0, Math.PI * 2);
      ctx.fill();
      // 체크 배지 (원 우상단)
      const br = Math.max(12, ball.r * 0.3);
      const bx = ball.cx + ball.r * 0.85;
      const by = ball.cy - ball.r * 0.85;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, br * 0.18);
      ctx.beginPath();
      ctx.moveTo(bx - br * 0.45, by);
      ctx.lineTo(bx - br * 0.1, by + br * 0.35);
      ctx.lineTo(bx + br * 0.5, by - br * 0.35);
      ctx.stroke();
    } else {
      // 대기: 물고기 프레이밍 가이드 (코너 브래킷 + 중심 크로스헤어)
      const W = ov.width, H = ov.height;
      const padX = W * 0.12, padY = H * 0.20;
      const x1 = padX, y1 = padY, x2 = W - padX, y2 = H - padY;
      const arm = Math.min(W, H) * 0.08;
      const lw = Math.max(2.5, W * 0.006);

      ctx.strokeStyle = "rgba(249,115,22,0.85)";
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.setLineDash([]);

      // 4개 코너 L자 브래킷
      const corners: [number, number, number, number][] = [
        [x1, y1, 1, 1], [x2, y1, -1, 1], [x1, y2, 1, -1], [x2, y2, -1, -1],
      ];
      for (const [cx, cy, dx, dy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * arm, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * arm);
        ctx.stroke();
      }

      // 중심 크로스헤어 (작은)
      const ch = Math.min(W, H) * 0.025;
      ctx.strokeStyle = "rgba(249,115,22,0.4)";
      ctx.lineWidth = Math.max(1.5, lw * 0.6);
      ctx.beginPath();
      ctx.moveTo(W / 2 - ch, H / 2); ctx.lineTo(W / 2 + ch, H / 2);
      ctx.moveTo(W / 2, H / 2 - ch); ctx.lineTo(W / 2, H / 2 + ch);
      ctx.stroke();
    }
  }

  /* ── 촬영 ── */
  function capture() {
    const v = videoRef.current;
    if (!v || camStatus !== "ready" || !v.videoWidth) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 140);
    const s = Math.min(1, CAPTURE_MAX_PX / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * s);
    c.height = Math.round(v.videoHeight * s);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onCapture(c);
  }

  const engineFailed = engineStatus === "failed";
  // 실제로 비디오 프레임이 있을 때만 촬영 가능 (videoWidth > 0 보장)
  const canShoot = camStatus === "ready" && videoHasData;

  const statusText =
    camStatus !== "ready"
      ? "카메라 준비 중..."
      : !videoHasData
        ? "영상 로딩 중..."
        : ballFound
          ? method === "aruco"
            ? "마커 감지됨 — 정밀 측정 모드"
            : "입낚볼 인식 완료 — 물고기를 맞추고 촬영하세요"
          : "물고기를 프레임 안에 맞추고 촬영하세요";

  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-black">
      {/* 상단 바 */}
      <div className="pt-safe flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanLine size={17} strokeWidth={1.9} className="text-orange-400" />
          <span className="text-[14px] font-bold text-white">AI 카메라 계측</span>
          {/* 블링킹 안내 배지 */}
          <span className="animate-pulse rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400 ring-1 ring-orange-500/30">
            입낚 AI 측정 중
          </span>
        </div>
        {method === "aruco" && ballFound && (
          <span className="rounded-full bg-aqua-500/20 px-2.5 py-1 text-[11px] font-bold text-aqua-300 ring-1 ring-aqua-400/40">
            정밀 측정 모드
          </span>
        )}
        <button onClick={onClose} aria-label="닫기" className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20">
          <X size={19} />
        </button>
      </div>

      {/* 카메라 프리뷰 + 오버레이 */}
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-contain"
        />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}

        {camStatus === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 size={30} className="animate-spin text-orange-400" />
            <p className="text-[13px]">카메라 준비 중...</p>
          </div>
        )}
        {camStatus === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/85">{camError}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setRetry((n) => n + 1)}
                className="inline-flex items-center gap-1.5 rounded-[14px] bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600"
              >
                <RefreshCw size={15} /> 재시도
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
      </div>

      {/* 하단: 상태 안내 + 셔터 */}
      <div className="pb-safe px-4 pb-5 pt-3">
        {statusText && (
          <div className="mb-3 flex flex-col items-center gap-1">
            <p
              className={
                "flex items-center gap-1.5 text-center text-[13px] font-semibold " +
                (ballFound ? "text-green-400" : "text-white/80")
              }
            >
              {ballFound && <Check size={15} strokeWidth={2.5} />}
              {statusText}
            </p>
            {!ballFound && camStatus === "ready" && (
              <p className="text-[11px] text-white/40">
                촬영 후 머리·꼬리를 탭해서 길이를 측정합니다
              </p>
            )}
          </div>
        )}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={capture}
            disabled={!canShoot}
            aria-label="촬영"
            className={
              "flex h-[72px] w-[72px] items-center justify-center rounded-full ring-4 transition-all active:scale-95 " +
              (canShoot
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-white/80"
                : "bg-white/15 text-white/40 ring-white/20")
            }
          >
            <Camera size={30} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── 권한 안내 오버레이 (createPortal 대신 컨테이너 내부 절대위치로 렌더링)
           iOS Safari에서 portal 내부 터치 이벤트 차단 버그 방지 ── */}
      {!consented && (
        <div className="absolute inset-0 z-20 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}>
          <div
            className="w-full max-w-[430px] overflow-hidden rounded-t-[32px] shadow-2xl ring-1 ring-white/[0.1]"
            style={{ background: "linear-gradient(170deg,#0b1e2e 0%,#162434 60%,#1a2a3a 100%)" }}
          >
            {/* 상단 웨이브 스트라이프 */}
            <div className="h-[3px] w-full bg-gradient-to-r from-aqua-700/30 via-orange-400/90 to-aqua-700/30" />
            <div className="mx-auto mt-3.5 h-1 w-10 rounded-full bg-white/[0.14]" />

            {/* 아이콘 + 타이틀 */}
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

            {/* 기능 카드 */}
            <div className="mx-4 space-y-0.5 rounded-2xl border border-aqua-500/[0.12] bg-white/[0.03] p-3">
              {[
                { icon: <Camera size={17} strokeWidth={1.7} />, label: "실시간 카메라 측정", desc: "물고기를 촬영하면 바로 길이를 잴 수 있어요", accent: "bg-orange-500/15 text-orange-400" },
                { icon: <Ruler size={17} strokeWidth={1.7} />, label: "머리·꼬리 수동 측정", desc: "입낚볼 없이도 직접 탭해서 측정합니다", accent: "bg-aqua-500/15 text-aqua-400" },
                { icon: <Images size={17} strokeWidth={1.7} />, label: "갤러리 사진 분석", desc: "이미 찍은 사진으로도 길이 측정이 가능해요", accent: "bg-orange-500/15 text-orange-400" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${f.accent}`}>{f.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white/90">{f.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/38">{f.desc}</p>
                  </div>
                </div>
              ))}
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
