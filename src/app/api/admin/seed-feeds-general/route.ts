import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800`;

const DUMMY_GENERAL = [
  { caption: "오늘 낚시 장비 정리 완료! 릴 오일링하고 라인도 새로 감았어요 💪 #장비정리 #출조준비", region: "경기" },
  { caption: "낚시터 가는 길에 찍은 새벽 풍경... 이 맛에 새벽 출조하는 거죠 🌅 #새벽낚시 #일출", region: "강원" },
  { caption: "드디어 새 낚싯대 언박싱! 시마노 스텔라 C3000 구입했습니다 🎁 #신장비 #릴언박싱", region: "서울" },
  { caption: "주말에 같이 출조하실 분 구합니다~ 경기도 팔당 쪽 포인트 동출 가능하신 분! #동출구함 #팔당", region: "경기" },
  { caption: "이번 주 날씨 보니 낚시하기 딱 좋을 것 같아요 ⛅ 여러분은 어디 가세요? #낚시날씨 #출조계획", region: "인천" },
  { caption: "아이와 함께한 첫 낚시! 처음으로 물고기 잡아서 너무 좋아했어요 😊 #가족낚시 #아이낚시", region: "경기" },
  { caption: "낚시 입문한 지 딱 1년 됐습니다! 짧은 기간 동안 정말 많이 배웠어요 🎣 #낚시1년 #낚시입문", region: "서울" },
  { caption: "오늘 낚시 유튜브 영상 올렸어요~ 많은 응원 부탁드립니다! 🎬 #낚시유튜버 #낚시채널", region: "부산/울산/경남" },
  { caption: "태클박스 정리했더니 루어가 이렇게 많았네요 😅 낚시하다 보면 자꾸 사게 되는 마성의 루어들", region: "대구/경북" },
  { caption: "비 오는 날 낚시... 우중 낚시의 낭만이 있잖아요 ☔🎣 #우중낚시 #빗속낚시", region: "충남" },
  { caption: "낚시 포인트 비밀 공유! 이 포인트에서 항상 잘 잡힙니다 👀 (위치는 DM으로~) #비밀포인트", region: "전북" },
  { caption: "새로 구입한 루어 첫 실전 테스트! 기대 이상의 성능이에요 ✨ #루어테스트 #신상루어", region: "제주" },
];

export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

    const anglers = await prisma.user.findMany({
      where: { role: "ANGLER" },
      take: 12,
      orderBy: { createdAt: "asc" },
    });

    if (anglers.length === 0) {
      return NextResponse.json({ error: "ANGLER 계정이 없습니다. 먼저 낚시꾼 회원 더미를 생성하세요." }, { status: 400 });
    }

    const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
    let created = 0;

    for (let i = 0; i < DUMMY_GENERAL.length; i++) {
      const feed = DUMMY_GENERAL[i];
      const author = pick(anglers, i);

      const post = await prisma.post.create({
        data: {
          authorId: author.id,
          kind: "FEED",
          postType: "GENERAL",
          caption: feed.caption,
          region: feed.region,
          visibility: "PUBLIC",
          hashtags: JSON.stringify(["일상피드", feed.region, "낚시일상"]),
          createdAt: new Date(Date.now() - i * 36000000),
        },
      });

      const imgCount = (i % 2) + 1;
      for (let k = 0; k < imgCount; k++) {
        await prisma.postImage.create({
          data: { postId: post.id, url: img(`gen-feed-${i}-${k}`), alt: feed.caption.slice(0, 30), order: k },
        });
      }

      // 좋아요
      for (let l = 0; l < ((i % 6) + 1); l++) {
        const liker = pick(anglers, i + l + 1);
        if (liker.id !== author.id) {
          await prisma.like.create({ data: { postId: post.id, userId: liker.id } }).catch(() => {});
        }
      }

      created++;
    }

    return NextResponse.json({ message: `일상 피드 더미 ${created}개 생성 완료` });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
