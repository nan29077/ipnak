import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { takePostLoginRedirect, POST_LOGIN_REDIRECT_COOKIE } from "@/lib/safeRedirect";

// 세션 쿠키 이름은 src/lib/auth.ts와 통일
const COOKIE = "ipnak_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

interface KakaoTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  error_code?: string; // 카카오 고유 에러 코드 (예: KOE010, KOE303, KOE320)
}

interface KakaoProfileResponse {
  id: number;
  kakao_account?: {
    email?: string;
    is_email_verified?: boolean;
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

  const clientId = process.env.KAKAO_CLIENT_ID ?? "";
  const clientSecret = process.env.KAKAO_CLIENT_SECRET ?? "";

  // 환경변수 미로딩(서버 재시작 전 stale env) 감지 — 값 자체는 로그에 남기지 않는다.
  if (!clientId || !clientSecret) {
    console.error(
      "[Kakao OAuth] 환경변수 누락 — KAKAO_CLIENT_ID:",
      clientId ? `설정됨(${clientId.length}자)` : "비어있음",
      "/ KAKAO_CLIENT_SECRET:",
      clientSecret ? `설정됨(${clientSecret.length}자)` : "비어있음",
      "→ .env 수정 후 개발 서버를 재시작했는지 확인하세요."
    );
  }

  let accessToken: string;
  try {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: callbackUrl,
    });
    // 시크릿이 비어 있으면 파라미터 자체를 생략한다.
    // (빈 문자열로 보내면 카카오 콘솔에서 시크릿 활성화 시 무조건 KOE010 실패)
    if (clientSecret) tokenParams.set("client_secret", clientSecret);

    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: tokenParams.toString(),
    });
    const tokenData: KakaoTokenResponse = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error(
        "[Kakao OAuth] 토큰 교환 실패:",
        tokenData,
        "| redirect_uri:", callbackUrl,
        "| client_secret 포함:", Boolean(clientSecret)
      );
      // 카카오 에러 코드(KOE010=시크릿 불일치, KOE303=redirect_uri 불일치, KOE320=코드 재사용/만료)를
      // 쿼리로 노출해 브라우저 주소창만으로 원인 확인 가능하게 한다.
      const reason = tokenData.error_code ?? tokenData.error ?? "unknown";
      return NextResponse.redirect(
        `${baseUrl}/login?error=kakao_token_fail&reason=${encodeURIComponent(reason)}`
      );
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error("[Kakao OAuth] 토큰 요청 오류(네트워크):", err);
    return NextResponse.redirect(
      `${baseUrl}/login?error=kakao_token_fail&reason=network`
    );
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
  // 카카오가 이메일 미인증(is_email_verified === false)으로 알려주면 이메일을 신뢰하지 않는다.
  const kakaoEmailVerified = kakaoProfile.kakao_account?.is_email_verified !== false;
  const kakaoEmail = kakaoEmailVerified
    ? kakaoProfile.kakao_account?.email?.toLowerCase() ?? null
    : null;
  const kakaoNickname = kakaoProfile.kakao_account?.profile?.nickname ?? null;
  const kakaoAvatar = kakaoProfile.kakao_account?.profile?.profile_image_url ?? null;

  // ── 세션 토큰 사전 생성 (신규/연동 경로 트랜잭션 내 재사용) ──────
  // createSession()은 cookies().set()을 내부적으로 사용하므로
  // 리디렉션 응답에 쿠키를 직접 붙이기 위해 토큰 생성 로직을 인라인 처리한다.
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);

  // ── 사용자 찾기 / 생성 ───────────────────────────────────────────
  let userId!: string;
  let sessionCreated = false;

  try {
    // 1) 이미 카카오 연동된 계정
    const byKakaoKey = await prisma.user.findUnique({
      where: { kakaoKey: kakaoId },
    });
    if (byKakaoKey) {
      userId = byKakaoKey.id;
    } else if (kakaoEmail) {
      // 2) 같은 이메일의 기존 계정이 있으면 자동 연동하지 않는다 (계정 탈취 방지).
      //    소셜 프로필의 이메일만으로 기존 계정에 로그인 권한을 주면,
      //    타인 이메일로 소셜 계정을 만들어 기존 회원 계정을 탈취할 수 있다.
      const byEmail = await prisma.user.findUnique({
        where: { email: kakaoEmail },
        select: { id: true },
      });
      if (byEmail) {
        const res = NextResponse.redirect(`${baseUrl}/login?error=social_email_exists`);
        res.cookies.delete("kakao_oauth_state");
        return res;
      } else {
        // 3) 신규 가입, 세션까지 원자적으로 생성 (고아 계정 방지)
        const nickname =
          kakaoNickname && kakaoNickname.trim().length >= 2
            ? kakaoNickname.trim()
            : `kakao_${kakaoId.slice(0, 8)}`;

        const newUser = await prisma.$transaction(async (tx) => {
          const u = await tx.user.create({
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
          await tx.session.create({ data: { token, userId: u.id, expiresAt } });
          return u;
        });
        userId = newUser.id;
        sessionCreated = true;
      }
    } else {
      // 이메일 없이 kakaoKey만으로 신규 가입, 세션까지 원자적으로 생성 (고아 계정 방지)
      const nickname =
        kakaoNickname && kakaoNickname.trim().length >= 2
          ? kakaoNickname.trim()
          : `kakao_${kakaoId.slice(0, 8)}`;

      const fallbackEmail = `kakao_${kakaoId}@kakao.oauth`;
      const newUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
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
        await tx.session.create({ data: { token, userId: u.id, expiresAt } });
        return u;
      });
      userId = newUser.id;
      sessionCreated = true;
    }
  } catch (err: any) {
    console.error("[Kakao OAuth] 사용자 처리 오류:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=kakao_user_fail`);
  }

  // ── 활동정지 계정 차단 ────────────────────────────────────────────
  try {
    const activeRows: any[] = await prisma.$queryRaw`SELECT isActive FROM \`User\` WHERE id = ${userId} LIMIT 1`;
    if (activeRows[0]?.isActive === 0 || activeRows[0]?.isActive === false) {
      const res = NextResponse.redirect(`${baseUrl}/login?error=suspended`);
      res.cookies.delete("kakao_oauth_state");
      return res;
    }
  } catch {}

  // ── 세션 생성 (kakaoKey 이미 연동된 기존 계정만 이 경로) + 쿠키 설정 + /home 리디렉션 ─
  if (!sessionCreated) {
    try {
      await prisma.session.create({ data: { token, userId, expiresAt } });
    } catch (err) {
      console.error("[Kakao OAuth] 세션 생성 오류:", err);
      return NextResponse.redirect(`${baseUrl}/login?error=kakao_session_fail`);
    }
  }

  // 로그인 전에 보던 내부 경로(NFC 태그 랜딩 등)가 있으면 그쪽으로 돌려보낸다.
  const response = NextResponse.redirect(`${baseUrl}${takePostLoginRedirect(cookieHeader) ?? "/home"}`);

  // kakao_oauth_state / 복귀 경로 쿠키 제거
  response.cookies.delete("kakao_oauth_state");
  response.cookies.delete(POST_LOGIN_REDIRECT_COOKIE);

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
