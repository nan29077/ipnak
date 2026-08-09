/**
 * 입낚볼 NFC 연동 서비스 (준비 코드)
 * - Web NFC API(NDEFReader) 기반 — Android Chrome 에서만 지원
 * - TODO: 입낚볼 정식 출시 후 활성화 (현재 UI 는 비활성/준비 중 상태로 노출)
 *
 * 태그 형식
 * - URL 태그(https://ipnak.kr/ball?id=BALL-000001)와 구형 텍스트 태그("IPNK-000001") 모두 지원한다.
 *   실제 해석은 parseTagPayload 가 담당하므로 안드로이드 기존 흐름은 그대로다.
 */
import { parseTagPayload, type TagKind } from "@/lib/nfcTag";

export type LinkedBall = {
  id: string;        // NFC 태그에서 읽은 볼 ID
  linkedAt: string;  // 연동 시각 (ISO)
};

export class NfcService {
  /** 현재 기기/브라우저가 Web NFC 를 지원하는지 */
  static async isSupported(): Promise<boolean> {
    return typeof window !== "undefined" && "NDEFReader" in window;
  }

  /**
   * 입낚볼 NFC 태그에서 볼 ID 읽기
   * TODO: 입낚볼 출시 후 활성화 — 현재는 준비 코드만 존재
   */
  static async readBallId(signal?: AbortSignal): Promise<string | null> {
    return (await this.readTag(signal))?.id ?? null;
  }

  /**
   * NFC 태그를 읽어 { kind, id } 로 돌려준다.
   * - URL 태그면 kind 가 "ball" | "keyring", 기존 텍스트 태그면 kind 는 null
   * - 레코드가 여러 개면 먼저 해석되는 것을 사용한다.
   */
  static async readTag(signal?: AbortSignal): Promise<{ kind: TagKind | null; id: string } | null> {
    if (!(await this.isSupported())) return null;
    try {
      const reader = new (window as any).NDEFReader();
      // signal 전달 시 abort 때 자동으로 스캔이 중단됨
      await reader.scan(signal ? { signal } : undefined);
      return await new Promise<{ kind: TagKind | null; id: string } | null>((resolve) => {
        if (signal) signal.addEventListener("abort", () => resolve(null), { once: true });
        reader.onreading = (event: any) => {
          try {
            const records = event.message?.records ?? [];
            for (const record of records) {
              // Web NFC 는 url/absolute-url 레코드를 이미 완성된 URL 문자열로 준다.
              const raw =
                typeof record?.data === "string"
                  ? record.data
                  : record?.data
                    ? new TextDecoder().decode(record.data)
                    : "";
              const parsed = parseTagPayload(raw);
              if (parsed) return resolve(parsed);
            }
            resolve(null);
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
}

export default NfcService;
