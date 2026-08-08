/**
 * 입낚볼 QR / 딥링크 랜딩 페이지
 *
 * URL: /ball/[ballId]  예: /ball/BALL-000001
 * ※ NFC 태그 신규 표준은 쿼리형(/ball?id=BALL-000001) 이며 src/app/ball/page.tsx 가 처리한다.
 *   이 경로형은 기존 QR·구형 태그 호환용으로 남겨 둔다.
 *
 * 동작 흐름:
 * 1. 입낚볼에 인쇄된 QR 코드 스캔 또는 NFC URL 태그 읽기
 * 2. 이 페이지로 진입
 * 3. 로그인 상태이면 볼을 자동 등록하고 /settings 로 이동
 * 4. 미로그인이면 /login?redirect=/ball/[ballId] 로 이동 → 로그인 후 자동 등록
 *
 * 앱 패키징 딥링크 설정:
 * - Android: capacitor.config.ts 의 intentFilters 에 /ball 경로 등록됨
 * - iOS: Associated Domains (applinks:ipnak.com) + Xcode Universal Links 설정 필요
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BallQrPage({
  params,
}: {
  params: { ballId: string };
}) {
  const ballId = decodeURIComponent(params.ballId || "").trim().toUpperCase();
  if (!ballId) redirect("/settings");

  // ── 화이트리스트 검증: IpnakBallRegistry에 등록되고 isActive=1인 볼만 허용 ──
  const registryRows = await prisma.$queryRawUnsafe<[{ cnt: number }]>(
    `SELECT COUNT(*) as cnt FROM IpnakBallRegistry WHERE ballId = ? AND isActive = 1`,
    ballId
  );
  if (Number(registryRows[0]?.cnt ?? 0) === 0) {
    // 미등록·비활성 볼 → 안내 페이지로 이동
    redirect(`/ball-not-found?ballId=${encodeURIComponent(ballId)}`);
  }

  const user = await getCurrentUser();

  // 미로그인 → 로그인 후 이 페이지로 돌아와서 등록
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/ball/${ballId}`)}`);
  }

  // 이미 등록된 볼인지 확인
  const existing = await prisma.linkedBall.findUnique({
    where: { userId_ballId: { userId: user.id, ballId } },
  });

  // 미등록이면 자동 등록
  if (!existing) {
    await prisma.linkedBall.create({
      data: { userId: user.id, ballId },
    });
  }

  // 등록 완료 → 설정 페이지로 이동
  redirect("/settings");
}
