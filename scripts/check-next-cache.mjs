/**
 * dev 서버 시작 전 .next 빌드 캐시 무결성 검사.
 *
 * 증상: 홈(/home)·낚시단(/groups)·글 상세(/post/[id]) 같은 특정 메뉴만 눌러도
 *      페이지가 안 열리고 로딩만 계속되거나 "문제가 발생했어요" 화면이 뜬다.
 * 원인: dev 서버를 강제 종료(taskkill /F)했거나 같은 저장소에서 dev 서버를 두 개
 *      띄워 .next 를 공유하면, app-build-manifest.json 에는 남아 있는데 실제
 *      static/chunks/app/<route>/page.js 파일은 사라진 반쪽 상태가 된다.
 *      이러면 서버 렌더링(RSC)은 200 으로 성공하지만 브라우저가 그 청크를
 *      404 로 받아 ChunkLoadError 가 나고, 화면은 로딩에서 멈춘 것처럼 보인다.
 *      Next dev 는 매니페스트에 이미 있다고 판단해 다시 만들어 주지 않는다.
 * 조치: 매니페스트가 가리키는 청크 중 실제로 없는 게 하나라도 있으면 .next 를
 *      통째로 지운다. 최초 컴파일만 조금 느려질 뿐 동작에는 영향이 없다.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, process.env.NEXT_DIST_DIR || ".next");
const manifestPath = join(distDir, "app-build-manifest.json");

// 빌드 캐시 자체가 없으면 검사할 것도 없다 (첫 실행).
if (!existsSync(manifestPath)) process.exit(0);

let missing = [];
try {
  const pages = JSON.parse(readFileSync(manifestPath, "utf8")).pages ?? {};
  for (const files of Object.values(pages)) {
    for (const file of files) {
      if (!existsSync(join(distDir, file))) missing.push(file);
    }
  }
} catch {
  // 매니페스트가 깨져서 읽히지도 않으면 그 자체로 손상 상태다.
  missing = ["app-build-manifest.json"];
}

if (missing.length === 0) process.exit(0);

const unique = [...new Set(missing)];
console.log(`[ipnak] .next 빌드 캐시가 손상되어 있습니다 (누락 청크 ${unique.length}개)`);
for (const f of unique.slice(0, 10)) console.log(`         - ${f}`);
if (unique.length > 10) console.log(`         ... 외 ${unique.length - 10}개`);

try {
  rmSync(distDir, { recursive: true, force: true });
  console.log("[ipnak] .next 를 삭제했습니다. 이번 실행은 첫 컴파일이 조금 느립니다.");
} catch (e) {
  console.log(`[ipnak] .next 삭제 실패: ${e.message}`);
  console.log("[ipnak] dev 서버를 모두 끄고 .next 폴더를 직접 지운 뒤 다시 실행해 주세요.");
}
