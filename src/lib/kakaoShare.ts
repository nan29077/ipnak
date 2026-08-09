"use client";
/**
 * 카카오톡 공유 (Kakao JavaScript SDK)
 *
 * 사용 예
 *   if (isKakaoShareConfigured()) {
 *     await shareKakaoFeed({ title, description, imageUrl, link });
 *   }
 *
 * 중복 방지
 * - SDK <script> 는 id 로 한 번만 삽입하고, 로드 Promise 를 재사용한다.
 * - 다른 화면에서 이미 Kakao.init() 을 했을 수 있으므로 isInitialized() 로 확인 후에만 초기화한다.
 *
 * 키
 * - 표준 환경변수는 NEXT_PUBLIC_KAKAO_APP_KEY (카카오 "JavaScript 키").
 * - 카카오는 지도 SDK 와 공유 SDK 가 같은 JavaScript 키를 쓰므로,
 *   앱 키가 없으면 기존에 쓰던 키(NEXT_PUBLIC_KAKAO_JS_KEY → NEXT_PUBLIC_KAKAO_MAP_KEY)를 순서대로 재사용한다.
 * - 키가 비어 있으면 공유 버튼을 감춘다 (isKakaoShareConfigured).
 */

const SDK_SRC = "https://developers.kakao.com/sdk/js/kakao.js";
const SDK_ELEMENT_ID = "kakao-js-sdk";

/** 카카오 JavaScript 앱 키 (빌드 시 인라인되므로 process.env 를 직접 참조해야 한다) */
export const KAKAO_JS_KEY = (
  process.env.NEXT_PUBLIC_KAKAO_APP_KEY ||
  process.env.NEXT_PUBLIC_KAKAO_JS_KEY ||
  process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ||
  ""
).trim();

/** 카카오 공유를 쓸 수 있는 환경인지 (키가 설정돼 있는지) */
export function isKakaoShareConfigured(): boolean {
  return KAKAO_JS_KEY.length > 0;
}

function getKakao(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).Kakao ?? null;
}

/** SDK 로드 Promise — 동시에 여러 번 호출돼도 스크립트는 한 번만 붙는다 */
let sdkPromise: Promise<any> | null = null;

function loadSdk(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저에서만 사용할 수 있어요."));
  }
  const loaded = getKakao();
  if (loaded) return Promise.resolve(loaded);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<any>((resolve, reject) => {
    const existing = document.getElementById(SDK_ELEMENT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    const onLoad = () => {
      const sdk = getKakao();
      if (sdk) resolve(sdk);
      else {
        sdkPromise = null;
        reject(new Error("카카오 SDK 를 불러오지 못했어요."));
      }
    };
    const onError = () => {
      sdkPromise = null;
      reject(new Error("카카오 SDK 를 불러오지 못했어요."));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existing) {
      script.id = SDK_ELEMENT_ID;
      script.src = SDK_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return sdkPromise;
}

/** SDK 로드 + 초기화 (이미 초기화돼 있으면 다시 하지 않는다) */
export async function ensureKakao(): Promise<any> {
  if (!isKakaoShareConfigured()) {
    throw new Error("카카오 공유가 설정되지 않았어요.");
  }
  const Kakao = await loadSdk();
  try {
    if (typeof Kakao.isInitialized !== "function" || !Kakao.isInitialized()) {
      Kakao.init(KAKAO_JS_KEY);
    }
  } catch {
    // 다른 화면에서 이미 init 된 경우 SDK 가 예외를 던질 수 있다 — 무시하고 진행
  }
  return Kakao;
}

export type KakaoFeedInput = {
  title: string;
  description: string;
  /** 절대 URL 이어야 카카오 서버가 썸네일을 가져올 수 있다 */
  imageUrl: string;
  /** 공유 링크 (절대 URL) */
  link: string;
  buttonTitle?: string;
};

/**
 * 피드(링크) 형식으로 카카오톡 공유창을 띄운다.
 * SDK 2.x 는 Kakao.Share, 1.x 는 Kakao.Link 를 쓰므로 둘 다 대응한다.
 */
export async function shareKakaoFeed(input: KakaoFeedInput): Promise<void> {
  const Kakao = await ensureKakao();
  const api = Kakao.Share ?? Kakao.Link;
  if (!api || typeof api.sendDefault !== "function") {
    throw new Error("카카오 공유를 사용할 수 없어요.");
  }

  const link = { mobileWebUrl: input.link, webUrl: input.link };
  await api.sendDefault({
    objectType: "feed",
    content: {
      title: input.title,
      description: input.description,
      imageUrl: input.imageUrl,
      link,
    },
    buttons: [{ title: input.buttonTitle ?? "입낚에서 보기", link }],
  });
}
