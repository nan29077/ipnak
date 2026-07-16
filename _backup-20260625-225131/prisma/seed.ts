import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  FRESH_ENVIRONMENTS, SEA_ENVIRONMENTS, FISHING_METHODS, ACCESS_STYLES,
  FRESH_SPECIES, SEA_SPECIES, PRODUCT_CATEGORIES, RESERVATION_CATEGORIES,
  KOREA_SPOTS,
} from "../src/lib/taxonomy";

const prisma = new PrismaClient();

const img = (seed: string, w = 800, h = 800) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
const avatar = (i: number) => `https://i.pravatar.cc/200?img=${(i % 70) + 1}`;
const pick = <T,>(a: T[], i: number) => a[i % a.length];
const rand = (min: number, max: number, i: number) => min + ((Math.sin(i * 9301 + 49297) + 1) / 2) * (max - min);

async function main() {
  console.log("🌊 입낚 seed 시작...");

  // 초기화
  await prisma.$transaction([
    prisma.postProductTag.deleteMany(), prisma.bookmark.deleteMany(), prisma.like.deleteMany(),
    prisma.comment.deleteMany(), prisma.shareEvent.deleteMany(), prisma.report.deleteMany(),
    prisma.postImage.deleteMany(), prisma.gearSetup.deleteMany(), prisma.catchRecord.deleteMany(),
    prisma.post.deleteMany(), prisma.fishingPoint.deleteMany(), prisma.routePoint.deleteMany(),
    prisma.fishingTrip.deleteMany(), prisma.tournamentEntry.deleteMany(), prisma.tournament.deleteMany(),
    prisma.booking.deleteMany(), prisma.reservationSlot.deleteMany(), prisma.reservationListing.deleteMany(),
    prisma.product.deleteMany(), prisma.follow.deleteMany(), prisma.notification.deleteMany(),
    prisma.banner.deleteMany(), prisma.adminLog.deleteMany(), prisma.session.deleteMany(),
    prisma.fishSpecies.deleteMany(), prisma.fishingCategory.deleteMany(), prisma.user.deleteMany(),
  ]);

  // ===== 분류 체계 =====
  let order = 0;
  const catRows: any[] = [];
  catRows.push({ slug: "freshwater", label: "민물낚시", kind: "MAIN", water: "FRESH", order: order++ });
  catRows.push({ slug: "saltwater", label: "바다낚시", kind: "MAIN", water: "SEA", order: order++ });
  FRESH_ENVIRONMENTS.forEach((l) => catRows.push({ slug: `fenv-${l}`, label: l, kind: "ENV", parent: "민물낚시", water: "FRESH", order: order++ }));
  SEA_ENVIRONMENTS.forEach((l) => catRows.push({ slug: `senv-${l}`, label: l, kind: "ENV", parent: "바다낚시", water: "SEA", order: order++ }));
  FISHING_METHODS.forEach((l) => catRows.push({ slug: `method-${l}`, label: l, kind: "METHOD", water: "BOTH", order: order++ }));
  ACCESS_STYLES.forEach((l) => catRows.push({ slug: `access-${l}`, label: l, kind: "ACCESS", water: "BOTH", order: order++ }));
  await prisma.fishingCategory.createMany({ data: catRows });

  let so = 0;
  await prisma.fishSpecies.createMany({
    data: [
      ...FRESH_SPECIES.map((l) => ({ slug: `sp-${l}`, label: l, water: "FRESH", order: so++ })),
      ...SEA_SPECIES.map((l) => ({ slug: `sp-${l}`, label: l, water: "SEA", order: so++ })),
    ],
  });
  console.log(`  분류 ${catRows.length}개, 어종 ${FRESH_SPECIES.length + SEA_SPECIES.length}개`);

  // ===== 사용자 =====
  const adminHash = await bcrypt.hash("Admin1234!", 10);
  const anglerHash = await bcrypt.hash("Angler1234!", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@ipnak.test", passwordHash: adminHash, nickname: "입낚운영자",
      role: "SUPER_ADMIN", avatarUrl: avatar(68), region: "서울",
      bio: "입낚 공식 운영자 계정입니다.", interests: JSON.stringify(["바다낚시", "대회"]),
    },
  });

  const nicknames = ["배스헌터", "쏘가리장인", "감성돔러버", "선상왕", "에깅마스터", "붕어신",
    "광어사냥꾼", "루어조사", "돌돔킹", "원투달인", "제주바다", "통영피싱"];
  const anglers = [];
  for (let i = 0; i < nicknames.length; i++) {
    const spot = pick(KOREA_SPOTS, i);
    const isFirst = i === 0;
    const u = await prisma.user.create({
      data: {
        email: isFirst ? "angler@ipnak.test" : `angler${i}@ipnak.test`,
        passwordHash: anglerHash,
        nickname: isFirst ? "낚시왕구영" : nicknames[i],
        role: "ANGLER", avatarUrl: avatar(i + 1), region: spot.name,
        bio: `${spot.name}에서 주로 낚시합니다. 어복 충만!`,
        interests: JSON.stringify([pick(["배스", "쏘가리", "감성돔", "무늬오징어"], i)]),
      },
    });
    anglers.push(u);
  }
  const angler = anglers[0];
  console.log(`  사용자 ${anglers.length + 1}명 (admin 포함)`);

  // ===== 팔로우 =====
  for (let i = 0; i < anglers.length; i++) {
    for (let j = 1; j <= 3; j++) {
      const target = anglers[(i + j) % anglers.length];
      if (target.id !== anglers[i].id) {
        await prisma.follow.create({ data: { followerId: anglers[i].id, followingId: target.id } }).catch(() => {});
      }
    }
  }

  // ===== 상품 (쇼핑 태그) =====
  const brands = ["다이와", "시마노", "바낙스", "엔에스", "메이저크래프트", "아부가르시아"];
  const productData = [
    "닉스팝 배스로드", "레인보우 베이트릴", "프리리그 채비세트", "XX웜 5인치", "도요 라그나 베이트릴",
    "선상 지깅로드", "타이라바 80g", "에깅 전용대 8.6ft", "무늬오징어 에기 3.5호", "광어 다운샷 봉돌",
    "쇼크리더 카본 20lb", "PE 합사 1.5호", "감성돔 찌세트", "원투 캐스팅대 4.5m", "벵에돔 빵가루 밑밥",
    "구명조끼 자동팽창식", "접이식 뜰채 5m", "디지털 계측자 1m", "대형 쿨러 25L", "방수 태클박스",
    "갯바위 신발 펠트", "루어 미노우 110mm", "스피너베이트 3/8oz", "크랭크베이트 딥다이버"];
  const products = [];
  for (let i = 0; i < productData.length; i++) {
    const cat = pick(PRODUCT_CATEGORIES, i);
    const p = await prisma.product.create({
      data: {
        sellerId: pick(anglers, i).id, name: productData[i], brand: pick(brands, i),
        category: cat.key, price: Math.round(rand(8000, 290000, i) / 1000) * 1000,
        imageUrl: img(`product-${i}`, 600, 600), buyUrl: "#",
        description: `${productData[i]} - ${cat.label} 추천 상품입니다.`, feeRate: 10,
      },
    });
    products.push(p);
  }
  console.log(`  상품 ${products.length}개`);

  // ===== 낚시 세션 + 동선 + 피싱 포인트 + Catch + 게시글 =====
  let postCount = 0, pointCount = 0;
  const allSpecies = [...FRESH_SPECIES, ...SEA_SPECIES];
  const visOpts = ["PUBLIC", "PUBLIC", "PUBLIC", "FOLLOWERS", "BLURRED"];
  const pointVis = ["EXACT", "EXACT", "BLUR_100", "BLUR_500", "PRIVATE"];

  for (let i = 0; i < anglers.length; i++) {
    const user = anglers[i];
    const spot = pick(KOREA_SPOTS, i);
    // 낚시 세션 2개
    for (let t = 0; t < 2; t++) {
      const startedAt = new Date(Date.now() - (i * 2 + t) * 86400000 - 14400000);
      const trip = await prisma.fishingTrip.create({
        data: {
          userId: user.id, title: `${spot.name} ${t === 0 ? "새벽" : "오후"} 출조`,
          startedAt, endedAt: new Date(startedAt.getTime() + 14400000),
          distanceM: Math.round(rand(800, 6000, i + t)), durationSec: 14400,
          catchCount: 2, topSpecies: pick(allSpecies, i), region: spot.name,
        },
      });
      // 동선 포인트
      const routeData = [];
      for (let r = 0; r < 12; r++) {
        routeData.push({
          tripId: trip.id, order: r,
          lat: spot.lat + Math.sin(r / 2) * 0.004 + r * 0.0006,
          lng: spot.lng + Math.cos(r / 2) * 0.004 + r * 0.0005,
          accuracy: rand(5, 25, r), recordedAt: new Date(startedAt.getTime() + r * 600000),
        });
      }
      await prisma.routePoint.createMany({ data: routeData });

      // 피싱 포인트 + catch + 게시글
      for (let c = 0; c < 1; c++) {
        const species = pick(allSpecies, i + t + c);
        const size = Math.round(rand(18, 62, i + t + c) * 10) / 10;
        const vis = pick(pointVis, i + t);
        const point = await prisma.fishingPoint.create({
          data: {
            userId: user.id, tripId: trip.id,
            lat: spot.lat + rand(-0.01, 0.01, i + t), lng: spot.lng + rand(-0.01, 0.01, i + c),
            accuracy: rand(5, 20, i), speciesName: species, sizeCm: size,
            photoUrl: img(`catch-${i}-${t}`), gearSetup: "로드/릴/프리리그/웜",
            region: spot.name, visibility: vis,
          },
        });
        const cr = await prisma.catchRecord.create({
          data: {
            userId: user.id, fishingPointId: point.id, speciesName: species,
            categoryPath: `${pick(["민물낚시", "바다낚시"], i)} > ${pick(FISHING_METHODS, i)}`,
            sizeCm: size, photoUrl: img(`catch-${i}-${t}`), shareToFeed: true,
            originalImageUrl: img(`catch-${i}-${t}`), measuredImageUrl: img(`catch-${i}-${t}`),
            calibrationStart: JSON.stringify({ x: 80, y: 400 }), calibrationEnd: JSON.stringify({ x: 280, y: 400 }),
            calibrationLengthCm: 30, fishHeadPoint: JSON.stringify({ x: 120, y: 250 }),
            fishTailPoint: JSON.stringify({ x: 600, y: 270 }), measuredLengthCm: size,
            confidence: Math.round(rand(78, 97, i) * 10) / 10, tamperFlag: false,
          },
        });
        await prisma.gearSetup.create({
          data: {
            catchRecordId: cr.id, rod: pick(productData, i), reel: pick(productData, i + 1),
            line: "PE 1.5호", leader: "카본 20lb", lure: pick(productData, i + 3),
            rig: pick(FISHING_METHODS, i), note: "조과 좋았던 채비",
          },
        });
        pointCount++;

        // 피싱 포인트 게시글
        const post = await prisma.post.create({
          data: {
            authorId: user.id, postType: "FISHING_POINT", fishingPointId: point.id,
            caption: `${spot.name}에서 ${species} ${size}cm! 채비는 ${pick(FISHING_METHODS, i)} 입니다 🎣`,
            speciesName: species, fishingType: pick(FISHING_METHODS, i),
            categoryPath: cr.categoryPath, sizeCm: size, region: spot.name,
            lat: point.lat, lng: point.lng, visibility: pick(visOpts, i + t),
            hashtags: JSON.stringify([spot.name, species, "입낚"]),
            createdAt: new Date(startedAt.getTime() + 13000000),
          },
        });
        await prisma.postImage.create({ data: { postId: post.id, url: img(`catch-${i}-${t}`), alt: `${species} 계측 사진`, order: 0 } });
        // 쇼핑 태그
        await prisma.postProductTag.create({ data: { postId: post.id, productId: pick(products, i).id, posX: 0.4, posY: 0.5 } });
        await prisma.postProductTag.create({ data: { postId: post.id, productId: pick(products, i + 5).id, posX: 0.7, posY: 0.6 } });
        postCount++;
      }
    }
  }

  // ===== 일반 게시글 (인스타형) =====
  const captions = [
    "오늘 날씨 최고. 손맛 제대로 봤습니다", "조용한 새벽 포인트, 입질 폭발", "동출 멤버들과 즐거운 하루",
    "장비 자랑 한번 해봅니다", "노을 지는 바다에서 한 컷", "오랜만에 대물 만났네요",
    "초보지만 열심히 배우는 중", "방생 완료, 다음에 또 보자", "이 포인트 진짜 명당입니다",
    "채비 세팅 끝, 출조 준비 완료", "월척 도전 성공!", "바람이 좀 불었지만 조과는 굿",
  ];
  for (let i = 0; i < 20; i++) {
    const user = pick(anglers, i + 3);
    const spot = pick(KOREA_SPOTS, i + 2);
    const species = pick(allSpecies, i + 5);
    const imgCount = (i % 3) + 1;
    const post = await prisma.post.create({
      data: {
        authorId: user.id, postType: "GENERAL", caption: pick(captions, i) + ` #${spot.name}`,
        speciesName: species, fishingType: pick(FISHING_METHODS, i), region: spot.name,
        lat: spot.lat, lng: spot.lng, visibility: pick(visOpts, i),
        sizeCm: i % 2 === 0 ? Math.round(rand(20, 55, i) * 10) / 10 : null,
        hashtags: JSON.stringify([spot.name, species]),
        createdAt: new Date(Date.now() - i * 43200000),
      },
    });
    for (let k = 0; k < imgCount; k++) {
      await prisma.postImage.create({ data: { postId: post.id, url: img(`feed-${i}-${k}`), alt: `낚시 사진 ${k + 1}`, order: k } });
    }
    if (i % 2 === 0) {
      await prisma.postProductTag.create({ data: { postId: post.id, productId: pick(products, i).id, posX: 0.5, posY: 0.4 } });
    }
    postCount++;
  }
  console.log(`  게시글 ${postCount}개, 피싱 포인트 ${pointCount}개`);

  // ===== 좋아요 / 댓글 / 저장 =====
  const allPosts = await prisma.post.findMany();
  const commentBodies = ["크기가 얼만한가요?", "파이팅!!!", "날씨 추운가요??", "포인트 정보 공유 가능할까요?",
    "와 대박이네요 👍", "저도 가보고 싶어요", "채비 정보 감사합니다", "어복 부럽습니다"];
  for (let i = 0; i < allPosts.length; i++) {
    const p = allPosts[i];
    for (let l = 0; l < (i % 7) + 1; l++) {
      await prisma.like.create({ data: { postId: p.id, userId: pick(anglers, i + l).id } }).catch(() => {});
    }
    for (let c = 0; c < (i % 3); c++) {
      const cm = await prisma.comment.create({
        data: { postId: p.id, authorId: pick(anglers, i + c + 1).id, body: pick(commentBodies, i + c) },
      });
      if (c === 0 && i % 4 === 0) {
        await prisma.comment.create({
          data: { postId: p.id, authorId: p.authorId, body: "감사합니다! 다음에 정보 공유드릴게요", parentId: cm.id },
        });
      }
    }
    if (i % 3 === 0) await prisma.bookmark.create({ data: { postId: p.id, userId: angler.id } }).catch(() => {});
  }

  // ===== 신고 mock =====
  for (let i = 0; i < 4; i++) {
    await prisma.report.create({
      data: { reporterId: pick(anglers, i).id, postId: pick(allPosts, i + 2).id, targetType: "POST",
        reason: pick(["스팸/광고", "부적절한 내용", "허위 정보", "낚시 포인트 분쟁"], i), status: "PENDING" },
    });
  }

  // ===== 대회 =====
  const now = new Date();
  const tournamentSeed = [
    { title: "6월 배스 주간전", type: "WEEKLY", species: "배스", status: "ONGOING", days: [-3, 4] },
    { title: "6월 쏘가리 월간전", type: "MONTHLY", species: "쏘가리", status: "ONGOING", days: [-12, 18] },
    { title: "감성돔 전국 챌린지", type: "MONTHLY", species: "감성돔", status: "UPCOMING", days: [7, 37] },
    { title: "돌돔 빅원 챌린지", type: "GRAND", species: "돌돔", status: "ONGOING", days: [-5, 25] },
    { title: "광어 선상 챌린지", type: "WEEKLY", species: "광어", status: "ENDED", days: [-20, -6] },
    { title: "무늬오징어 에깅 챌린지", type: "MONTHLY", species: "무늬오징어", status: "UPCOMING", days: [10, 40] },
  ];
  const tournaments = [];
  for (let i = 0; i < tournamentSeed.length; i++) {
    const ts = tournamentSeed[i];
    const t = await prisma.tournament.create({
      data: {
        title: ts.title, type: ts.type, speciesName: ts.species, status: ts.status,
        description: `${ts.species} 대상 온라인 낚시 대회입니다. 스마트 자로 계측한 사진을 제출하세요.`,
        rules: "1) 측정 사진 필수 2) 위치/장비 정보 포함 3) 길이 cm 기준 순위 4) 동점 시 먼저 등록한 순 5) 관리자 심사 후 승인",
        bannerUrl: img(`tour-${i}`, 1200, 500),
        startAt: new Date(now.getTime() + ts.days[0] * 86400000),
        endAt: new Date(now.getTime() + ts.days[1] * 86400000),
      },
    });
    tournaments.push(t);
    // 리더보드 엔트리
    const entryCount = 6 + (i % 4);
    for (let e = 0; e < entryCount; e++) {
      const entrySize = Math.round(rand(25, 68, i * 10 + e) * 10) / 10;
      await prisma.tournamentEntry.create({
        data: {
          tournamentId: t.id, userId: pick(anglers, e).id, speciesName: ts.species,
          sizeCm: entrySize,
          photoUrl: img(`entry-${i}-${e}`), measuredImageUrl: img(`entry-${i}-${e}`),
          region: pick(KOREA_SPOTS, e).name,
          lat: pick(KOREA_SPOTS, e).lat, lng: pick(KOREA_SPOTS, e).lng,
          status: e < 2 ? "REVIEW" : "APPROVED",
          // 스마트 룰러 측정 데이터
          originalImageUrl: img(`entry-${i}-${e}`),
          calibrationStart: JSON.stringify({ x: 80, y: 400 }),
          calibrationEnd: JSON.stringify({ x: 280, y: 400 }),
          calibrationLengthCm: 30,
          fishHeadPoint: JSON.stringify({ x: 120, y: 250 }),
          fishTailPoint: JSON.stringify({ x: 600, y: 270 }),
          measuredLengthCm: entrySize,
          confidence: Math.round(rand(78, 97, i * 10 + e) * 10) / 10,
          tamperFlag: false,
        },
      });
    }
  }
  console.log(`  대회 ${tournaments.length}개`);

  // ===== 예약 상품 =====
  const listingSeed = [
    { name: "여수 돌산 선장님 배낚시", cat: "BOAT", region: "여수", price: 80000, species: ["갈치", "참돔", "농어"] },
    { name: "통영 무늬오징어 에깅 가이드", cat: "GUIDE", region: "통영", price: 120000, species: ["무늬오징어"] },
    { name: "안동호 수상좌대 1박", cat: "SEAT", region: "안동호", price: 60000, species: ["붕어", "잉어"] },
    { name: "제주 갈치 선상 출조", cat: "BOAT", region: "제주", price: 150000, species: ["갈치", "고등어"] },
    { name: "대청호 붕어 유료터", cat: "PAID_POND", region: "대청호", price: 25000, species: ["붕어", "향어"] },
    { name: "남해 해상펜션 풀빌라", cat: "SEA_PENSION", region: "통영", price: 220000, species: ["볼락", "우럭"] },
    { name: "속초 동해 선상 지깅", cat: "BOAT", region: "속초", price: 130000, species: ["방어", "부시리"] },
    { name: "군산 새만금 낚시펜션", cat: "PENSION", region: "군산", price: 90000, species: ["우럭", "광어"] },
    { name: "포항 감성돔 갯바위 가이드", cat: "GUIDE", region: "포항", price: 110000, species: ["감성돔", "벵에돔"] },
    { name: "팔당 붕어 좌대터", cat: "SEAT", region: "팔당", price: 40000, species: ["붕어", "잉어"] },
    { name: "부산 기장 선상 참돔", cat: "BOAT", region: "부산", price: 100000, species: ["참돔", "농어"] },
    { name: "낙동강 배스 보트 가이드", cat: "GUIDE", region: "낙동강", price: 140000, species: ["배스"] },
  ];
  const listings = [];
  for (let i = 0; i < listingSeed.length; i++) {
    const ls = listingSeed[i];
    const spot = KOREA_SPOTS.find((s) => s.name === ls.region) ?? pick(KOREA_SPOTS, i);
    const l = await prisma.reservationListing.create({
      data: {
        ownerId: pick(anglers, i).id, name: ls.name, category: ls.cat, region: ls.region,
        address: `${ls.region} 일대`, lat: spot.lat, lng: spot.lng,
        imageUrl: img(`listing-${i}`, 1000, 700),
        images: JSON.stringify([img(`listing-${i}`, 1000, 700), img(`listing-${i}-2`, 1000, 700), img(`listing-${i}-3`, 1000, 700)]),
        description: `${ls.name} - 초보부터 전문가까지 즐길 수 있는 ${RESERVATION_CATEGORIES.find(c=>c.key===ls.cat)?.label} 입니다.`,
        targetSpecies: JSON.stringify(ls.species),
        amenities: JSON.stringify(["주차장", "화장실", "구명조끼 대여", "장비 대여", "식사 제공"]),
        services: JSON.stringify(["포인트 안내", "초보 강습", "사진 촬영"]),
        price: ls.price, maxPeople: 4 + (i % 8), cancelPolicy: "이용 3일 전 무료 취소",
        rating: Math.round(rand(40, 50, i)) / 10, reviewCount: Math.round(rand(5, 120, i)),
      },
    });
    listings.push(l);
    // 예약 슬롯
    for (let d = 1; d <= 14; d++) {
      await prisma.reservationSlot.create({
        data: { listingId: l.id, date: new Date(now.getTime() + d * 86400000),
          timeLabel: pick(["새벽 5시", "오전 6시", "오후 1시", "야간 7시"], i + d),
          capacity: 6, booked: d % 4 },
      });
    }
  }
  console.log(`  예약 상품 ${listings.length}개`);

  // ===== 예약 내역 =====
  const bookingStatus = ["REQUESTED", "CONFIRMED", "CONFIRMED", "DONE", "CANCELLED"];
  for (let i = 0; i < 6; i++) {
    const l = pick(listings, i);
    await prisma.booking.create({
      data: {
        listingId: l.id, userId: i < 3 ? angler.id : pick(anglers, i).id,
        date: new Date(now.getTime() + (i - 1) * 86400000), people: (i % 3) + 1,
        totalPrice: l.price * ((i % 3) + 1), status: pick(bookingStatus, i),
      },
    });
  }

  // ===== 배너 / 알림 =====
  await prisma.banner.createMany({
    data: [
      { title: "6월 배스 주간전 진행중!", body: "지금 참가하고 경품 받아가세요", imageUrl: img("banner-1", 1200, 400), order: 0 },
      { title: "신규 예약 상품 입점", body: "여수·통영·제주 선상 출조 오픈", imageUrl: img("banner-2", 1200, 400), order: 1 },
    ],
  });
  for (let i = 0; i < 5; i++) {
    await prisma.notification.create({
      data: { userId: angler.id, type: pick(["LIKE", "COMMENT", "FOLLOW", "TOURNAMENT"], i),
        body: pick(["회원님의 게시글에 좋아요가 달렸습니다", "새로운 댓글이 달렸습니다", "새 팔로워가 생겼습니다", "대회 결과가 발표되었습니다"], i),
        read: i > 2 },
    });
  }

  console.log("✅ seed 완료!");
  console.log("   관리자: admin@ipnak.test / Admin1234!");
  console.log("   낚시꾼: angler@ipnak.test / Angler1234!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
