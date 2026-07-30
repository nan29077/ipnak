import "server-only";
import { getVirtualActivityConfig, runVirtualActivityCycle } from "@/lib/virtualActivity";

// 가상회원 활동 스케줄러.
// Next.js 서버 프로세스 기동 시 instrumentation.ts(register)에서 한 번 시작하고,
// 5분마다 깨어나 "마지막 실행 이후 설정된 주기(시간)가 지났는지"를 확인해 활동을 실행한다.
//
// 고정 간격 타이머가 아니라 매 tick 마다 설정을 다시 읽는 방식이라
//  - 관리자가 주기·on/off 를 바꾸면 서버 재시작 없이 다음 tick 부터 반영되고,
//  - 마지막 실행 시각을 Setting 에 저장하므로 서버가 재시작돼도 주기가 초기화되지 않는다.

const TICK_MS = 5 * 60 * 1000; // 5분
const FIRST_TICK_DELAY_MS = 60 * 1000; // 기동 직후 부하를 피해 1분 뒤 첫 확인

// 개발 모드 HMR 로 모듈이 다시 평가돼도 타이머가 중복 등록되지 않도록 globalThis 에 보관한다.
const globalForScheduler = globalThis as unknown as {
  ipnakVirtualScheduler?: { timer: NodeJS.Timeout; running: boolean; lastSkipReason?: string };
};

async function tick() {
  const state = globalForScheduler.ipnakVirtualScheduler;
  // 앞선 사이클이 아직 돌고 있으면 이번 tick 은 건너뛴다(중복 생성 방지).
  if (!state || state.running) return;

  try {
    const config = await getVirtualActivityConfig();
    if (!config.enabled) return;

    const last = config.lastRun ? new Date(config.lastRun).getTime() : 0;
    const dueAt = last + config.intervalHours * 3600 * 1000;
    if (Number.isFinite(dueAt) && Date.now() < dueAt) return;

    state.running = true;
    const result = await runVirtualActivityCycle();
    if (result.ok) {
      state.lastSkipReason = undefined;
      console.log(
        `[virtual-activity] 사이클 완료 — 글 ${result.posts} / 댓글 ${result.comments} / 좋아요 ${result.likes} (호출 ${result.calls}, 잔여 ${result.remaining})`,
      );
    } else if (result.reason !== "disabled") {
      // 키 미등록·회원 없음·한도 소진은 상태가 바뀔 때까지 계속 유지된다.
      // 5분마다 같은 경고를 반복하지 않도록 사유가 바뀔 때만 기록한다.
      if (state.lastSkipReason !== result.reason) {
        state.lastSkipReason = result.reason;
        console.warn(`[virtual-activity] 사이클 건너뜀 — ${result.reason}`);
      }
    }
  } catch (e) {
    // 스케줄러가 죽으면 이후 활동이 멈추므로 어떤 예외도 밖으로 던지지 않는다.
    console.error("[virtual-activity] 사이클 오류", e);
  } finally {
    const s = globalForScheduler.ipnakVirtualScheduler;
    if (s) s.running = false;
  }
}

/** 스케줄러 시작 (이미 돌고 있으면 아무것도 하지 않는다) */
export function startVirtualScheduler() {
  if (globalForScheduler.ipnakVirtualScheduler) return;

  const timer = setInterval(() => { void tick(); }, TICK_MS);
  // 타이머 때문에 프로세스가 종료되지 않는 일이 없도록 참조를 해제한다.
  timer.unref?.();
  globalForScheduler.ipnakVirtualScheduler = { timer, running: false };

  const first = setTimeout(() => { void tick(); }, FIRST_TICK_DELAY_MS);
  first.unref?.();

  console.log("[virtual-activity] 스케줄러 시작 (5분 주기 확인)");
}

/** 스케줄러 중지 — 테스트·재기동 용도 */
export function stopVirtualScheduler() {
  const state = globalForScheduler.ipnakVirtualScheduler;
  if (!state) return;
  clearInterval(state.timer);
  globalForScheduler.ipnakVirtualScheduler = undefined;
}
