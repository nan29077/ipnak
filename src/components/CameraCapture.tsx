"use client";
import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";

interface Props {
  onCapture: (dataUrl: string, estimatedCm: number) => void;
  onClose: () => void;
}

/**
 * 배스 오버레이 카메라
 *
 * 레이아웃:
 *   [상단] 기준 물고기 실루엣 (10cm 고정 기준)
 *   [중앙] 메인 배스 실루엣 (물고기를 이 안에 맞춰 촬영)
 *   [하단] 예상 크기 / 셔터
 *
 * 계측 원리:
 *   - 기준 실루엣(10cm) : 메인 실루엣 = 1 : 2.5 고정 비율
 *   - 사용자가 +/- 로 오버레이를 키워 메인 실루엣이 실제 물고기 크기에 맞으면
 *     예상 크기 = 25cm * scale 로 표시
 *   - 기준 실루엣을 실제 10cm 물체(스티커·카드 등)와 맞춰 두면 계측 정확도 향상
 */
export function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "unsupported">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [scale, setScale] = useState(1.0);
  const [flash, setFlash] = useState(false);
  const [retry, setRetry] = useState(0);

  const estimatedCm = Math.round(25 * scale);

  // 카메라 초기화 (재시도 가능)
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg("");

    async function init() {
      // HTTPS 환경 체크: HTTP에서는 navigator.mediaDevices 자체가 없음
      if (!window.isSecureContext) {
        setErrorMsg(
          "카메라 API는 HTTPS 환경에서만 사용 가능합니다.\n주소창이 https://로 시작하는지 확인하세요."
        );
        setStatus("unsupported");
        return;
      }

      // navigator.mediaDevices 사전 체크 없이 직접 시도
      // (iOS Safari는 HTTPS에서 mediaDevices를 지원하지만 optional chaining이 falsy 반환하는 경우 있음)
      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        { video: { facingMode: "environment" } },
        { video: true },
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
        const errName = (lastError as DOMException)?.name ?? "";
        const errMsg = (lastError as DOMException)?.message ?? "";

        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setErrorMsg(
            "카메라 권한이 필요합니다.\n\niPhone: 설정 → Safari → 카메라 → 허용\n\n허용 후 아래 버튼을 눌러 재시도하세요."
          );
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          setErrorMsg("카메라 기기를 찾을 수 없습니다.\n기기에 카메라가 연결되어 있는지 확인하세요.");
        } else if (errName === "NotReadableError" || errName === "TrackStartError") {
          setErrorMsg(
            "카메라가 다른 앱에서 사용 중입니다.\n다른 앱을 닫고 재시도하세요."
          );
        } else {
          // TypeError 포함: navigator.mediaDevices 자체가 없거나 기타 오류
          setErrorMsg(
            `카메라를 시작할 수 없습니다.\n\n${errName ? `오류: ${errName}` : "알 수 없는 오류"}\n\n설정 → Safari → 카메라 → 허용 확인 후 재시도하세요.`
          );
        }
        setStatus("denied");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          /* autoplay policy */
        }
        if (!cancelled) setStatus("ready");
      }
    }

    init();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [retry]);

  // 카메라 실행 시 가로 방향으로 잠금 (지원 기기만)
  useEffect(() => {
    const tryLock = async () => {
      try {
        await (screen.orientation as any).lock("landscape");
      } catch {
        // iOS Safari 등 미지원 기기는 무시
      }
    };
    tryLock();
    return () => {
      try {
        (screen.orientation as any).unlock();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function capture() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || status !== "ready") return;
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.92);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl, estimatedCm);
  }

  // 폴백 파일 처리
  function handleFallbackFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (url) onCapture(url, estimatedCm);
    };
    reader.readAsDataURL(files[0]);
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black"
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 카메라 뷰 영역 */}
      <div className="relative flex-1 overflow-hidden">
        {/* 라이브 비디오 */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          style={{ opacity: status === "ready" ? 1 : 0 }}
        />

        {/* 셔터 플래시 */}
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}

        {/* 로딩 */}
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-400 border-t-transparent" />
          </div>
        )}

        {/* 배스 오버레이 - ready 상태에서만 표시 */}
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <OverlayGuide scale={scale} estimatedCm={estimatedCm} />
          </div>
        )}

        {/* 스케일 조절 버튼 */}
        {status === "ready" && (
          <div className="absolute bottom-6 right-4 flex flex-col gap-2">
            <button
              onClick={() => setScale((s) => Math.min(+(s + 0.1).toFixed(1), 2.5))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white active:bg-black/90"
              aria-label="오버레이 크게"
            >
              <ZoomIn size={20} />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(+(s - 0.1).toFixed(1), 0.4))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white active:bg-black/90"
              aria-label="오버레이 작게"
            >
              <ZoomOut size={18} />
            </button>
          </div>
        )}

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white"
          aria-label="닫기"
        >
          <X size={20} />
        </button>

        {/* 권한 거부 / 미지원 화면 - 항상 재시도 버튼 표시 */}
        {(status === "denied" || status === "unsupported") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-neutral-950 px-8">
            <p className="whitespace-pre-line text-center text-sm leading-relaxed text-white/70">
              {errorMsg ||
                (status === "unsupported"
                  ? "이 브라우저에서 카메라를 사용할 수 없습니다."
                  : "카메라 권한이 필요합니다.\n\n설정에서 카메라 권한을 허용 후 재시도하세요.")}
            </p>
            <button
              onClick={() => setRetry((r) => r + 1)}
              className="flex items-center gap-2 rounded-2xl bg-orange-500 px-8 py-3 text-sm font-bold text-white"
            >
              <RefreshCw size={16} /> 카메라 재시도
            </button>
            <div className="w-full border-t border-white/10 pt-4">
              <p className="mb-2 text-center text-[11px] text-white/40">또는 기기 기본 카메라 사용</p>
              <button
                onClick={() => {
                  fallbackRef.current!.value = "";
                  fallbackRef.current!.click();
                }}
                className="w-full rounded-xl border border-white/20 py-3 text-sm font-semibold text-white/70"
              >
                갤러리 / 기기 카메라로 촬영하기
              </button>
              <input
                ref={fallbackRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFallbackFile(e.target.files)}
              />
            </div>
          </div>
        )}
      </div>

      {/* 하단 셔터 바 */}
      <div className="flex items-center justify-center gap-8 bg-black px-6 py-5">
        <div className="w-14 text-center">
          <p className="text-[10px] leading-tight text-white/40">
            +/- 로
            <br />
            크기 조절
          </p>
        </div>
        <button
          onClick={capture}
          disabled={status !== "ready"}
          className="relative h-16 w-16 rounded-full border-4 border-white disabled:opacity-30 active:scale-95 transition-transform"
          aria-label="촬영"
        >
          <span className="absolute inset-[5px] rounded-full bg-white" />
        </button>
        <div className="w-14 text-center">
          <p className="text-[20px] font-extrabold leading-none text-orange-400">
            {status === "ready" ? estimatedCm : "--"}
          </p>
          <p className="text-[10px] text-white/40">cm 예상</p>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 오버레이 가이드
