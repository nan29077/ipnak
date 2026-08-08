/**
 * 입낚볼 / 입낚키링 서비스 스위치 조회 (공개)
 * - 클라이언트 컴포넌트(측정 페이지 등)가 볼·키링 UI 노출 여부를 판단할 때 사용한다.
 * - 판매 여부(가격 유무)와는 별개인 "서비스 자체" 스위치 값을 그대로 내려준다.
 *   (구매 바텀시트용 판매 설정은 /api/shop/ipnak-ball/products 의 config 를 쓴다)
 */
import { NextResponse } from "next/server";
import { getBoolSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [ballEnabled, keyringEnabled] = await Promise.all([
      getBoolSetting("ipnak_ball_enabled"),
      getBoolSetting("ipnak_keyring_enabled"),
    ]);
    return NextResponse.json({ ballEnabled, keyringEnabled });
  } catch {
    // 조회 실패 시 기존 동작(볼만 노출)을 유지한다.
    return NextResponse.json({ ballEnabled: true, keyringEnabled: false });
  }
}
