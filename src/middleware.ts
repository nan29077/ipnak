import { NextRequest, NextResponse } from "next/server";

const MOBILE_USER_AGENT =
  /Android|iPhone|iPod|Mobile|IEMobile|Opera Mini/i;

export function middleware(request: NextRequest) {
  const entered = request.cookies.get("ipnak_entered")?.value;

  // 이미 랜딩을 통과한 경우
  if (entered === "pc") return NextResponse.next();
  if (entered === "mobile") {
    return NextResponse.redirect(new URL("/measure", request.url));
  }

  // 첫 방문: 랜딩 페이지로
  return NextResponse.redirect(new URL("/landing", request.url));
}

export const config = {
  matcher: ["/"],
};
