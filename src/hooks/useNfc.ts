"use client";
/**
 * 입낚볼 NFC 태그 자동 감지 훅
 *
 * 동작 환경
 * - Android 앱: @capacitor-community/nfc 플러그인으로 백그라운드 스캔 → 태그를 대면 자동 감지
 *   (플러그인이 없으면 Web NFC(NDEFReader) 로 폴백 — 기존 NfcService 와 동일한 경로)
 * - iOS: noop. iOS 는 NDEF 백그라운드 읽기 제약이 커서 기존 수동 입력(BallManualInput)을 유지한다.
 * - 웹: noop (기존 NfcService 를 쓰는 화면에 영향 없음)
 *
 * 감지 성공 시
 * 1) 태그에서 읽은 볼 ID 로 POST /api/balls 호출 (기존 등록 API 재사용)
 * 2) 성공/중복이면 햅틱 success, 실패면 햅틱 error
 * 3) onResult 콜백으로 결과를 알려준다 (토스트 등 UI 는 호출부가 처리)
 *
 * 사용 예
 *   const { status, start, stop } = useNfc({
 *     autoStart: true,
 *     onResult: (r) => toast(r.message, r.ok ? "success" : "error"),
 *   });
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isNativeRuntime, getNativePlatform, importNfc } from "@/lib/capacitorPlugins";
import { hapticSuccess, hapticError } from "@/hooks/useHaptics";
import { parseTagPayload } from "@/lib/nfcTag";

export type NfcStatus =
  | "unsupported" // iOS 앱 / 웹 / NFC 미지원 기기
  | "idle"        // 지원하지만 스캔 중이 아님
  | "scanning"    // 태그 대기 중
  | "error";

export type NfcResult = {
  ok: boolean;
  ballId: string | null;
  /** 이미 등록된 볼이었는지 */
  alreadyLinked?: boolean;
  message: string;
};

type Options = {
  /** 마운트 시 자동으로 스캔 시작 */
  autoStart?: boolean;
  /** false 면 아무 것도 하지 않는다 */
  enabled?: boolean;
  /** 등록 결과 콜백 */
  onResult?: (result: NfcResult) => void;
};

/**
 * NDEF 레코드 payload(byte 배열 또는 문자열)에서 볼/키링 ID 추출
 * - 구형 텍스트 태그("IPNK-000001")와 신규 URL 태그(https://ipnak.kr/ball?id=BALL-000001) 모두 지원
 * - 상태 바이트·언어코드·URI 프리픽스 제거는 parseTagPayload 가 담당한다.
 */
function decodeNdefText(record: any): string | null {
  try {
    // @capacitor-community/nfc: record.payload 는 number[] 또는 문자열
    const payload = record?.payload ?? record?.data;
    if (!payload) return null;
    const raw =
      typeof payload === "string"
        ? payload
        : new TextDecoder().decode(
            Array.isArray(payload) ? Uint8Array.from(payload) : new Uint8Array(payload)
          );
    return parseTagPayload(raw)?.id ?? null;
  } catch {
    return null;
  }
}

/** 볼 ID 를 서버에 등록 (기존 /api/balls 엔드포인트 재사용) */
async function registerBall(ballId: string): Promise<NfcResult> {
  try {
    const res = await fetch("/api/balls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ballId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, ballId, message: data?.error || "볼 등록에 실패했어요." };
    }
    return {
      ok: true,
      ballId,
      alreadyLinked: !!data?.alreadyLinked,
      message: data?.alreadyLinked
        ? `이미 등록된 볼입니다 (${ballId})`
        : `입낚볼(${ballId}) 등록 완료`,
    };
  } catch {
    return { ok: false, ballId, message: "네트워크 오류가 발생했어요." };
  }
}

