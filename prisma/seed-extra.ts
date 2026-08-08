// 입낚 개편용 추가(additive) 시드 — 기존 데이터를 지우지 않고 조행기(LOG)와
// 피싱태그 리퍼럴 데모 데이터를 보강한다.
//   실행:  npx tsx prisma/seed-extra.ts   (또는 npm run db:seed-extra)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const img = (s: string) => `https://picsum.photos/seed/${s}/900/675`;
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

const LOGS: { boardCategory: string; title: string; region: string; species: string; body: string }[] = [
  { boardCategory: "BOAT", species: "광어", region: "여수", title: "여수 선상 광어 다운샷 조행기 (10월 물때 추천)",
    body: "새벽 5시 출항. 들물 초입에 26~38cm 광어가 꾸준히 올라왔습니다.\n채비는 다운샷에 6인치 섀드웜, 봉돌 30호로 바닥을 살살 긁어주는 패턴이 잘 먹혔어요.\n중층보다 바닥 30cm가 핵심. 조류 빠를 때는 입질이 뚝 끊겼습니다.\n총 9마리, 최대 38cm로 마무리. 같이 가신 분들 모두 손맛 보고 왔습니다." },
  { boardCategory: "SEA_LURE", species: "농어", region: "포항", title: "포항 방파제 농어 루어 - 미노우 컬러 싸움",
    body: "해질녘 한 시간이 골든타임이었습니다. 처음엔 펄 컬러로 반응이 없다가 챠트백으로 바꾸자마자 첫 입질.\n70cm급 농어 한 마리 랜딩하고, 바늘털이로 두 마리 놓쳤네요.\n원투 후 슬로우 리트리브 + 가끔 트위칭이 주효했습니다." },
  { boardCategory: "FRESH_BASS", species: "배스", region: "대청호", title: "대청호 배스 - 가을 턴오버 시기 공략법",
    body: "수온 18도, 턴오버가 시작돼 입질 찾기가 까다로웠습니다.\n급경사 break line에서 텍사스리그 천천히 끌어주니 4짜 두 마리.\n얕은 곳은 거의 꽝, 깊은 곳 위주로 노려야 했습니다." },
  { boardCategory: "ROCK", species: "감성돔", region: "통영", title: "통영 갯바위 감성돔 찌낚시 첫 출조 후기",
    body: "벵에돔 시즌인 줄 알았는데 감성돔이 더 많이 붙었습니다.\n밑밥 품질 후 3~4번 던질 때부터 찌가 시원하게 빨려 들어가더군요.\n4짜 감성돔 포함 5수. 0.8호 목줄로 충분했습니다." },
  { boardCategory: "EGING", species: "무늬오징어", region: "제주", title: "제주 에깅 - 무늬오징어 사이즈가 미쳤습니다",
    body: "3.5호 에기로 시작. 캐스팅 후 충분히 가라앉힌 뒤 투 스텝 저킹.\n胴長 25cm 넘는 녀석들이 연속으로 올라왔어요.\n바람 부는 날이라 PE 0.6호에 리더 2호로 세팅했습니다." },
  { boardCategory: "SURF", species: "도다리", region: "군산", title: "군산 원투 - 초보도 잡는 도다리 포인트 공유",
    body: "백사장 원투로 도다리 노렸습니다. 청갯지렁이 미끼, 침선 주변 모래바닥이 포인트.\n입질이 약해서 끝보기 집중. 3마리지만 사이즈가 좋았습니다." },
  { boardCategory: "BOAT", species: "우럭", region: "속초", title: "속초 선상 우럭·열기 손맛 (가족 출조 추천)",
    body: "아이들과 함께한 선상낚시. 우럭 열기가 쉴 틈 없이 올라와 초보도 만선 분위기.\n전동릴 없이 핸드릴로도 충분했고, 멀미약은 필수입니다." },
  { boardCategory: "FRESH_CRUCIAN", species: "붕어", region: "안동호", title: "안동호 대물 붕어 - 밤낚시 떡밥 배합 노하우",
    body: "글루텐 단품보다 어분 살짝 섞은 배합이 입질 빈도가 좋았습니다.\n자정 넘어 4짜 붕어 두 수. 수심 2.5m 수초 언저리가 명당이었어요." },
  { boardCategory: "GEAR", species: "광어", region: "여수", title: "[장비리뷰] 광어 다운샷 입문 로드 3종 비교",
    body: "입문가 가성비 로드 3종을 한 달간 써본 후기입니다.\n감도, 허리힘, 무게를 표로 비교했고 개인적으로는 중간 모델이 밸런스가 가장 좋았습니다." },
  { boardCategory: "QNA", species: "참돔", region: "통영", title: "타이라바 참돔 - 등속 릴링이 안 되는데 팁 좀…",
    body: "타이라바 처음인데 자꾸 속도가 들쭉날쭉합니다.\n릴 핸들 한 바퀴를 ‘하나, 둘’ 박자로 세면서 감는 게 도움이 될까요? 고수님들 조언 부탁드려요." },
];

