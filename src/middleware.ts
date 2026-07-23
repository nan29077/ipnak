import { NextRequest, NextResponse } from "next/server";

const MOBILE_USER_AGENT =
  /Android|iPhone|iPod|Mobile|IEMobile|Opera Mini/i;

export function middleware(request: NextRequest) {
  if (MOBILE_USER_AGENT.test(request.headers.get("user-agent") || "")) {
    return NextResponse.redirect(new URL("/measure", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
