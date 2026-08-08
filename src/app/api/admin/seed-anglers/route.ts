import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const avatar = (i: number) => `https://i.pravatar.cc/200?img=${(i % 70) + 1}`;

const ANGLER_SEEDS = [
  { nick: "배스킹", email: "angler01@ipnak.test", region: "경기", bio: "경기도 배스낚시 매니아입니다 🎣" },
  { nick: "루어마스터", email: "angler02@ipnak.test", region: "서울", bio: "루어낚시 전문 10년차입니다" },
  { nick: "갯바위왕", email: "angler03@ipnak.test", region: "부산/울산/경남", bio: "남해 갯바위 전문 앵글러" },
  { nick: "쏘가리헌터", email: "angler04@ipnak.test", region: "강원", bio: "강원도 쏘가리 포인트를 모두 알고 있어요" },
  { nick: "에깅조사", email: "angler05@ipnak.test", region: "제주", bio: "무늬오징어 에깅 전문가 🦑" },
  { nick: "감성돔러버", email: "angler06@ipnak.test", region: "전북", bio: "서해 감성돔 찌낚시 매니아" },
  { nick: "선상킹", email: "angler07@ipnak.test", region: "통영", bio: "통영 선상낚시 고수입니다" },
  { nick: "민물조사", email: "angler08@ipnak.test", region: "충북", bio: "충청도 민물 포인트 탐험 중" },
  { nick: "워킹피셔", email: "angler09@ipnak.test", region: "강원", bio: "걸으면서 낚시하는 게 제일 좋아요 🚶" },
  { nick: "낚시고수99", email: "angler10@ipnak.test", region: "인천", bio: "인천 앞바다 원도권 전문" },
];

export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("Angler1234!", 10);
    let created = 0;

    for (let i = 0; i < ANGLER_SEEDS.length; i++) {
      const a = ANGLER_SEEDS[i];
      await prisma.user.upsert({
        where: { email: a.email },
        update: {},
        create: {
          email: a.email,
          passwordHash: hash,
          nickname: a.nick,
          role: "ANGLER",
          region: a.region,
          bio: a.bio,
          avatarUrl: avatar(i + 20),
        },
      });
      created++;
    }

    return NextResponse.json({ message: `낚시꾼 회원 더미 ${created}명 생성 완료` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