async function main() {
  const existingLogs = await (prisma as any).post.count({ where: { kind: "LOG" } });
  if (existingLogs > 0) {
    console.log(`조행기 ${existingLogs}건이 이미 있어 LOG 시드를 건너뜁니다.`);
  } else {
    const anglers = await prisma.user.findMany({ where: { role: { not: "SUPER_ADMIN" } }, take: 20 });
    const products = await prisma.product.findMany({ take: 20 });
    if (anglers.length === 0) { console.log("사용자가 없어 시드를 중단합니다. 먼저 npm run db:seed 를 실행하세요."); return; }

    const created: { id: string; authorId: string }[] = [];
    for (let i = 0; i < LOGS.length; i++) {
      const L = LOGS[i];
      const author = pick(anglers, i);
      const nImg = (i % 3) + 1; // 1~3장
      const post = await (prisma as any).post.create({
        data: {
          authorId: author.id, kind: "LOG", postType: "GENERAL",
          title: L.title, body: L.body, boardCategory: L.boardCategory,
          caption: L.title, speciesName: L.species, region: L.region,
          visibility: "PUBLIC", viewCount: 30 + Math.floor(Math.random() * 900),
          hashtags: JSON.stringify([L.region, L.species]),
          images: { create: Array.from({ length: nImg }, (_, k) => ({ url: img(`log-${i}-${k}`), alt: `${L.species} 조행 사진`, order: k })) },
          productTags: products.length
            ? { create: [{ productId: pick(products, i).id, posX: 0.4, posY: 0.5 }] }
            : undefined,
        },
      });
      created.push({ id: post.id, authorId: author.id });

      // 댓글 몇 개
      const cN = i % 4;
      for (let c = 0; c < cN; c++) {
        await prisma.comment.create({
          data: { postId: post.id, authorId: pick(anglers, i + c + 1).id, body: pick(["정보 감사합니다!", "저도 다음 주에 가보려구요", "사이즈 좋네요 👍", "채비 정보 도움됐어요"], c) },
        }).catch(() => {});
      }
      // 좋아요
      for (let l = 0; l < (i % 5); l++) {
        await prisma.like.create({ data: { postId: post.id, userId: pick(anglers, i + l + 2).id } }).catch(() => {});
      }
    }
    console.log(`조행기 ${created.length}건 생성 완료.`);

    // 피싱태그 리퍼럴 데모 이벤트 (클릭 + 일부 전환)
    const products2 = await prisma.product.findMany({ take: 10 });
    if (products2.length) {
      let clicks = 0, conv = 0;
      for (let i = 0; i < created.length; i++) {
        const p = created[i];
        const prod = pick(products2, i);
        const clickCount = 2 + (i % 4);
        for (let c = 0; c < clickCount; c++) {
          await (prisma as any).referralEvent.create({
            data: { postId: p.id, productId: prod.id, earnerId: p.authorId, type: "CLICK", source: "MOCK" },
          }).catch(() => {});
          clicks++;
        }
        if (i % 2 === 0) {
          const amount = prod.price || 50000;
          const reward = Math.round((amount * (prod.feeRate || 10)) / 100);
          await (prisma as any).referralEvent.create({
            data: { postId: p.id, productId: prod.id, earnerId: p.authorId, type: "CONVERSION", source: "MOCK", amount, reward, externalId: `seed_${i}` },
          }).catch(() => {});
          conv++;
        }
      }
      console.log(`리퍼럴 데모: 클릭 ${clicks}건, 전환 ${conv}건 생성.`);
    }
  }
  console.log("seed-extra 완료 ✅");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
