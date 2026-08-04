/**
 * 입낚볼 NFC 연동 서비스 (준비 코드)
 * - Web NFC API(NDEFReader) 기반 — Android Chrome 에서만 지원
 * - TODO: 입낚볼 정식 출시 후 활성화 (현재 UI 는 비활성/준비 중 상태로 노출)
 */
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
  static async readBallId(): Promise<string | null> {
    if (!(await this.isSupported())) return null;
    try {
      const reader = new (window as any).NDEFReader();
      await reader.scan();
      return await new Promise<string | null>((resolve) => {
        reader.onreading = (event: any) => {
          try {
            const record = event.message?.records?.[0];
            if (!record?.data) return resolve(null);
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
}

export default NfcService;
