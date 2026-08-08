import { NextResponse } from "next/server";
import { requireUser, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    /* 낚시단 리더는 바로 탈퇴할 수 없다.
       Group.leader 관계에 onDelete가 없어 삭제가 막히기도 하지만, 그보다
       리더가 사라진 낚시단을 남기거나 다른 회원의 글까지 지우는 쪽이 더 위험하다.
       무엇을 할지는 회원이 정하도록 안내만 한다. */
    const ledGroups = await prisma.group.findMany({
      where: { leaderId: user.id },
      select: { name: true },
    });
    if (ledGroups.length > 0) {
      const names = ledGroups.map((g) => `'${g.name}'`).join(", ");
      return NextResponse.json({
        error: `${names} 낚시단의 리더입니다. 다른 회원에게 리더를 넘기거나 낚시단을 삭제한 뒤 탈퇴해 주세요.`,
      }, { status: 409 });
    }

    /* IpnakBallOrder는 User 관계에 onDelete가 없어 남아 있으면 삭제가 막힌다.
       현재 주문(BallOrder)은 이미 회원 삭제 시 함께 지워지므로, 같은 성격의
       구 주문 데이터도 동일하게 정리한다. */
    await prisma.ipnakBallOrder.deleteMany({ where: { userId: user.id } });

    // 유저 삭제 (나머지 관련 데이터는 cascade로 정리)
    await prisma.user.delete({ where: { id: user.id } });

    // 삭제가 끝난 뒤에 세션을 파괴한다.
    // 순서가 반대면 삭제에 실패했을 때 로그아웃만 당하고 계정은 그대로 남는다.
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[auth/withdraw]", e);
    // 남은 연결 데이터 때문에 삭제가 막힌 경우 (외래키 제약)
    if (e?.code === "P2003" || e?.code === "P2014") {
      return NextResponse.json({
        error: "회원님과 연결된 데이터가 남아 있어 탈퇴할 수 없습니다. 고객센터로 문의해 주세요.",
      }, { status: 409 });
    }
    return NextResponse.json({ error: "탈퇴 처리에 실패했습니다." }, { status: 500 });
  }
}
