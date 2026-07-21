import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  let user;
  try { user = await requireUser(); } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  if (user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get("tournamentId") || undefined;
  const status       = searchParams.get("status")       || undefined;
  const sort         = searchParams.get("sort")         || "newest";

  const orderBy =
    sort === "oldest"    ? [{ createdAt: "asc"  as const }] :
    sort === "size_desc" ? [{ sizeCm:    "desc" as const }] :
                           [{ createdAt: "desc" as const }];

  const [entries, tournaments] = await Promise.all([
    prisma.tournamentEntry.findMany({
      where: {
        ...(tournamentId ? { tournamentId } : {}),
        ...(status       ? { status }       : {}),
      },
      include: {
        user:       { select: { nickname: true } },
        tournament: { select: { id: true, title: true } },
      },
      orderBy,
      take: 150,
    }),
    prisma.tournament.findMany({
      select: { id: true, title: true },
      orderBy: { startAt: "desc" },
    }),
  ]);

  return NextResponse.json({ entries, tournaments });
}
