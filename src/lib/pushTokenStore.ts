import "server-only";
/**
 * FCM/APNs 푸시 토큰 저장소 (파일 기반)
 *
 * 왜 파일인가
 * - Prisma 스키마(User 등)에 pushToken 필드가 없고, 앱 패키징 준비 단계에서
 *   실서버 DB 마이그레이션을 유발하지 않기 위해 별도 JSON 파일로 관리한다.
 * - 정식 출시 시점에 PushToken 모델을 추가하고 migrateToPrisma() 로 옮기면 된다.
 *
 * 저장 위치: <project>/.app-data/push-tokens.json  (gitignore 대상)
 * 형식: { tokens: PushTokenRecord[] }
 *
 * 동시 쓰기 안전장치
 * - 한 프로세스 내 직렬화(writeQueue)만 보장한다. 다중 인스턴스 배포 시에는
 *   DB 로 옮기는 것을 전제로 한다 (아래 TODO).
 */
import { mkdir, readFile, writeFile, rename } from "fs/promises";
import { join } from "path";

export type PushPlatform = "android" | "ios" | "web";

export type PushTokenRecord = {
  userId: string;
  token: string;
  platform: PushPlatform;
  /** 앱 버전 (있으면 기록) */
  appVersion?: string | null;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = join(process.cwd(), ".app-data");
const FILE = join(DATA_DIR, "push-tokens.json");

/** 프로세스 내 쓰기 직렬화 체인 */
let writeQueue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<PushTokenRecord[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.tokens) ? (parsed.tokens as PushTokenRecord[]) : [];
  } catch {
    // 파일 없음/깨짐 → 빈 목록으로 시작 (앱 동작을 막지 않는다)
    return [];
  }
}

async function writeAll(tokens: PushTokenRecord[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  // 원자적 교체 — 쓰기 중 크래시로 파일이 깨지는 것을 방지
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ tokens }, null, 2), "utf8");
  await rename(tmp, FILE);
}

/** 쓰기 작업을 직렬로 실행 */
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

/**
 * 토큰 등록/갱신 (upsert)
 * - 같은 token 이 다른 사용자에게 있던 경우(기기 재로그인) userId 를 갱신한다.
 */
export async function savePushToken(input: {
  userId: string;
  token: string;
  platform: PushPlatform;
  appVersion?: string | null;
}): Promise<PushTokenRecord> {
  return serialize(async () => {
    const tokens = await readAll();
    const now = new Date().toISOString();
    const idx = tokens.findIndex((t) => t.token === input.token);
    let record: PushTokenRecord;
    if (idx >= 0) {
      record = {
        ...tokens[idx],
        userId: input.userId,
        platform: input.platform,
        appVersion: input.appVersion ?? tokens[idx].appVersion ?? null,
        updatedAt: now,
      };
      tokens[idx] = record;
    } else {
      record = {
        userId: input.userId,
        token: input.token,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        createdAt: now,
        updatedAt: now,
      };
      tokens.push(record);
    }
    await writeAll(tokens);
    return record;
  });
}

/** 토큰 삭제 (로그아웃/앱 삭제 시) */
export async function deletePushToken(token: string): Promise<boolean> {
  return serialize(async () => {
    const tokens = await readAll();
    const next = tokens.filter((t) => t.token !== token);
    if (next.length === tokens.length) return false;
    await writeAll(next);
    return true;
  });
}

/** 특정 사용자의 토큰 목록 — 실제 푸시 발송 시 사용 */
export async function getPushTokensByUser(userId: string): Promise<PushTokenRecord[]> {
  const tokens = await readAll();
  return tokens.filter((t) => t.userId === userId);
}

/** 전체 토큰 목록 (관리자/전체 발송용) */
export async function getAllPushTokens(): Promise<PushTokenRecord[]> {
  return readAll();
}
