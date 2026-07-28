import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800`;

const DUMMY_FEEDS = [
  { caption: "오늘 새벽 출조! 안개 속 강가에서 배스 루어 삼매경 🎣 #배스낚시 #새벽출조", species: "배스", region: "경기" },
  { caption: "제주 우도 앞바다에서 감성돔 작렬 🐟 오늘 씨알 진짜 좋았습니다", species: "감성돔", region: "제주" },
  { caption: "팔당호 쏘가리 미노잉 성공! 42cm 대물 방생 완료 💪 #쏘가리 #루어낚시", species: "쏘가리", region: "경기" },
  { caption: "무늬오징어 에깅 시즌 개막! 첫 마리 등장 🦑 올해도 잘 부탁해~", species: "무늬오징어", region: "통영" },
  { caption: "주말 가족 낚시 나들이 🌊 아이도 첫 물고기 잡아서 너무 좋아했어요!", species: "붕어", region: "경기" },
  { caption: "밤낚시의 낭만... 별 보면서 낚시하는 행복 ✨ #야간낚시 #밤낚시", species: "잉어", region: "충남" },
  { caption: "친구들과 함께한 선상낚시! 고등어 대풍 🐟 쿨러 가득 채우고 왔습니다", species: "고등어", region: "인천" },
  { caption: "오랜만에 원투낚시 도전 🎣 모래사장에서 보내는 여유로운 오후", species: "보리멸", region: "부산" },
  { caption: "갯바위 볼락 야간낚시 대박! 씨알도 굵고 수도 많고 👌 #볼락 #야간낚시", species: "볼락", region: "거제" },
  { caption: "호수 위 가을빛... 낚시하기 정말 좋은 계절이 왔네요 🍂 #가을낚시", species: "배스", region: "강원" },
  { caption: "남해 방파제에서 삼치 지깅! 달려드는 손맛이 진짜 최고 💯", species: "삼치", region: "남해" },
  { caption: "5년 만에 최고 조황! 오늘은 진짜 신이 도왔나봐 🙏 방생 완료", species: "참돔", region: "제주" },
];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const anglers = await prisma.user.findMany({
      where: { role: "ANGLER" },
      take: 12,
      orderBy: { createdAt: "asc" },
    });

    if (anglers.length === 0) {
      return NextResponse.json({ error: "ANGLER 계정이 없습니다. 먼저 기본 더미 데이터를 생성하세요." }, { status: 400 });
    }

    const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
    let created = 0;

    for (let i = 0; i < DUMMY_FEEDS.length; i++) {
      const feed = DUMMY_FEEDS[i];
      const author = pick(anglers, i);

      const post = await prisma.post.create({
        data: {
          authorId: author.id,
          kind: "FEED",
          postType: "GENERAL",
          caption: feed.caption,
          speciesName: feed.species,
          region: feed.region,
          visibility: "PUBLIC",
          hashtags: JSON.stringify([feed.species, feed.region, "낚시"]),
          createdAt: new Date(Date.now() - i * 43200000),
        },
      });

      const imgCount = (i % 2) + 1;
      for (let k = 0; k < imgCount; k++) {
        await prisma.postImage.create({
          data: { postId: post.id, url: img(`feed-dummy-${i}-${k}`), alt: feed.caption.slice(0, 30), order: k },
        });
      }

      for (let l = 0; l < ((i % 5) + 1); l++) {
        const liker = pick(anglers, i + l + 1);
        if (liker.id !== author.id) {
          await prisma.like.create({ data: { postId: post.id, userId: liker.id } }).catch(() => {});
        }
      }

      created++;
    }

    return NextResponse.json({ message: `피드 더미 데이터 ${created}개 생성 완료` });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
