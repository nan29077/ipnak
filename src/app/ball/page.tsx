/**
 * 입낚볼 NFC 태그 랜딩 — /ball?id=BALL-000001
 *
 * 태그에 기록된 URL(https://ipnak.kr/ball?id=BALL-000001)로 진입한다.
 * 아이폰은 앱 없이도 NFC 태그의 URL 배너를 띄워주므로 이 경로가 아이폰 대응의 핵심이다.
 * (안드로이드는 기존처럼 앱 안에서 NFC 를 직접 읽는 흐름을 그대로 유지한다)
 *
 * 분기
 *   ID 없음/형식 오류 → /measure
 *   미등록·비활성 ID  → /ball-not-found
 *   비로그인          → /login?redirect=/ball?id=XXX
 *   내 볼             → /measure?ballId=XXX&fromTag=1  (계측 화면 즉시 진입)
 *   미등록 볼         → 등록 확인 화면
 *   타인 소유         → 안내 화면
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { normalizeTagId, resolveBallTag } from "@/lib/tagLanding";
import { TagLandingView } from "@/components/TagLandingView";

export const dynamic = "force-dynamic";

export default async function BallTagPage({
  searchParams,
}: {
  searchParams: { id?: string | string[] };
}) {
  const ballId = normalizeTagId(searchParams?.id);
  if (!ballId) redirect("/measure");

  const user = await getCurrentUser();

  // 미로그인 → 로그인 후 이 태그 주소로 되돌아온다
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/ball?id=${ballId}`)}`);
  }

  const status = await resolveBallTag(ballId, user.id);

  // DB 조회 실패 → 오류 화면 대신 계측 화면으로 (태그 흐름을 끊지 않는다)
  if (status === "error") {
    redirect("/measure");
  }
  if (status === "invalid") {
    redirect(`/ball-not-found?ballId=${encodeURIComponent(ballId)}`);
  }
  if (status === "mine") {
    redirect(`/measure?ballId=${encodeURIComponent(ballId)}&fromTag=1`);
  }

  return <TagLandingView kind="ball" id={ballId} status={status} />;
}