// 상단: 10cm 기준 배스 (소형 실루엣 + 레이블)
// 중앙: 메인 배스 실루엣 (물고기를 여기에 맞춰 크기 조절)
// ──────────────────────────────────────────────────────────────
function OverlayGuide({ scale, estimatedCm }: { scale: number; estimatedCm: number }) {
  return (
    <div className="flex flex-col items-center gap-0">
      {/* 기준 물고기 (10cm 고정) */}
      <div className="flex flex-col items-center">
        <p className="mb-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-yellow-300 backdrop-blur-sm">
          기준 · 10cm
        </p>
        <ReferenceBass scale={scale} />
      </div>

      {/* 예상 크기 뱃지 */}
      <div className="my-2 flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 backdrop-blur-sm">
        <span className="text-[11px] text-white/60">예상 크기</span>
        <span className="text-[17px] font-extrabold text-orange-400">~{estimatedCm}cm</span>
        <span className="text-[11px] text-white/60">배스</span>
      </div>

      {/* 메인 배스 실루엣 */}
      <div className="flex flex-col items-center">
        <MainBass scale={scale} />
        <p className="mt-1.5 text-[10px] text-white/50">
          물고기를 실루엣 안에 맞춰 +/- 로 크기 조절 후 촬영
        </p>
      </div>
    </div>
  );
}

