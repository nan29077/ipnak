import { NextRequest, NextResponse } from "next/server";

/** 세션 쿠키 이름 (src/lib/auth.ts 의 COOKIE 와 동일해야 한다) */
const SESSION_COOKIE = "ipnak_session";

export function middleware(request: NextRequest) {
  // 로그인된 사용자는 랜딩(서비스 소개)을 거칠 이유가 없다 — 바로 지도로 보낸다.
  // 미들웨어는 Edge 런타임이라 DB 조회를 할 수 없으므로 쿠키 존재 여부만 본다.
  // 만료·위조 쿠키는 /map 의 서버 컴포넌트에서 정상적으로 걸러진다.
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/map", request.url));
  }
  // 비로그인 사용자는 기존대로 랜딩 페이지로
  return NextResponse.redirect(new URL("/landing", request.url));
}

export const config = {
  matcher: ["/"],
};
