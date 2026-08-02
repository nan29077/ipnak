/**
 * 대회 참가비 확인용 클라이언트 헬퍼.
 * 실제 차감은 서버(POST /api/tournaments/[id]/entries)가 판단한다 —
 * 여기서 받은 값은 "제출 전 확인 모달"을 띄울지 결정하는 용도로만 쓴다.
 */
export type EntryFeeInfo = {
  entryFee: number | null;
  reward1st: number | null;
  reward2nd: number | null;
  reward3rd: number | null;
  myEntryCount: number;
  /** 이번 제출에서 참가비가 실제로 차감되는지 (대회당 첫 제출에만 true) */
  willCharge: boolean;
  balance: number;
};

/** 조회 실패 시 null — 확인 모달 없이 그대로 진행한다(서버가 최종 검증). */
export async function fetchEntryFeeInfo(tournamentId: string): Promise<EntryFeeInfo | null> {
  try {
    const res = await fetch(`/api/tournaments/${tournamentId}/entries`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.willCharge === "boolean" ? (data as EntryFeeInfo) : null;
  } catch {
    return null;
  }
}

/** 확인 모달 문구 — "OO포인트가 차감됩니다. 계속하시겠습니까?" */
export function entryFeeConfirmText(info: EntryFeeInfo) {
  const fee = info.entryFee ?? 0;
  return {
    title: `${fee.toLocaleString()}포인트가 차감됩니다. 계속하시겠습니까?`,
    message: `보유 포인트 ${info.balance.toLocaleString()}P · 차감 후 ${Math.max(0, info.balance - fee).toLocaleString()}P`,
  };
}
