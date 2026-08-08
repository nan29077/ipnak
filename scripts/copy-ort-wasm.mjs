/**
 * onnxruntime-web 런타임 파일을 public/ort 로 복사한다.
 *
 * 입낚은 onnxruntime-web 을 번들에 넣지 않고 브라우저가 런타임에 직접 로드한다.
 * 이 스크립트를 실행해 두면 `/ort/` 를 자체 호스팅 경로로 쓰고,
 * 없으면 자동으로 jsDelivr CDN 에서 받아온다 (웹에서는 별도 설정 불필요).
 *
 * Capacitor 앱처럼 **오프라인에서도 YOLO 추론이 동작해야 하는 빌드**에서는
 * 반드시 이 스크립트를 실행하세요.
 *
 * 사용: npm run yolo:wasm
 */
import { mkdir, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
const DEST = join(process.cwd(), "public", "ort");

if (!existsSync(SRC)) {
  console.error("[yolo:wasm] onnxruntime-web 이 설치되어 있지 않습니다. npm install 후 다시 실행하세요.");
  process.exit(1);
}

await mkdir(DEST, { recursive: true });

// wasm 백엔드만 쓰므로 필요한 파일은 3개뿐이다.
// (jsep/jspi/asyncify 변형은 WebGPU·WebNN 용이라 복사하지 않는다 — 60MB 이상 절약)
const NEEDED = [
  "ort.wasm.bundle.min.mjs",      // ORT 진입 모듈 (ESM)
  "ort-wasm-simd-threaded.wasm",  // WASM 본체
  "ort-wasm-simd-threaded.mjs",   // WASM 로더 glue
];

const files = await readdir(SRC);
const targets = NEEDED.filter((f) => files.includes(f));

if (targets.length === 0) {
  console.error("[yolo:wasm] 복사할 WASM 파일을 찾지 못했습니다.");
  process.exit(1);
}

for (const f of targets) {
  await copyFile(join(SRC, f), join(DEST, f));
}

console.log(`[yolo:wasm] ${targets.length}개 파일을 public/ort 로 복사했습니다.`);
console.log("[yolo:wasm] 이제 /ort/ 경로가 자동으로 우선 사용됩니다. (환경변수 설정 불필요)");
