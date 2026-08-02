import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { applyPoints } from "@/lib/points";
import { effectiveStatus } from "@/lib/tournamentStatus";

// 한 사람이 한 대회에 남길 수 있는 제출 기록 상한 (스팸/랭킹 도배 방지)
const MAX_ENTRIES_PER_USER = 10;
// 계측 길이 상한 — 국내 낚시 대상어 기준 현실적인 최댓값
const MAX_SIZE_CM = 300;

/**
 * GET — 제출 직전 확인 모달용 참가비 정보.
 * 참가비는 "그 대회의 첫 제출"에만 차감되므로 이미 제출 이력이 있으면 willCharge=false.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const t = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { entryFee: true, reward1st: true, reward2nd: true, reward3rd: true },
  });
  if (!t) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  const [mine, me] = await Promise.all([
    prisma.tournamentEntry.count({ where: { tournamentId: params.id, userId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }),
  ]);
  const entryFee = t.entryFee ?? 0;
  return NextResponse.json({
    entryFee: t.entryFee, reward1st: t.reward1st, reward2nd: t.reward2nd, reward3rd: t.reward3rd,
    myEntryCount: mine,
    willCharge: entryFee > 0 && mine === 0,
    balance: me?.points ?? 0,
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  const t = await prisma.tournament.findUnique({ where: { id: params.id } });
  if (!t) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  // 대회 기간 검증 — status 컬럼은 어긋날 수 있으므로 startAt/endAt 를 기준으로 판단한다
  const now = new Date();
  const status = effectiveStatus(t, now);
  if (status === "UPCOMING") {
    return NextResponse.json({ error: "아직 시작하지 않은 대회입니다." }, { status: 400 });
  }
  if (status === "ENDED") {
    return NextResponse.json({ error: "종료된 대회에는 기록을 제출할 수 없습니다." }, { status: 400 });
  }

  // 길이 검증 — 0cm·음수·NaN·비현실적 값 차단
  const sizeCm = Number(b.sizeCm);
  if (!Number.isFinite(sizeCm) || sizeCm <= 0 || sizeCm > MAX_SIZE_CM) {
    return NextResponse.json({ error: "유효한 계측 길이(cm)가 필요합니다." }, { status: 400 });
  }

  // 어종 검증 — 기준어종이 지정된 대회는 해당 어종만 접수
  const submitted = typeof b.speciesName === "string" ? b.speciesName.trim() : "";
  if (t.speciesName) {
    const normalize = (s: string) => s.replace(/\s+/g, "");
    if (submitted && normalize(submitted) !== normalize(t.speciesName)) {
      return NextResponse.json({ error: `이 대회는 ${t.speciesName} 기록만 제출할 수 있습니다.` }, { status: 400 });
    }
  } else if (!submitted) {
    return NextResponse.json({ error: "어종을 선택해 주세요." }, { status: 400 });
  }
  const speciesName = t.speciesName ?? submitted;

  // 제출 상한 검증
  const mine = await prisma.tournamentEntry.count({ where: { tournamentId: t.id, userId: user.id } });
  if (mine >= MAX_ENTRIES_PER_USER) {
    return NextResponse.json(
      { error: `한 대회에는 최대 ${MAX_ENTRIES_PER_USER}건까지 제출할 수 있습니다.` },
      { status: 400 },
    );
  }

  const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));
  const num = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // 참가비는 대회당 1회(첫 제출)만 차감한다 — 같은 대회에 여러 건 올려도 중복 청구하지 않는다
  const entryFee = t.entryFee ?? 0;
  const chargeFee = entryFee > 0 && mine === 0;

  const entryData = {
    tournamentId: t.id, userId: user.id, speciesName,
    sizeCm, photoUrl: b.photoUrl || null, measuredImageUrl: b.measuredImageUrl || null,
    region: b.region || null, lat: num(b.lat), lng: num(b.lng), status: "REVIEW",
    originalImageUrl: b.originalImageUrl || null,
    calibrationStart: json(b.calibrationStart), calibrationEnd: json(b.calibrationEnd),
    calibrationLengthCm: num(b.calibrationLengthCm),
    fishHeadPoint: json(b.fishHeadPoint), fishTailPoint: json(b.fishTailPoint),
    measuredLengthCm: num(b.measuredLengthCm), confidence: num(b.confidence),
    tamperFlag: false,
  };

  try {
    const { entry, charged } = await prisma.$transaction(async (tx) => {
      let charged = 0;
      if (chargeFee) {
        // 차감 전 잔액 확인 — applyPoints 도 음수 잔액이면 throw 하지만, 사용자에게는 명확한 400 을 돌려준다
        const me = await tx.user.findUnique({ where: { id: user.id }, select: { points: true } });
        if ((me?.points ?? 0) < entryFee) throw new Error("INSUFFICIENT_POINTS");
        // 같은 대회에 동시에 두 번 제출해도 참가비가 두 번 빠지지 않도록 트랜잭션 안에서 한 번 더 확인한다
        const already = await tx.tournamentEntry.count({ where: { tournamentId: t.id, userId: user.id } });
        if (already === 0) {
          await applyPoints(tx, user.id, -entryFee, "SPEND", `대회 참가비 - ${t.title}`);
          charged = entryFee;
        }
      }
      // 실제로 차감된 금액만 돌려준다 — 동시 제출로 재확인에서 걸러진 경우 0
      return { entry: await tx.tournamentEntry.create({ data: entryData }), charged };
    });
    return NextResponse.json({ ok: true, id: entry.id, charged }, { status: 201 });
  } catch (e: any) {
    if (e?.message === "INSUFFICIENT_POINTS") {
      return NextResponse.json({ error: "포인트가 부족합니다." }, { status: 400 });
    }
    console.error("[tournaments/entries]", e);
    return NextResponse.json({ error: "참가 접수 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
