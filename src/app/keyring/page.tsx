/**
 * 입낚키링 NFC 태그 랜딩 — /keyring?id=KRING-000001
 * (/ball 과 완전히 동일한 분기 규칙, 테이블·라벨만 키링용)
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { normalizeTagId, resolveKeyringTag } from "@/lib/tagLanding";
import { TagLandingView } from "@/components/TagLandingView";

export const dynamic = "force-dynamic";

export default async function KeyringTagPage({
  searchParams,
}: {
  searchParams: { id?: string | string[] };
}) {
  const keyringId = normalizeTagId(searchParams?.id);
  if (!keyringId) redirect("/measure");

  const user = await getCurrentUser();

  // 미로그인 → 로그인 후 이 태그 주소로 되돌아온다
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/keyring?id=${keyringId}`)}`);
  }

  const status = await resolveKeyringTag(keyringId, user.id);

  // DB 조회 실패 → 오류 화면 대신 계측 화면으로 (태그 흐름을 끊지 않는다)
  if (status === "error") {
    redirect("/measure");
  }
  if (status === "invalid") {
    redirect(`/ball-not-found?ballId=${encodeURIComponent(keyringId)}&type=keyring`);
  }
  if (status === "mine") {
    redirect(`/measure?keyringId=${encodeURIComponent(keyringId)}&fromTag=1`);
  }

  return <TagLandingView kind="keyring" id={keyringId} status={status} />;
}
