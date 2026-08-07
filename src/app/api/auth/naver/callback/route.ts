import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// 세션 쿠키 이름은 src/lib/auth.ts와 통일
const COOKIE = "ipnak_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

interface NaverTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface NaverProfileResponse {
  resultcode: string;
  message: string;
  response: {
    id: string;
    email?: string;
    nickname?: string;
    name?: string;
    profile_image?: string;
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://ipnak.com"
      : "http://localhost:3010";

  // 네이버가 오류를 반환한 경우 (사용자 취소 등)
  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/login?error=naver_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/login?error=naver_invalid`);
  }

  // ── CSRF 상태값 검증 ──────────────────────────────────────────────
  // 쿠키에서 state 읽기 — Next.js App Router에서 Request 쿠키 파싱
  const cookieHeader = req.headers.get("cookie") ?? "";
  const savedState = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("naver_oauth_state="))
    ?.split("=")[1];

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${baseUrl}/login?error=naver_state_mismatch`);
  }

  // ── 인가 코드 → 액세스 토큰 교환 ────────────────────────────────
  const callbackUrl = `${baseUrl}/api/auth/naver/callback`;

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.NAVER_CLIENT_ID!,
    client_secret: process.env.NAVER_CLIENT_SECRET!,
    code,
    state,
    redirect_uri: callbackUrl,
  });

  let accessToken: string;
  try {
    const tokenRes = await fetch(
      `https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`,
      { method: "GET" },
    );
    const tokenData: NaverTokenResponse = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("[Naver OAuth] 토큰 교환 실패:", tokenData);
      return NextResponse.redirect(`${baseUrl}/login?error=naver_token_fail`);
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error("[Naver OAuth] 토큰 요청 오류:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=naver_token_fail`);
  }

  // ── 네이버 사용자 프로필 조회 ────────────────────────────────────
  let naverProfile: NaverProfileResponse["response"];
  try {
    const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData: NaverProfileResponse = await profileRes.json();

    if (profileData.resultcode !== "00") {
      console.error("[Naver OAuth] 프로필 조회 실패:", profileData);
      return NextResponse.redirect(`${baseUrl}/login?error=naver_profile_fail`);
    }
    naverProfile = profileData.response;
  } catch (err) {
    console.error("[Naver OAuth] 프로필 요청 오류:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=naver_profile_fail`);
  }

  const naverId = naverProfile.id;
  const naverEmail = naverProfile.email?.toLowerCase() ?? null;
  const naverNickname = naverProfile.nickname ?? naverProfile.name ?? null;
  const naverName = naverProfile.name ?? null;
  const naverAvatar = naverProfile.profile_image ?? null;

  // ── 세션 토큰 사전 생성 (신규/연동 경로 트랜잭션 내 재사용) ──────
  // createSession()은 cookies().set()을 내부적으로 사용하므로
  // 리디렉션 응답에 쿠키를 직접 붙이기 위해 토큰 생성 로직을 인라인 처리한다.
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);

  // ── 사용자 찾기 / 생성 ───────────────────────────────────────────
  // 우선순위: naverKey 일치 → email 일치 → 신규 생성
  let userId!: string;
  let sessionCreated = false;

  try {
    // 1) 이미 네이버 연동된 계정
    const byNaverKey = await prisma.user.findUnique({
      where: { naverKey: naverId },
    });
    if (byNaverKey) {
      userId = byNaverKey.id;
    } else if (naverEmail) {
      // 2) 같은 이메일의 기존 계정이 있으면 자동 연동하지 않는다 (계정 탈취 방지).
      //    소셜 프로필의 이메일만으로 기존 계정에 로그인 권한을 주면,
      //    타인 이메일로 소셜 계정을 만들어 기존 회원 계정을 탈취할 수 있다.
      const byEmail = await prisma.user.findUnique({
        where: { email: naverEmail },
        select: { id: true },
      });
      if (byEmail) {
        const res = NextResponse.redirect(`${baseUrl}/login?error=social_email_exists`);
        res.cookies.delete("naver_oauth_state");
        return res;
      } else {
        // 3) 신규 가입 — 이메일+naverKey로 생성, 세션까지 원자적으로 생성 (고아 계정 방지)
        // 닉네임: 네이버 닉네임 사용, 없으면 'naver_' + naverId 앞 8자리
        const nickname =
          naverNickname && naverNickname.trim().length >= 2
            ? naverNickname.trim()
            : `naver_${naverId.slice(0, 8)}`;

        const newUser = await prisma.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: {
              email: naverEmail,
              passwordHash: "", // 소셜 로그인 — 비밀번호 없음
              nickname,
              name: naverName ?? null,
              avatarUrl: naverAvatar ?? null,
              role: "ANGLER",
              naverKey: naverId,
            },
          });
          await tx.session.create({ data: { token, userId: u.id, expiresAt } });
          return u;
        });
        userId = newUser.id;
        sessionCreated = true;
      }
    } else {
      // 이메일 없이 naverKey만으로 신규 가입, 세션까지 원자적으로 생성 (고아 계정 방지)
      const nickname =
        naverNickname && naverNickname.trim().length >= 2
          ? naverNickname.trim()
          : `naver_${naverId.slice(0, 8)}`;

      // email이 없으면 고유 플레이스홀더 생성
      const fallbackEmail = `naver_${naverId}@naver.oauth`;
      const newUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email: fallbackEmail,
            passwordHash: "",
            nickname,
            name: naverName ?? null,
            avatarUrl: naverAvatar ?? null,
            role: "ANGLER",
            naverKey: naverId,
          },
        });
        await tx.session.create({ data: { token, userId: u.id, expiresAt } });
        return u;
      });
      userId = newUser.id;
      sessionCreated = true;
    }
  } catch (err: any) {
    console.error("[Naver OAuth] 사용자 처리 오류:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=naver_user_fail`);
  }

  // ── 세션 생성 (naverKey 이미 연동된 기존 계정만 이 경로) + 쿠키 설정 + /home 리디렉션 ─
  if (!sessionCreated) {
    try {
      await prisma.session.create({ data: { token, userId, expiresAt } });
    } catch (err) {
      console.error("[Naver OAuth] 세션 생성 오류:", err);
      return NextResponse.redirect(`${baseUrl}/login?error=naver_session_fail`);
    }
  }

  const response = NextResponse.redirect(`${baseUrl}/home`);

  // naver_oauth_state 쿠키 제거
  response.cookies.delete("naver_oauth_state");

  // 세션 쿠키 설정
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });

  return response;
}
