import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/700/700`;
const avatar = (i: number) => `https://i.pravatar.cc/200?img=${(i % 70) + 1}`;

const TITLES = [
  "다이와 루비아스 LT2500 거의 새것", "시마노 스텔라 C3000 풀박스", "메이저크래프트 배스로드 1.6m",
  "아부가르시아 레보 베이트릴 미사용", "무늬오징어 에기 세트 12개", "갯바위 웨이더 270mm",
  "선상 지깅대 + 릴 풀세트", "구명조끼 자동팽창 미사용", "쿨러 25L 아이스박스 양호",
  "휴대용 어탐기 가민 에코맵", "PE 합사 1.5호 300m 새제품", "감성돔 찌낚시 세트",
  "루어 미노우 모음 20개", "접이식 뜰채 5m 신품", "방수 태클박스 대형",
  "에깅 전용대 8.6ft 윤성", "원투 캐스팅대 4.5m", "시마노 뱅퀴시 2500S 미사용",
  "다이와 솔티가 6500H 지깅릴", "참돔 타이라바 헤드 80g 세트",
];
const CATEGORIES = ["ROD","REEL","LURE","WORM","LINE","WADER","TACKLEBOX","COOLER","LIFEVEST","APPAREL","ELECTRONICS","ETC"];
const REGIONS = ["서울","경기","인천","강원","충북","대전/충남","대구/경북","부산/울산/경남","전북","광주/전남","제주"];
const CONDITIONS = ["NEW","USED","USED","USED","NEW"];
const STATUSES = ["SELLING","SELLING","SELLING","RESERVED","SOLD"];
const MESSAGES = [
  ["안녕하세요, 아직 판매하시나요?", "네 판매중입니다! 직거래 가능하세요?", "넵 이번 주말에 가능합니다 :)"],
  ["최저가 가능한가요?", "최대한 맞춰드릴게요. 어느 정도 생각하세요?", "10% 정도 할인 부탁드려요!"],
  ["사진 추가로 보내주실 수 있나요?", "네 카톡으로 보내드릴게요!", "감사합니다~"],
];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function rand(min: number, max: number, i: number): number {
  return min + ((Math.sin(i * 9301 + 49297) + 1) / 2) * (max - min);
}

export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인 필요" }, { status: 401 }); }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  try {
    // ===== 기존 "더미" 데이터만 삭제 =====
    // 실제 회원이 올린 중고마켓 글을 지우지 않도록, @ipnak.test 더미 계정의 판매글로 한정한다.
    const dummyUsers = await prisma.user.findMany({
      where: { email: { endsWith: "@ipnak.test" } },
      select: { id: true },
    });
    const dummyIds = dummyUsers.map((u) => u.id);
    if (dummyIds.length > 0) {
      await prisma.$transaction([
        prisma.marketMessage.deleteMany({ where: { chat: { listing: { sellerId: { in: dummyIds } } } } }),
        prisma.marketChat.deleteMany({ where: { listing: { sellerId: { in: dummyIds } } } }),
        prisma.marketFavorite.deleteMany({ where: { listing: { sellerId: { in: dummyIds } } } }),
        prisma.marketImage.deleteMany({ where: { listing: { sellerId: { in: dummyIds } } } }),
        prisma.marketListing.deleteMany({ where: { sellerId: { in: dummyIds } } }),
      ]);
    }

    // ===== 판매자 계정 준비 (없으면 생성) =====
    const SELLER_EMAILS = [
      "seller1@ipnak.test", "seller2@ipnak.test", "seller3@ipnak.test",
      "seller4@ipnak.test", "seller5@ipnak.test",
    ];
    const SELLER_NICKS = ["배스헌터", "에깅마스터", "감성돔러버", "선상왕", "루어조사"];

    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("Seller1234!", 10);

    const sellers = [];
    for (let i = 0; i < SELLER_EMAILS.length; i++) {
      const s = await prisma.user.upsert({
        where: { email: SELLER_EMAILS[i] },
        update: {},
        create: {
          email: SELLER_EMAILS[i], passwordHash: hash,
          nickname: SELLER_NICKS[i], role: "ANGLER",
          avatarUrl: avatar(i + 10),
          region: pick(REGIONS, i),
          bio: `${pick(REGIONS, i)}에서 주로 낚시합니다.`,
        },
      });
      sellers.push(s);
    }

    // ===== 구매자 계정 준비 =====
    const buyer = await prisma.user.upsert({
      where: { email: "buyer@ipnak.test" },
      update: {},
      create: {
        email: "buyer@ipnak.test", passwordHash: hash,
        nickname: "낚시왕구영", role: "ANGLER",
        avatarUrl: avatar(1), region: "서울",
      },
    });

    // ===== 중고 판매글 20개 생성 =====
    let count = 0;
    for (let i = 0; i < TITLES.length; i++) {
      const seller = pick(sellers, i);
      const imgCount = (i % 3) + 1;
      const price = Math.round(rand(8000, 380000, i + 7) / 1000) * 1000;

      const listing = await prisma.marketListing.create({
        data: {
          sellerId: seller.id,
          title: TITLES[i],
          category: pick(CATEGORIES, i),
          condition: pick(CONDITIONS, i),
          price,
          region: pick(REGIONS, i),
          description: `${TITLES[i]}\n\n상태 양호합니다. 직거래/택배 모두 가능해요.\n구매 후 거의 사용하지 않아 새것과 다름없습니다.\n사진 추가 요청 주세요.`,
          status: pick(STATUSES, i),
          viewCount: Math.round(rand(3, 180, i)),
          images: {
            create: Array.from({ length: imgCount }, (_, k) => ({
              url: img(`mkt-${i}-${k}`),
              order: k,
            })),
          },
        },
      });

      // 찜
      for (let f = 0; f < (i % 4); f++) {
        const fan = pick(sellers, i + f + 1);
        if (fan.id !== seller.id) {
          await prisma.marketFavorite.create({ data: { listingId: listing.id, userId: fan.id } }).catch(() => {});
        }
      }

      // 채팅 + 메시지
      if (i % 3 === 0 && buyer.id !== seller.id) {
        const msgs = pick(MESSAGES, i);
        const chat = await prisma.marketChat.create({ data: { listingId: listing.id, buyerId: buyer.id } });
        await prisma.marketMessage.create({ data: { chatId: chat.id, senderId: buyer.id, body: msgs[0] } });
        await prisma.marketMessage.create({ data: { chatId: chat.id, senderId: seller.id, body: msgs[1] } });
        await prisma.marketMessage.create({ data: { chatId: chat.id, senderId: buyer.id, body: msgs[2] } });
      }

      count++;
    }

    return NextResponse.json({ ok: true, count, message: `중고 판매글 ${count}개 생성 완료` });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
