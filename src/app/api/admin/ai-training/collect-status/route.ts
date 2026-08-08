import { NextResponse } from "next/server";
import {
  EMPTY_COLLECT_STATE,
  KEY_COLLECT_HISTORY,
  KEY_COLLECT_STATE,
  type CollectHistoryItem,
  type CollectState,
  getTrainingStats,
  readJson,
  requireSuperAdmin,
  writeJson,
} from "@/lib/aiTraining";

export const dynamic = "force-dynamic";

/**
 * 수집 진행 상황 + 이력 + 현황 통계 조회
 * GET /api/admin/ai-training/collect-status
 *
 * 수집 탭이 1.5초 간격으로 폴링한다.
 */
export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const [state, history, stats] = await Promise.all([
    readJson<CollectState>(KEY_COLLECT_STATE, EMPTY_COLLECT_STATE),
    readJson<CollectHistoryItem[]>(KEY_COLLECT_HISTORY, []),
    getTrainingStats(),
  ]);

  return NextResponse.json({ state, history, stats });
}

/**
 * 멈춘 수집 작업 강제 해제
 * DELETE /api/admin/ai-training/collect-status
 *
 * 서버 재시작 등으로 running 플래그가 남아 새 수집이 막혔을 때 사용한다.
 */
export async function DELETE() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const state = await readJson<CollectState>(KEY_COLLECT_STATE, EMPTY_COLLECT_STATE);
  await writeJson(KEY_COLLECT_STATE, {
    ...state,
    running: false,
    message: "관리자가 수집 상태를 초기화했습니다.",
    updatedAt: new Date().toISOString(),
  } satisfies CollectState);

  return NextResponse.json({ ok: true });
}