// 기준 배스 (10cm): 메인 배스의 2/5 크기 → 비율 고정
// SVG viewBox 폭 = 100, 메인 = 250 → 비율 2.5
function ReferenceBass({ scale }: { scale: number }) {
  const W = Math.round(100 * scale);
  const H = Math.round(42 * scale);
  return (
    <svg
      width={W}
      height={H}
      viewBox="0 0 100 42"
      fill="none"
      style={{ filter: "drop-shadow(0 0 4px rgba(255,220,0,0.8))" }}
      overflow="visible"
    >
      {/* 몸체 */}
      <path
        d="M 82 20 C 74 8, 55 3, 36 3 C 17 3, 6 10, 2 18 C -1 21, 1 24, 4 27 C 1 30, 3 36, 10 38 C 20 40, 38 42, 55 40 C 72 38, 80 30, 82 20 Z"
        fill="rgba(255,220,0,0.08)"
        stroke="rgba(255,220,0,0.9)"
        strokeWidth="1.4"
      />
      {/* 꼬리 */}
      <path
        d="M 82 20 C 89 15, 97 9, 98 6"
        stroke="rgba(255,220,0,0.9)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 82 20 C 89 25, 97 31, 98 34"
        stroke="rgba(255,220,0,0.9)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* 눈 */}
      <circle cx="14" cy="15" r="2.5" stroke="rgba(255,220,0,0.9)" strokeWidth="1" />
      {/* 입 */}
      <path
        d="M 2 18 C -3 14, -4 18, -2 21 C -4 24, -2 26, 2 24"
        stroke="rgba(255,220,0,0.8)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* 등지느러미 */}
      <path
        d="M 30 3 C 36 -3, 48 -4, 54 1 L 52 3 Z"
        fill="rgba(255,220,0,0.1)"
        stroke="rgba(255,220,0,0.7)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 메인 배스 실루엣 (25cm 기준): 기준 배스의 2.5배 크기
function MainBass({ scale }: { scale: number }) {
  const W = Math.round(250 * scale);
  const H = Math.round(105 * scale);
  return (
    <svg
      width={W}
      height={H}
      viewBox="0 0 250 105"
      fill="none"
      style={{ filter: "drop-shadow(0 0 8px rgba(255,160,0,0.7))" }}
      overflow="visible"
    >
      {/* 몸체 */}
      <path
        d="M 210 50 C 196 24, 158 10, 112 9 C 66 8, 34 21, 16 37
           C 6 44, 5 50, 10 56 C 6 62, 10 72, 22 76
           C 42 84, 74 88, 112 87 C 156 86, 196 72, 210 50 Z"
        fill="rgba(255,150,0,0.08)"
        stroke="rgba(255,180,0,0.95)"
        strokeWidth="2"
      />
      {/* 꼬리 */}
      <path
        d="M 210 50 C 224 40, 240 26, 242 18"
        stroke="rgba(255,180,0,0.95)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 210 50 C 224 60, 240 74, 242 80"
        stroke="rgba(255,180,0,0.95)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 214 42 C 232 24, 240 18, 242 18 C 240 22, 226 46, 218 58 C 230 68, 240 76, 242 80 C 240 82, 232 76, 214 62 Z"
        fill="rgba(255,150,0,0.1)"
        stroke="rgba(255,180,0,0.7)"
        strokeWidth="1.2"
      />
      {/* 등지느러미 */}
      <path
        d="M 68 9 C 84 -6, 110 -10, 126 2 L 120 9 Z"
        fill="rgba(255,150,0,0.12)"
        stroke="rgba(255,180,0,0.9)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
                d="M 134 9 C 148 0, 166 0, 176 9 L 170 14 Z"
        fill="rgba(255,150,0,0.12)"
        stroke="rgba(255,180,0,0.9)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* 지느미들 */}
      <path
        d="M 40 54 C 28 44, 22 60, 34 70 Z"
        fill="rgba(255,150,0,0.1)"
        stroke="rgba(255,180,0,0.8)"
        strokeWidth="1.3"
      />
      <path
        d="M 92 87 C 86 97, 76 100, 72 96 L 82 87 Z"
        fill="rgba(255,150,0,0.1)"
        stroke="rgba(255,180,0,0.8)"
        strokeWidth="1.3"
      />
      <path
        d="M 142 87 C 146 97, 162 100, 168 96 L 156 86 Z"
        fill="rgba(255,150,0,0.1)"
        stroke="rgba(255,180,0,0.8)"
        strokeWidth="1.3"
      />
      {/* 큰 입 */}
      <path
        d="M 6 44 C -5 37, -7 42, -5 50 C -7 58, -5 62, 6 58"
        stroke="rgba(255,180,0,0.9)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 6 44 L 26 39"
        stroke="rgba(255,180,0,0.7)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M 6 58 L 26 61"
        stroke="rgba(255,180,0,0.7)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* 눈 */}
      <circle cx="36" cy="38" r="5" stroke="rgba(255,200,0,0.95)" strokeWidth="1.6" />
      <circle cx="36" cy="38" r="2.5" fill="rgba(255,200,0,0.4)" />
      {/* 아가미 */}
      <path
        d="M 48 22 C 54 34, 56 56, 48 68"
        stroke="rgba(255,180,0,0.6)"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      {/* 옆줄 */}
      <path
        d="M 60 46 C 110 42, 156 46, 196 50"
        stroke="rgba(255,180,0,0.4)"
        strokeWidth="0.9"
        strokeDasharray="4 3"
      />
      {/* 비늘 */}
      <path
        d="M 78 30 C 96 28, 114 29, 130 32"
        stroke="rgba(255,180,0,0.18)"
        strokeWidth="0.7"
        fill="none"
      />
      <path
        d="M 74 50 C 98 48, 126 49, 154 51"
        stroke="rgba(255,180,0,0.18)"
        strokeWidth="0.7"
        fill="none"
      />
      <path
        d="M 78 66 C 102 64, 134 65, 162 67"
        stroke="rgba(255,180,0,0.18)"
        strokeWidth="0.7"
        fill="none"
      />
      {/* 크기 표시 */}
      <line x1="6" y1="100" x2="210" y2="100" stroke="rgba(255,180,0,0.5)" strokeWidth="0.8" />
      <line
        x1="6"
        y1="96"
        x2="6"
        y2="104"
        stroke="rgba(255,180,0,0.7)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="210"
        y1="96"
        x2="210"
        y2="104"
        stroke="rgba(255,180,0,0.7)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
