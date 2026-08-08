/**
 * 로그인 후 되돌아갈 경로 검증
 *
 * NFC 태그 URL(/ball?id=XXX)로 진입한 비로그인 사용자를 로그인 후 원래 자리로 돌려보낼 때 쓴다.
 * 오픈 리다이렉트를 막기 위해 "우리 앱 내부 경로"만 통과시킨다.
 */
export function sanitizeRedirect(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  // 반드시 "/" 로 시작하는 내부 경로 — "//evil.com", "/\evil.com", "https://..." 차단
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  // 로그인 페이지로 되돌아오는 순환 방지
  if (value === "/login" || value.startsWith("/login?")) return null;
  return value;
}

/** 소셜 로그인 콜백이 읽어갈 임시 쿠키 이름 (5분 유효) */
export const POST_LOGIN_REDIRECT_COOKIE = "ipnak_post_login_redirect";

/**
 * 요청의 Cookie 헤더에서 복귀 경로를 꺼내 검증한다.
 * 값이 없거나 외부 주소면 null → 호출부는 기존 기본 경로(/home)를 쓴다.
 */
export function takePostLoginRedirect(cookieHeader: string | null | undefined): string | null {
  const raw = (cookieHeader ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${POST_LOGIN_REDIRECT_COOKIE}=`))
    ?.slice(POST_LOGIN_REDIRECT_COOKIE.length + 1);
  if (!raw) return null;
  try {
    return sanitizeRedirect(decodeURIComponent(raw));
  } catch {
    return null;
  }
}
