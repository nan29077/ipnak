import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // 항상 랜딩 페이지로 시작
  return NextResponse.redirect(new URL("/landing", request.url));
}

export const config = {
  matcher: ["/"],
};
