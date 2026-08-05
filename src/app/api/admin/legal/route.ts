import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { DEFAULT_TOS, DEFAULT_PRIVACY, DEFAULT_COMPANY_INFO } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function GET() {
  const [tos, privacy, company] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "terms_of_service" } }),
    prisma.setting.findUnique({ where: { key: "privacy_policy" } }),
    prisma.setting.findUnique({ where: { key: "company_info" } }),
  ]);
  return NextResponse.json({
    terms_of_service: tos?.value ?? DEFAULT_TOS,
    privacy_policy: privacy?.value ?? DEFAULT_PRIVACY,
    company_info: company?.value ?? DEFAULT_COMPANY_INFO,
  });
}

export async function PUT(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const { terms_of_service, privacy_policy, company_info } = body as {
    terms_of_service?: string;
    privacy_policy?: string;
    company_info?: string;
  };

  const updates: [string, string][] = [];
  if (typeof terms_of_service === "string") updates.push(["terms_of_service", terms_of_service]);
  if (typeof privacy_policy === "string") updates.push(["privacy_policy", privacy_policy]);
  if (typeof company_info === "string") updates.push(["company_info", company_info]);

  if (updates.length === 0) {
    return NextResponse.json({ error: "저장할 내용이 없습니다." }, { status: 400 });
  }

  await Promise.all(
    updates.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  await prisma.adminLog.create({
    data: {
      actorId: user.id,
      action: "LEGAL_SAVE",
      target: "LEGAL",
      detail: updates.map(([k]) => k).join(", "),
    },
  });

  return NextResponse.json({ ok: true });
}
