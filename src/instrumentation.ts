// Next.js 서버 기동 훅 (FastAPI 의 lifespan 에 해당).
// next.config.mjs 의 experimental.instrumentationHook 이 켜져 있어야 호출된다.
// 가상회원 활동 스케줄러를 여기서 한 번만 시작한다.

export async function register() {
  // 이 프로젝트에는 middleware(엣지 런타임)가 있어 instrumentation 이 엣지용으로도 컴파일된다.
  // 엣지 번들에는 node:crypto 를 쓰는 모듈(aiCredentials → virtualActivity → virtualScheduler)을
  // 넣을 수 없으므로, NEXT_RUNTIME 비교를 if 블록 안쪽에 두어 빌드 시점에 통째로 제거되게 한다.
  // (webpack 이 process.env.NEXT_RUNTIME 을 상수로 치환하므로 엣지 빌드에서는 죽은 코드가 된다.)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 빌드 단계(next build)에서는 스케줄러를 띄우지 않는다.
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    const { startVirtualScheduler } = await import("./lib/virtualScheduler");
    startVirtualScheduler();
  }
}
