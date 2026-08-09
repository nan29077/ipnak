/**
 * 입낚볼 / 입낚키링 NFC 태그 URL 규격 & 파서
 *
 * 태그 기록 형식 (URL 방식 — 아이폰 대응, 신규 표준)
 *   볼   : https://ipnak.kr/ball?id=BALL-000001
 *   키링 : https://ipnak.kr/keyring?id=KRING-000001
 *
 * 왜 URL 인가
 * - 아이폰은 앱 없이도 잠금화면/홈에서 NFC 태그의 URL 을 읽어 상단 배너를 띄운다.
 *   배너를 탭하면 그 URL 이 열리므로 "태그 → 계측 화면"이 한 번에 연결된다.
 * - 안드로이드는 기존처럼 앱 안에서 NFC 를 직접 읽고, 파서가 URL 에서 ID 만 뽑아낸다.
 *
 * 하위 호환 (기존 태그·기존 흐름을 깨지 않기 위한 규칙)
 * - 구형 텍스트 태그("IPNK-000001", "IPNK-KR-000001")는 그대로 ID 로 인식한다.
 *   → 안드로이드에서 이미 배포된 태그는 재프로그래밍 없이 계속 동작한다.
 * - 예전 경로형(https://ipnak.com/ball/IPNK-000001)과 커스텀 스킴(ipnak://ball/...)도 인식한다.
 * - ID 접두어(BALL / KRING / IPNK / IPNK-KR)로 상품 종류를 유추할 수 있다.
 */

/** 태그에 기록할 기본 도메인 (환경변수로 덮어쓸 수 있음) */
export const TAG_BASE_URL =
  (process.env.NEXT_PUBLIC_TAG_BASE_URL || "https://ipnak.kr").replace(/\/+$/, "");

/** 태그가 가리키는 상품 종류 */
export type TagKind = "ball" | "keyring";

/** 우리 태그로 인정하는 호스트 (다른 도메인 URL 태그는 무시한다) */
const ALLOWED_TAG_HOSTS = [
  "ipnak.kr",
  "www.ipnak.kr",
  "ipnak.com",
  "www.ipnak.com",
];

/** ID 로 허용하는 문자 — 신규(BALL-000001 / KRING-000001), 구형(IPNK-000001) 모두 통과 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** 신규 표준 ID 접두어 */
export const ID_PREFIX: Record<TagKind, string> = { ball: "BALL", keyring: "KRING" };

/** 화면 안내·placeholder 에 쓰는 예시 ID (한 곳에서만 관리) */
export const ID_SAMPLE: Record<TagKind, string> = { ball: "BALL-000001", keyring: "KRING-000001" };

/** "BALL + 숫자 6자리" 같은 형식 설명 문구 */
export const ID_FORMAT_LABEL: Record<TagKind, string> = {
  ball: "BALL + 숫자 6자리",
  keyring: "KRING + 숫자 6자리",
};

/** 구형(레거시) 접두어 — 이미 배포된 텍스트 태그 호환용 */
export const LEGACY_ID_SAMPLE: Record<TagKind, string> = {
  ball: "IPNK-000001",
  keyring: "IPNK-KR-000001",
};

/**
 * ID 접두어로 상품 종류를 유추한다.
 * URL 태그는 경로(/ball, /keyring)로 종류를 알 수 있지만,
 * 접두어만 있는 텍스트 태그는 이 함수로 판별한다. 알 수 없으면 null.
 */
export function inferKindFromId(id: string): TagKind | null {
  const upper = id.trim().toUpperCase();
  // 구형 키링(IPNK-KR-)이 구형 볼(IPNK-)보다 먼저 검사돼야 한다.
  if (upper.startsWith("IPNK-KR-")) return "keyring";
  if (upper.startsWith(`${ID_PREFIX.keyring}-`)) return "keyring";
  if (upper.startsWith(`${ID_PREFIX.ball}-`)) return "ball";
  if (upper.startsWith("IPNK-")) return "ball";
  return null;
}

/** NDEF URI 레코드 앞에 붙는 축약 프리픽스 바이트 (0x00~0x04 만 실사용) */
const URI_PREFIXES: Record<number, string> = {
  0x00: "",
  0x01: "http://www.",
  0x02: "https://www.",
  0x03: "http://",
  0x04: "https://",
};

/** 태그에 기록할 URL 문자열을 만든다 (관리자 화면에서 안내·복사용) */
export function buildTagUrl(kind: TagKind, id: string): string {
  return `${TAG_BASE_URL}/${kind}?id=${encodeURIComponent(id.trim().toUpperCase())}`;
}

