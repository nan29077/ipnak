import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { personalityLabel, regionGroupLabel } from "@/lib/virtualMembers";

export const dynamic = "force-dynamic";

// 개별 가상회원 활동 내역 조회 — 관리자 화면에서 회원 행을 펼칠 때 호출한다.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const member = await prisma.virtualMember.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, nickname: true, region: true, bio: true, avatarUrl: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!member) return NextResponse.json({ error: "가상회원을 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({
    member: {
      id: member.id,
      nickname: member.user.nickname,
      region: member.user.region,
      bio: member.user.bio,
      personality: member.personality,
      personalityLabel: personalityLabel(member.personality),
      regionGroupLabel: regionGroupLabel(member.regionGroup),
      active: member.active,
      activityCount: member.activityCount,
      lastActiveAt: member.lastActiveAt,
    },
    activities: member.activities.map((a) => ({
      id: a.id,
      kind: a.kind,
      targetType: a.targetType,
      targetId: a.targetId,
      summary: a.summary,
      createdAt: a.createdAt,
    })),
  });
}
