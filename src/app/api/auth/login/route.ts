import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";

// ── 로그인 레이트 리밋 (in-memory) ──────────────────────────────────
// 동일 IP 기준 5분 창(window) 안에서 10회를 초과하면 429.
// 단일 인스턴스 메모리 기준이므로 다중 인스턴스 배포 시에는 Redis 등으로 교체 필요.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientIp() {
  // 개발 환경에서는 항상 로컬 IP 로 처리
  if (process.env.NODE_ENV !== "production") return "127.0.0.1";
  const h = headers();
  // X-Forwarded-For 는 클라이언트가 위조 가능 → 프록시가 설정한 x-real-ip 우선,
  // XFF 를 쓸 때도 마지막(프록시가 추가한) IP 만 신뢰한다.
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // 만료된 항목 정리 — 메모리 누수 방지
    if (attempts.size > 5000) {
      for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
    }
    return null;
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  }
  return null;
}

export async function POST(req: Request) {
  const retryAfter = rateLimited(clientIp());
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력하세요." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