/**
 * NDEF 레코드 원문 해석 후보들을 만든다.
 *
 * Text 레코드와 URI 레코드는 둘 다 작은 값의 첫 바이트로 시작해서
 * 한 가지로 단정할 수 없다. (Text 의 상태바이트 0x02 = 언어코드 2바이트,
 * URI 의 프리픽스 0x02 = "https://www.")
 * 그래서 가능한 해석을 모두 만들어 두고, 실제로 ID 가 나오는 첫 후보를 채택한다.
 *
 * - 후보1: 원문 그대로            → 순수 텍스트 태그("BALL-000001"), 완성된 URL
 * - 후보2: URI 레코드 해석        → [프리픽스 코드] + 나머지 URL
 * - 후보3: Text 레코드 해석       → [상태바이트][언어코드] + 본문
 *          (상태바이트 하위 6비트가 언어코드 길이라 정확히 잘라낼 수 있다)
 */
function ndefCandidates(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];
  const out = [text];
  const first = text.charCodeAt(0);

  // URI 레코드 프리픽스 — 0x01~0x04 를 스킴으로 복원
  if (first !== 0x00 && first in URI_PREFIXES) {
    out.push(URI_PREFIXES[first] + text.slice(1));
  }
  // Text 레코드 — 상태바이트(bit7 = UTF-16 여부, bit0~5 = 언어코드 길이) + 언어코드 제거
  const langLen = first & 0x3f;
  const isTextStatusByte = langLen <= 0x08 && (first <= 0x08 || first >= 0x80);
  if (isTextStatusByte && 1 + langLen < text.length) {
    out.push(text.slice(1 + langLen).trim());
  }
  return out;
}

/** 경로(/ball, /keyring)에서 상품 종류를 판별 */
function kindFromPath(pathname: string): TagKind | null {
  const seg = pathname.toLowerCase().split("/").filter(Boolean)[0];
  if (seg === "ball") return "ball";
  if (seg === "keyring") return "keyring";
  return null;
}

/** 검증된 ID 만 대문자로 정규화해 돌려준다 */
function normalizeId(value: string | null | undefined): string | null {
  const id = (value ?? "").trim();
  if (!id || !ID_PATTERN.test(id)) return null;
  return id.toUpperCase();
}

export type ParsedTag = {
  /** URL 태그는 경로로, 텍스트 태그는 ID 접두어로 판별. 알 수 없으면 null (호출부가 문맥으로 판단) */
  kind: TagKind | null;
  id: string;
};

/**
 * NFC 태그 원문 → { kind, id }
 * 우리 태그가 아니거나 ID 를 뽑을 수 없으면 null.
 */
export function parseTagPayload(raw: string | null | undefined): ParsedTag | null {
  if (!raw) return null;
  for (const candidate of ndefCandidates(String(raw))) {
    const parsed = parseCandidate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

/** 해석 후보 하나를 { kind, id } 로 바꾼다. 우리 태그가 아니면 null */
function parseCandidate(text: string): ParsedTag | null {
  if (!text) return null;

  // 1) 커스텀 스킴 — ipnak://ball?id=XXX  /  ipnak://ball/XXX
  const schemeMatch = /^ipnak:\/\/(.*)$/i.exec(text);
  if (schemeMatch) {
    return parseInternalPath(`/${schemeMatch[1].replace(/^\/+/, "")}`);
  }

  // 2) http(s) URL — 허용 호스트만 인정
  if (/^https?:\/\//i.test(text)) {
    try {
      const u = new URL(text);
      const host = u.hostname.toLowerCase();
      const sameOrigin =
        typeof window !== "undefined" && host === window.location.hostname.toLowerCase();
      if (!ALLOWED_TAG_HOSTS.includes(host) && !sameOrigin) return null;
      return parseInternalPath(`${u.pathname}${u.search}`);
    } catch {
      return null;
    }
  }

  // 3) 순수 텍스트 ID (구형 태그) — 접두어로 종류를 유추한다
  const id = normalizeId(text);
  return id ? { kind: inferKindFromId(id), id } : null;
}

/** "/ball?id=XXX" 또는 "/ball/XXX" 형태의 내부 경로에서 종류·ID 추출 */
function parseInternalPath(pathWithQuery: string): ParsedTag | null {
  const [pathname, query = ""] = pathWithQuery.split("?");
  const kind = kindFromPath(pathname);

  // ?id=XXX 우선
  const queryId = normalizeId(new URLSearchParams(query).get("id"));
  if (queryId) return { kind, id: queryId };

  // 경로형 폴백: /ball/XXX
  const segs = pathname.split("/").filter(Boolean);
  const pathId = segs.length >= 2 ? normalizeId(segs[1]) : null;
  if (pathId) return { kind, id: pathId };

  return null;
}

/**
 * 기존 호출부 호환용 — 태그 원문에서 ID 문자열만 뽑는다.
 * (볼/키링 구분이 필요 없는 화면에서 사용)
 */
export function parseTagId(raw: string | null | undefined): string | null {
  return parseTagPayload(raw)?.id ?? null;
}