export function useNfc(options: Options = {}) {
  const { autoStart = false, enabled = true, onResult } = options;
  const [status, setStatus] = useState<NfcStatus>("unsupported");
  const [lastResult, setLastResult] = useState<NfcResult | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  /** 스캔 정리 함수 보관 */
  const cleanupRef = useRef<(() => void) | null>(null);
  /** 같은 태그가 연속 감지되는 것을 막기 위한 디바운스 */
  const lastTagRef = useRef<{ id: string; at: number } | null>(null);

  const handleTagId = useCallback(async (ballId: string) => {
    const now = Date.now();
    const prev = lastTagRef.current;
    // 같은 볼을 3초 안에 다시 읽으면 무시
    if (prev && prev.id === ballId && now - prev.at < 3000) return;
    lastTagRef.current = { id: ballId, at: now };

    const result = await registerBall(ballId);
    setLastResult(result);
    if (result.ok) await hapticSuccess();
    else await hapticError();
    onResultRef.current?.(result);
  }, []);

  /** 스캔 시작 */
  const start = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    // iOS 는 수동 입력 유지
    if (!isNativeRuntime() || getNativePlatform() === "ios") {
      setStatus("unsupported");
      return false;
    }
    if (cleanupRef.current) return true; // 이미 스캔 중

    // 1) Capacitor NFC 플러그인
    const { Nfc } = await importNfc();
    if (Nfc) {
      try {
        const supported = await Nfc.isSupported?.();
        if (supported && supported.supported === false) {
          setStatus("unsupported");
          return false;
        }
        await Nfc.startScanSession?.();
        const handle = await Nfc.addListener("nfcTagScanned", (event: any) => {
          const records = event?.nfcTag?.message?.records ?? event?.nfcTag?.records ?? [];
          for (const rec of records) {
            const id = decodeNdefText(rec);
            if (id) {
              void handleTagId(id.toUpperCase());
              return;
            }
          }
          // NDEF 메시지가 없으면 태그 시리얼(UID)을 볼 ID 로 사용
          const uid = event?.nfcTag?.id;
          if (Array.isArray(uid) && uid.length > 0) {
            const hex = uid.map((b: number) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
            void handleTagId(hex);
          }
        });
        cleanupRef.current = () => {
          try {
            void handle?.remove?.();
            void Nfc.stopScanSession?.();
          } catch {
            /* noop */
          }
        };
        setStatus("scanning");
        return true;
      } catch {
        setStatus("error");
        return false;
      }
    }

    // 2) Web NFC 폴백 (Android Chrome WebView)
    if (typeof window !== "undefined" && "NDEFReader" in window) {
      try {
        const controller = new AbortController();
        const reader = new (window as any).NDEFReader();
        await reader.scan({ signal: controller.signal });
        reader.onreading = (event: any) => {
          const records = event?.message?.records ?? [];
          for (const rec of records) {
            const id = decodeNdefText(rec);
            if (id) {
              void handleTagId(id.toUpperCase());
              return;
            }
          }
        };
        reader.onreadingerror = () => setStatus("error");
        cleanupRef.current = () => controller.abort();
        setStatus("scanning");
        return true;
      } catch {
        setStatus("error");
        return false;
      }
    }

    setStatus("unsupported");
    return false;
  }, [enabled, handleTagId]);

  /** 스캔 정지 */
  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStatus((s) => (s === "scanning" ? "idle" : s));
  }, []);

  // 지원 여부 초기 판별
  useEffect(() => {
    if (!enabled) return;
    if (!isNativeRuntime() || getNativePlatform() === "ios") {
      setStatus("unsupported");
      return;
    }
    let cancelled = false;
    (async () => {
      const { Nfc } = await importNfc();
      const webNfc = typeof window !== "undefined" && "NDEFReader" in window;
      if (!cancelled) setStatus(Nfc || webNfc ? "idle" : "unsupported");
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // autoStart — 지원 확인 후 자동 시작
  useEffect(() => {
    if (!autoStart || !enabled) return;
    if (status !== "idle") return;
    void start();
  }, [autoStart, enabled, status, start]);

  // 언마운트 시 스캔 정리
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return {
    status,
    isSupported: status !== "unsupported",
    isScanning: status === "scanning",
    lastResult,
    start,
    stop,
  };
}
