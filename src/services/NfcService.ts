/**
 * 입낚볼 NFC 연동 서비스
 *
 * 지원 환경:
 * 1. Android Chrome (웹앱/TWA)  → Web NFC API (NDEFReader)
 * 2. Capacitor Android 앱       → @capacitor-community/nfc 플러그인
 * 3. Capacitor iOS 앱           → @capacitor-community/nfc 플러그인 (CoreNFC)
 * 4. 그 외 (iPhone Safari 등)   → 미지원, 수동 입력 유도
 *
 * 자동 감지 순서:
 * - window.Capacitor 존재 → Capacitor 플러그인 사용
 * - NDEFReader 존재        → Web NFC 사용
 * - 그 외                  → 미지원
 */

export type LinkedBall = {
  id: string;
  linkedAt: string;
};

// ── 환경 감지 ──────────────────────────────────────────────────

function isCapacitor(): boolean {
  return typeof window !== "undefined" && !!(window as any).Capacitor;
}

function hasWebNfc(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

// ── NDEF Text 레코드 디코딩 ────────────────────────────────────
// NDEF Text record payload 구조:
//   [0]       Status byte: bit7=UTF-16 flag, bit5-0=언어코드 길이
//   [1..n]    언어코드 (예: "en", "ko")
//   [n+1..]   실제 텍스트 (UTF-8 또는 UTF-16)

function decodeNdefText(payload: number[] | Uint8Array): string {
  const bytes = Array.isArray(payload) ? payload : Array.from(payload);
  if (bytes.length === 0) return "";
  const statusByte = bytes[0];
  const langLen = statusByte & 0x3f;
  const isUtf16 = !!(statusByte & 0x80);
  const textBytes = bytes.slice(1 + langLen);
  const encoding = isUtf16 ? "utf-16" : "utf-8";
  try {
    return new TextDecoder(encoding).decode(new Uint8Array(textBytes));
  } catch {
    return new TextDecoder("utf-8").decode(new Uint8Array(textBytes));
  }
}

// ── Capacitor NFC ──────────────────────────────────────────────

async function readBallIdCapacitor(): Promise<string | null> {
  try {
    // 동적 import — 웹 환경에서 플러그인이 없어도 번들 에러 방지
    const { NFC } = await import("@capacitor-community/nfc" as any);

    return new Promise<string | null>((resolve) => {
      let listenerHandle: any;

      const cleanup = () => {
        listenerHandle?.remove?.();
        NFC.stopScan?.().catch(() => {});
      };

      NFC.addListener("nfcTagScanned", (event: any) => {
        cleanup();
        try {
          const records = event?.ndefMessage?.records ?? [];
          if (records.length === 0) { resolve(null); return; }
          const record = records[0];
          const payload: number[] = record?.payload ?? [];
          // TNF 0x01 = Well-Known, type "T" = Text record
          const typeStr = record?.type
            ? new TextDecoder().decode(new Uint8Array(record.type))
            : "";
          if (typeStr === "T" || record?.tnf === 1) {
            resolve(decodeNdefText(payload) || null);
          } else {
            // URL 레코드나 기타 포맷 — payload 그대로 텍스트 변환 시도
            resolve(new TextDecoder().decode(new Uint8Array(payload)) || null);
          }
        } catch {
          resolve(null);
        }
      }).then((h: any) => { listenerHandle = h; });

      NFC.startScan({ messagesTypes: ["NDEF"] }).catch(() => {
        cleanup();
        resolve(null);
      });
    });
  } catch {
    // @capacitor-community/nfc 플러그인 미설치 시
    return null;
  }
}

// ── Web NFC (NDEFReader) ───────────────────────────────────────

async function readBallIdWebNfc(): Promise<string | null> {
  if (!hasWebNfc()) return null;
  try {
    const reader = new (window as any).NDEFReader();
    await reader.scan();
    return new Promise<string | null>((resolve) => {
      reader.onreading = (event: any) => {
        try {
          const record = event.message?.records?.[0];
          if (!record?.data) { resolve(null); return; }
          resolve(new TextDecoder().decode(record.data));
        } catch {
          resolve(null);
        }
      };
      reader.onreadingerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ── 공개 서비스 클래스 ─────────────────────────────────────────

export class NfcService {
  /**
   * 현재 환경에서 NFC 읽기가 가능한지 확인
   * - Capacitor 앱: NFC 활성화 여부 확인
   * - 웹 브라우저: Web NFC(NDEFReader) 지원 여부 확인
   */
  static async isSupported(): Promise<boolean> {
    if (isCapacitor()) {
      try {
        const { NFC } = await import("@capacitor-community/nfc" as any);
        const result = await NFC.isEnabled();
        return result?.isEnabled ?? false;
      } catch {
        // 플러그인 미설치 — 아직 웹 환경이면 Web NFC로 폴백
        return hasWebNfc();
      }
    }
    return hasWebNfc();
  }

  /**
   * 입낚볼 NFC 태그에서 볼 ID 읽기
   * 환경에 따라 Capacitor 플러그인 또는 Web NFC를 자동 선택
   */
  static async readBallId(): Promise<string | null> {
    if (isCapacitor()) {
      const result = await readBallIdCapacitor();
      // Capacitor 플러그인 실패 시 Web NFC로 폴백 (TWA/하이브리드 환경 대비)
      if (result === null && hasWebNfc()) return readBallIdWebNfc();
      return result;
    }
    return readBallIdWebNfc();
  }

  /**
   * 현재 실행 환경 식별 (디버깅/UI 분기용)
   */
  static getEnvironment(): "capacitor-android" | "capacitor-ios" | "web-nfc" | "unsupported" {
    if (isCapacitor()) {
      const platform = (window as any).Capacitor?.getPlatform?.() ?? "";
      return platform === "ios" ? "capacitor-ios" : "capacitor-android";
    }
    if (hasWebNfc()) return "web-nfc";
    return "unsupported";
  }
}

export default NfcService;
