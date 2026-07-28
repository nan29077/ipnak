import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;

const DUMMY_LOGS = [
  {
    title: "통영 감성돔 찌낚시 후기 — 씨알 좋은 하루",
    boardCategory: "SEA",
    region: "통영",
    body: `새벽 5시에 출발해서 통영 연안 갯바위 포인트에 자리를 잡았습니다. 물때는 4물로 조류가 적당히 흘러줬고, 찌 내리자마자 감성돔이 쭉쭉 당겨주더라고요. 씨알은 35~42cm급 위주였고 총 4마리 손맛을 봤습니다. 채비는 0.5호 반유동 찌 + 2호 목줄 + 감성돔바늘 5호 조합이었어요.

포인트는 방파제 끝에서 서쪽 50m 지점, 수심 8m 정도 됩니다. 미끼는 크릴 새우를 사용했고 중간에 갯지렁이로 바꿔도 입질이 들어왔어요. 조황 좋은 날이었습니다!`,
    imageSeeds: ["log-sea-1", "log-sea-2"],
  },
  {
    title: "소양호 쏘가리 루어 조행기 — 미노우로 명품 손맛",
    boardCategory: "FRESHWATER",
    region: "춘천/화천",
    body: `소양호 쏘가리 시즌이 돌아왔습니다! 오늘은 친구 3명이서 함께 출조했는데 모두가 입질을 받아서 너무 행복한 하루였어요.

포인트는 소양호 상류 암반 지역, 수심 3~5m 구간에서 주로 입질이 왔습니다. 미노우 10cm 정도 사이즈에 반응이 좋았고, 색상은 차트 계열이 효과적이었어요. 루어를 천천히 저속으로 리트리브하면서 스톱&고 액션을 주니 쭉쭉 가져가더라고요. 제일 큰 씨알은 42cm급이었고, 대부분 30cm 이상이었습니다. 방생은 기본!`,
    imageSeeds: ["log-fresh-1"],
  },
  {
    title: "제주 방어 지깅 원정조행기 — 파도 속 혈투",
    boardCategory: "SEA",
    region: "제주",
    body: `제주 동쪽 포인트로 방어 지깅 원정을 다녀왔습니다. 선상 지깅 6시간 동안 정말 체력이 바닥났지만 그만한 보람이 있었어요.

방어 시즌답게 에코맵에 베이트가 층층이 쌓여있었고 그 아래로 방어들이 진을 치고 있더라고요. 메탈지그 150g~200g 위주로 사용했고, 수직 지깅보다 약간 흘려주는 방식이 더 효과적이었습니다. 하이스피드 원피치저크로 공략하니 힘차게 달려들었어요. 씨알은 4~7kg급, 최대 9kg 방어도 등장했습니다. 정말 잊을 수 없는 조행이었어요!`,
    imageSeeds: ["log-jeju-1", "log-jeju-2"],
  },
  {
    title: "강원도 내린천 어죽길 붕어 좌대 조행기",
    boardCategory: "JWADAE",
    region: "강원",
    body: `내린천 수계 좌대에서 붕어 밤낚시를 즐겼습니다. 한여름 밤 감성이란 이런 것이죠. 모기 한마리도 귀찮지 않을 정도로 입질이 폭발했어요.

좌대는 수심 약 2.5m 지점에 자리를 잡았고, 글루텐 미끼를 주로 사용했습니다. 어두워지자마자 찌가 아름답게 솟구쳐 올라오기 시작하더니 동이 틀 때까지 거의 쉬지 않고 입질이 들어왔어요. 4짜 붕어도 2마리나 나왔고, 평균 씨알도 좋았습니다. 다음에도 꼭 다시 오고 싶은 포인트입니다.`,
    imageSeeds: ["log-jwadae-1"],
  },
  {
    title: "거제 워킹 갯바위 볼락 야간 조행기",
    boardCategory: "WALKING",
    region: "거제",
    body: `거제 학동 쪽 갯바위를 워킹하면서 볼락 야간 낚시를 즐겼습니다. 라이트 타클로 즐기는 볼락 낚시의 매력은 뭐라도 설명이 안 돼요.

1.5g 지그헤드에 2인치 웜 조합으로 공략했고, 갯바위 사이사이 음영 지역을 집중 공략했습니다. 볼락은 15~25cm급이 주로 올라왔고, 손맛 보다가 문어도 한 마리 깜짝 등장! 정말 재미있는 야간 낚시였어요. 헤드랜턴은 필수입니다.`,
    imageSeeds: ["log-walking-1", "log-walking-2"],
  },
  {
    title: "남해 보팅 참돔 타이라바 조행기 — 명품 손맛",
    boardCategory: "BOATING",
    region: "남해",
    body: `남해 앞바다에서 소형 보트를 타고 참돔 타이라바 조행을 즐겼습니다. 잔잔한 날씨에 에코맵 보면서 포인트 찾아가는 게 이제 재미가 됐어요.

타이라바 80~100g 위주로 사용했고, 수심 30~45m 구간에서 주로 올라왔습니다. 헤드 색상은 오렌지와 레드 계열이 효과적이었고, 네크로 타입으로 교체 후 입질 빈도가 확연히 늘었어요. 참돔 1~2kg급 5마리, 그 외 쏨뱅이와 우럭도 올라왔습니다. 역시 타이라바는 손맛 최고입니다.`,
    imageSeeds: ["log-boating-1"],
  },
  {
    title: "팔당호 강낚시 — 배스와의 치열한 한판",
    boardCategory: "FRESHWATER",
    region: "경기",
    body: `팔당호 강변 포인트에서 배스 루어 낚시를 즐겼습니다. 평일 오전에 혼자 조용히 나갔다 왔는데 배스들이 너무 예민해서 좀 고생했어요.

4인치 웜 + 텍사스리그 조합으로 수초 경계선을 공략했고, 슬로우 하강 후 스테이 액션에 입질이 왔습니다. 배스는 30~42cm급 총 5마리, 모두 방생했어요. 맑은 물에서 배스 눈에 보이면서 루어 넣어주는 시각 낚시가 얼마나 짜릿한지! 다음엔 캐럴라이나 리그도 시도해볼 예정입니다.`,
    imageSeeds: ["log-bass-1", "log-bass-2"],
  },
  {
    title: "완도 갯바위 돌돔 조행기 — 대물의 저항",
    boardCategory: "SEA",
    region: "완도",
    body: `완도 청산도 갯바위에서 돌돔 전문 낚시를 즐겼습니다. 배를 타고 들어가는 게 번거롭지만 조황이 이걸 다 보상해줘요.

PE 5호 + 카본 목줄 25호의 강력한 채비로 갯바위 틈새를 공략했습니다. 미끼는 성게와 소라를 번갈아 사용했고, 성게에 더 반응이 좋았어요. 돌돔 50cm급이 올라왔을 때의 그 저항은 정말... 말로 표현할 수 없어요. 쭉쭉 당기는 힘이 대단했습니다. 귀중한 대물, 기념사진 찍고 방생!`,
    imageSeeds: ["log-dolddom-1"],
  },
  {
    title: "북한강 쏘가리 워킹낚시 — 가을 단풍과 함께",
    boardCategory: "WALKING",
    region: "가평",
    body: `가을 단풍이 절정인 북한강 상류에서 쏘가리 워킹 낚시를 즐겼습니다. 경치도 경치지만 조황도 훌륭했어요.

7cm 미노우로 여울 경계선과 수초 가장자리를 집중 공략했습니다. 쏘가리는 역시 수온이 내려가는 가을에 활성도가 최고더라고요. 35cm 이상 씨알 위주로 6마리 손맛을 봤고, 전부 방생했습니다. 단풍 구경하면서 걸어다니는 워킹낚시의 매력... 체력 소모는 있지만 정말 행복한 하루였어요.`,
    imageSeeds: ["log-walking-2"],
  },
  {
    title: "서천 방파제 삼치·고등어 가을 시즌 조행기",
    boardCategory: "SEA",
    region: "충남",
    body: `가을 청소라고들 하는 서천 방파제 삼치&고등어 시즌! 60명 넘는 낚시인들이 몰려있었는데 입질이 쉬지 않으니까 모두가 즐거운 분위기였어요.

40~60g 메탈지그로 원투 후 중속 리트리브, 삼치는 물 반 고기 반이라는 말이 딱 맞을 정도였습니다. 고등어는 사비키 채비로 추가로 잡았고 2~3마리씩 한 번에 올라오더라고요. 삼치는 날카로운 이빨에 손 베이지 않도록 꼭 장갑 착용하세요! 오늘 쿨러 가득 채우고 왔습니다.`,
    imageSeeds: ["log-samchi-1", "log-samchi-2"],
  },
];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    // 더미 사용자 가져오기 (ANGLER 역할 보유 유저 중 최대 10명)
    const anglers = await prisma.user.findMany({
      where: { role: "ANGLER" },
      take: 10,
      orderBy: { createdAt: "asc" },
    });

    if (anglers.length === 0) {
      return NextResponse.json({ error: "ANGLER 계정이 없습니다. 먼저 기본 더미 데이터를 생성하세요." }, { status: 400 });
    }

    const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

    let created = 0;
    for (let i = 0; i < DUMMY_LOGS.length; i++) {
      const log = DUMMY_LOGS[i];
      const author = pick(anglers, i);

      const post = await prisma.post.create({
        data: {
          authorId: author.id,
          kind: "LOG",
          postType: "GENERAL",
          title: log.title,
          body: log.body,
          boardCategory: log.boardCategory,
          region: log.region,
          visibility: "PUBLIC",
          hashtags: JSON.stringify(["조행기", log.region, log.boardCategory]),
          createdAt: new Date(Date.now() - i * 86400000 * 2),
        },
      });

      // 이미지 추가
      for (let k = 0; k < log.imageSeeds.length; k++) {
        await prisma.postImage.create({
          data: { postId: post.id, url: img(log.imageSeeds[k]), alt: log.title, order: k },
        });
      }

      // 좋아요 2~5개
      for (let l = 0; l < ((i % 4) + 2); l++) {
        const liker = pick(anglers, i + l + 1);
        if (liker.id !== author.id) {
          await prisma.like.create({ data: { postId: post.id, userId: liker.id } }).catch(() => {});
        }
      }

      // 댓글 1~2개
      const comments = [
        "정말 대단한 조황이네요! 포인트 정보 더 공유해주세요 🎣",
        "저도 거기 가보고 싶어요. 대중교통으로 가능한가요?",
        "씨알이 정말 좋네요! 부럽습니다 ㅎㅎ",
        "채비 정보 감사합니다. 다음에 따라 해볼게요!",
      ];
      const commenter = pick(anglers, i + 2);
      if (commenter.id !== author.id) {
        await prisma.comment.create({
          data: { postId: post.id, authorId: commenter.id, body: pick(comments, i) },
        });
      }

      created++;
    }

    return NextResponse.json({ message: `조행기 더미 데이터 ${created}개 생성 완료` });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
