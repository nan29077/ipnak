// 일상 피드(kind: "GENERAL") 더미 시드 — 기존 데이터를 지우지 않는 additive 스크립트.
//   실행:  npx tsx prisma/seed-general.ts   (또는 npm run db:seed-general)
//
// 멱등(idempotent): caption 이 같은 일상 피드 글이 이미 있으면 건너뛴다.
// 여러 번 돌려도 중복 생성되지 않는다.
//
// 주의: prisma/seed.ts 는 전체 테이블을 비우고 다시 심는 초기화 시드다.
//       이 파일은 그와 달리 기존 DB 위에 얹기만 한다.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800`;
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

// 일상 피드 성격 — 조과 자랑이 아니라 낚시를 둘러싼 소소한 이야기.
// hashtags 는 일부러 비운 글과 일반 태그만 붙인 글을 섞었다(일상 피드는 태그 강제가 아니다).
// daysAgo 로 작성 시각을 흩어 목록이 한 시점에 몰리지 않게 한다.
const GENERAL_FEEDS: {
  caption: string; region: string; hashtags: string[]; daysAgo: number; images: number;
}[] = [
  { caption: "출조 전날 밤이 제일 설레는 것 같아요. 채비 다 챙겨놓고 알람 세 개 맞춰뒀습니다 😴",
    region: "경기", hashtags: [], daysAgo: 0.4, images: 1 },
  { caption: "릴 오버홀 처음 해봤는데 생각보다 부품이 많네요... 다시 조립하니 나사 하나가 남았습니다 😅",
    region: "서울", hashtags: ["장비관리", "릴오버홀"], daysAgo: 1.2, images: 2 },
  { caption: "오늘은 꽝. 그래도 바람 시원하고 물멍 실컷 했으니 본전은 뽑았다고 생각합니다",
    region: "인천", hashtags: [], daysAgo: 2.5, images: 1 },
  { caption: "아버지 환갑 선물로 낚싯대 한 대 사드렸어요. 같이 다닐 생각에 벌써 신납니다",
    region: "대전/충남", hashtags: ["가족낚시"], daysAgo: 3.8, images: 1 },
  { caption: "새벽 다섯 시 편의점 커피 한 잔. 낚시인의 아침은 여기서 시작되죠 ☕",
    region: "강원", hashtags: ["새벽출조"], daysAgo: 5.1, images: 1 },
  { caption: "태클박스 정리하다가 3년 전에 산 루어를 발견했습니다. 포장도 안 뜯었네요...",
    region: "부산/울산/경남", hashtags: [], daysAgo: 6.6, images: 2 },
  { caption: "비 예보 보고 출조 취소했는데 하루 종일 맑았습니다. 이런 날이 제일 억울해요 ☔",
    region: "전북", hashtags: ["출조계획"], daysAgo: 8.3, images: 1 },
  { caption: "낚시 시작한 지 딱 100일 됐습니다. 아직 초보지만 매주 나가는 재미로 살고 있어요 🎣",
    region: "광주/전남", hashtags: ["낚시입문", "100일"], daysAgo: 10.0, images: 1 },
  { caption: "차 트렁크가 어느새 낚시 창고가 됐습니다. 아내가 한마디 하기 전에 정리해야겠어요",
    region: "경기", hashtags: [], daysAgo: 12.4, images: 2 },
  { caption: "동출 멤버 구합니다! 주말 새벽에 조용히 낚시하실 분 편하게 댓글 주세요",
    region: "충북", hashtags: ["동출구함"], daysAgo: 14.7, images: 1 },
  { caption: "손질하고 회 떠서 가족들이랑 나눠 먹었습니다. 직접 잡은 거라 그런지 더 맛있네요",
    region: "제주", hashtags: ["집밥"], daysAgo: 17.2, images: 2 },
  { caption: "장화에 구멍 난 걸 물에 들어가서야 알았습니다. 하루 종일 발이 축축했어요 🥲",
    region: "대구/경북", hashtags: [], daysAgo: 20.5, images: 1 },
  { caption: "낚시 갔다가 쓰레기 한 봉지 주워 왔습니다. 다들 왔던 자리는 깨끗하게 부탁드려요",
    region: "강원", hashtags: ["환경정화", "클린낚시"], daysAgo: 24.1, images: 1 },
  { caption: "요즘 유튜브로 매듭법 공부 중인데 FG노트가 제일 어렵네요. 손가락에 쥐 납니다",
    region: "서울", hashtags: ["매듭법"], daysAgo: 28.9, images: 1 },
];

async function main() {
  console.log("🌤  일상 피드(GENERAL) 시드 시작...");

  // 작성자 후보 — 가상회원은 글로벌 스위치가 OFF 면 목록에서 숨겨지므로 제외한다.
  const anglers = await prisma.user.findMany({
    where: { role: "ANGLER", virtualMember: { is: null } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, nickname: true },
  });
  if (anglers.length === 0) {
    console.log("❌ 작성자로 쓸 ANGLER 계정이 없습니다. 먼저 npm run db:seed 를 실행하세요.");
    return;
  }
  console.log(`  작성자 후보 ${anglers.length}명`);

  // 이미 심어둔 글은 caption 으로 걸러낸다 (재실행 시 중복 생성 방지)
  const existing = await prisma.post.findMany({
    where: { kind: "GENERAL", caption: { in: GENERAL_FEEDS.map((f) => f.caption) } },
    select: { caption: true },
  });
  const done = new Set(existing.map((e) => e.caption));

  let created = 0, skipped = 0;
  for (let i = 0; i < GENERAL_FEEDS.length; i++) {
    const feed = GENERAL_FEEDS[i];
    if (done.has(feed.caption)) { skipped++; continue; }

    const author = pick(anglers, i); // 후보를 한 명씩 차례로 써서 작성자가 겹치지 않게 한다
    const createdAt = new Date(Date.now() - feed.daysAgo * 86400000);

    const post = await prisma.post.create({
      data: {
        authorId: author.id,
        kind: "GENERAL",
        postType: "GENERAL",
        caption: feed.caption,
        region: feed.region,
        visibility: "PUBLIC",
        hashtags: JSON.stringify(feed.hashtags),
        createdAt,
        images: {
          create: Array.from({ length: feed.images }, (_, k) => ({
            url: img(`general-feed-${i}-${k}`),
            alt: feed.caption.slice(0, 30),
            order: k,
          })),
        },
      },
    });

    // 좋아요 0~5개
    for (let l = 0; l < i % 6; l++) {
      const liker = pick(anglers, i + l + 2);
      if (liker.id !== author.id) {
        await prisma.like.create({ data: { postId: post.id, userId: liker.id } }).catch(() => {});
      }
    }
    // 댓글 0~2개
    const bodies = ["ㅋㅋㅋ 저도 그랬어요", "공감합니다 👍", "다음엔 꼭 손맛 보시길!", "좋은 하루 되세요~"];
    for (let c = 0; c < i % 3; c++) {
      const writer = pick(anglers, i + c + 4);
      if (writer.id !== author.id) {
        await prisma.comment.create({
          data: { postId: post.id, authorId: writer.id, body: pick(bodies, i + c) },
        }).catch(() => {});
      }
    }
    created++;
  }

  const total = await prisma.post.count({ where: { kind: "GENERAL" } });
  console.log(`  신규 ${created}건 / 기존 중복 건너뜀 ${skipped}건`);
  console.log(`✅ 일상 피드 총 ${total}건`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
