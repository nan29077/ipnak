import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE = "ipnak_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/**
 * 만료된 세션 레코드 정리.
 * 로그인마다 Session 행이 쌓이기만 하고 지워지는 곳이 없어 무한히 누적된다.
 * 요청 응답을 늦추지 않도록 await 하지 않고 백그라운드로 돌리며,
 * 실패해도 로그인 자체에는 영향이 없도록 예외를 삼킨다.
 * 만료 세션은 getCurrentUser에서 이미 거부되므로 삭제는 순수한 청소 작업이다.
 */
export function purgeExpiredSessions() {
  prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  // 세션이 새로 생기는 시점(로그인·회원가입)에 만료분을 함께 치운다.
  purgeExpiredSessions();
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // 운영(HTTPS)에서만 secure — 로컬 http 개발 환경에서는 쿠키가 막히지 않도록 유지
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return token;
}

export async function destroySession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {});
  }
  cookies().delete(COOKIE);
}

export async function getCurrentUser() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { passwordHash, ...safe } = session.user;
  return safe;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
