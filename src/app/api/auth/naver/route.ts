import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// 네이버 OAuth 시작 — 사용자를 네이버 인증 페이지로 리디렉션한다.
// state 값은 CSRF 방지용으로 짧은 쿠키에 저장 후 callback에서 검증한다.

export async function GET(req: Request) {
  const state = randomBytes(16).toString("hex");

  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://ipnak.com"
      : "http://localhost:3010";

  const callbackUrl = `${baseUrl}/api/auth/naver/callback`;

  const naverAuthUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  naverAuthUrl.searchParams.set("response_type", "code");
  naverAuthUrl.searchParams.set("client_id", process.env.NAVER_CLIENT_ID!);
  naverAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  naverAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(naverAuthUrl.toString());

  // state를 httpOnly 쿠키에 저장 (5분 유효) — callback에서 검증
  response.cookies.set("naver_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 5,
    path: "/",
  });

  return response;
}
