import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// 세션 쿠키 이름은 src/lib/auth.ts와 통일
const COOKIE = "ipnak_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

interface KakaoTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface KakaoProfileResponse {
  id: number;
  kakao_account?: {
    email?: string;
    email_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
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

  // 카카오가 오류를 반환한 경우 (사용자 취소 등)
  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/login?error=kakao_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/login?error=kakao_invalid`);
  }

  // ── CSRF 상태값 검증 ──────────────────────────────────────────────
  const cookieHeader = req.headers.get("cookie") ?? "";
  const savedState = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("kakao_oauth_state="))
    ?.split("=")[1];

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${baseUrl}/login?error=kakao_state_mismatch`);
  }

  // ── 인가 코드 → 액세스 토큰 교환 ────────────────────────────────
  const callbackUrl = `${baseUrl}/api/auth/kakao/callback`;

  let accessToken: string;
  try {
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID!,
        client_secret: process.env.KAKAO_CLIENT_SECRET ?? "",
        code,
        redirect_uri: callbackUrl,
      }).toString(),
    });
    const tokenData: KakaoTokenResponse = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("[Kakao OAuth] 토큰 교환 실패:", tokenData);
      return NextResponse.redirect(`${baseUrl}/login?error=kakao_token_fail`);
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error("[Kakao OAuth] 토큰 요청 오류:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=kakao_token_fail`);
  }

  // ── 카카오 사용자 프로필 조회 ────────────────────────────────────
  let kakaoProfile: KakaoProfileResponse;
  try {
    const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    kakaoProfile = await profileRes.json();

    if (!kakaoProfile.id) {
      console.error("[Kakao OAuth] 프로필 조회 실패:", kakaoProfile);
      return NextResponse.redirect(`${baseUrl}/login?error=kakao_profile_fail`);
    }
  } catch (err) {
    console.error("[Kakao OAuth] 프로필 요청 오류:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=kakao_profile_fail`);
  }

  const kakaoId = String(kakaoProfile.id);
  const kakaoEmail = kakaoProfile.kakao_account?.email?.toLowerCase() ?? null;
  const kakaoNickname = kakaoProfile.kakao_account?.profile?.nickname ?? null;
  const kakaoAvatar = kakaoProfile.kakao_account?.profile?.profile_image_url ?? null;

  // ── 사용자 찾기 / 생성 ───────────────────────────────────────────
  let userId: string;

  try {
    // 1) 이미 카카오 연동된 계정
    const byKakaoKey = await prisma.user.findUnique({
      where: { kakaoKey: kakaoId },
    });
    if (byKakaoKey) {
      userId = byKakaoKey.id;
    } else if (kakaoEmail) {
      // 2) 이메일로 기존 가입 계정 찾기 → kakaoKey 연동
      const byEmail = await prisma.user.findUnique({
        where: { email: kakaoEmail },
      });
      if (byEmail) {
        await prisma.user.update({
          where: { id: byEmail.id },
          data: { kakaoKey: kakaoId },
        });
        userId = byEmail.id;
      } else {
        // 3) 신규 가입
        const nickname =
          kakaoNickname && kakaoNickname.trim().length >= 2
            ? kakaoNickname.trim()
            : `kakao_${kakaoId.slice(0, 8)}`;

        const newUser = await prisma.user.create({
          data: {
            email: kakaoEmail,
            passwordHash: "",
            nickname,
            name: null,
            avatarUrl: kakaoAvatar ?? null,
            role: "ANGLER",
            kakaoKey: kakaoId,
          },
        });
        userId = newUser.id;
      }
    } else {
      // 이메일 없이 kakaoKey만으로 신규 가입
      const nickname =
        kakaoNickname && kakaoNickname.trim().length >= 2
          ? kakaoNickname.trim()
          : `kakao_${kakaoId.slice(0, 8)}`;

      const fallbackEmail = `kakao_${kakaoId}@kakao.oauth`;
      const newUser = await prisma.user.create({
        data: {
          email: fallbackEmail,
          passwordHash: "",
          nickname,
          name: null,
          avatarUrl: kakaoAvatar ?? null,
          role: "ANGLER",
          kakaoKey: kakaoId,
        },
      });
      userId = newUser.id;
    }
  } catch (err: any) {
    console.error("[Kakao OAuth] 사용자 처리 오류:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=kakao_user_fail`);
  }

  // ── 세션 생성 + 쿠키 설정 + /home 리디렉션 ─────────────────────
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);

  try {
    await prisma.session.create({ data: { token, userId, expiresAt } });
  } catch (err) {
    console.error("[Kakao OAuth] 세션 생성 오류:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=kakao_session_fail`);
  }

  const response = NextResponse.redirect(`${baseUrl}/home`);

  // kakao_oauth_state 쿠키 제거
  response.cookies.delete("kakao_oauth_state");

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
