import { IpnakPageLoader } from "@/components/IpnakLogoSpinner";

/**
 * Next.js 14 App Router에서 useSearchParams()를 Client Component에서 사용할 때
 * Suspense 경계가 없으면 서버·클라이언트 간 hydration mismatch 오류가 발생한다.
 * (NFC 태그 → redirect → /measure 진입 시: 서버는 searchParams 빈 값으로 렌더,
 *  클라이언트는 실제 URL(ballId, fromTag 포함)로 렌더 → 불일치 → global-error.tsx 발동)
 *
 * loading.tsx를 두면 Next.js가 자동으로 page.tsx를 Suspense로 감싸주어 이 문제가 해결된다.
 */
export default function MeasureLoading() {
  return <IpnakPageLoader />;
}
