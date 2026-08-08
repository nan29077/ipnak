import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DUMMY_WALKING = [
  { dist: 3200, hours: 2.5, catchCount: 2, species: "배스", region: "경기", caption: "팔당 강변 3.2km 워킹 낚시! 배스 2마리 캐치 🐟" },
  { dist: 5800, hours: 4.0, catchCount: 4, species: "쏘가리", region: "강원", caption: "북한강 상류 5.8km 탐험! 쏘가리 손맛 4마리 👏" },
  { dist: 2100, hours: 1.5, catchCount: 1, species: "꺽지", region: "경기", caption: "경기 하천 가볍게 2.1km 워킹. 꺽지 깜짝 등장!" },
  { dist: 7400, hours: 5.5, catchCount: 7, species: "볼락", region: "거제", caption: "거제 갯바위 7.4km 탐방! 볼락 대박 7마리 🎉" },
  { dist: 4000, hours: 3.0, catchCount: 3, species: "농어", region: "인천", caption: "인천 방파제 4km 야간 워킹. 농어 3마리 입질!" },
  { dist: 1800, hours: 1.0, catchCount: 0, species: null, region: "충남", caption: "서해 방파제 1.8km 워킹... 오늘은 아쉽게 빈손 ㅠㅠ" },
  { dist: 6300, hours: 4.5, catchCount: 5, species: "배스", region: "경기", caption: "경기 한강 변 6.3km 장거리 워킹! 배스 5마리 대박 🎣" },
  { dist: 3500, hours: 2.5, catchCount: 2, species: "쏘가리", region: "경기", caption: "팔당호 3.5km 탐색! 쏘가리 미노우잉 성공" },
];

export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

    const anglers = await prisma.user.findMany({
      where: { role: "ANGLER" },
      take: 8,
      orderBy: { createdAt: "asc" },
    });

    if (anglers.length === 0) {
      return NextResponse.json({ error: "ANGLER 계정이 없습니다. 먼저 낚시꾼 회원 더미를 생성하세요." }, { status: 400 });
    }

    const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
    let created = 0;

    for (let i = 0; i < DUMMY_WALKING.length; i++) {
      const w = DUMMY_WALKING[i];
      const author = pick(anglers, i);

      const walkingData = JSON.stringify({
        distanceM: w.dist,
        durationMs: Math.round(w.hours * 3600 * 1000),
        catchCount: w.catchCount,
        spotCount: Math.floor(w.dist / 600),
        route: [],
      });

      await prisma.post.create({
        data: {
          authorId: author.id,
          kind: "WALKING",
          postType: "WALKING_FEED",
          caption: w.caption,
          body: walkingData,
          speciesName: w.species,
          region: w.region,
          visibility: "PUBLIC",
          hashtags: JSON.stringify(["워킹낚시", w.region, ...(w.species ? [w.species] : [])]),
          createdAt: new Date(Date.now() - i * 86400000),
        },
      });
      created++;
    }

    return NextResponse.json({ message: `워킹 피드 더미 ${created}개 생성 완료` });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
