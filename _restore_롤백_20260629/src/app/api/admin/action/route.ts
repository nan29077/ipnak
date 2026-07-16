import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// 관리자 통합 액션 (모두 실제 DB 반영, 결제/외부 API 제외)
export async function POST(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 }); }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const log = (action: string, target?: string, detail?: string) =>
    prisma.adminLog.create({ data: { actorId: user.id, action, target, detail } });

  try {
    switch (b.type) {
      case "POST_HIDE":
        await prisma.post.update({ where: { id: b.id }, data: { hidden: !!b.hidden } });
        await log(b.hidden ? "POST_HIDE" : "POST_SHOW", b.id); break;
      case "COMMENT_HIDE":
        await prisma.comment.update({ where: { id: b.id }, data: { hidden: !!b.hidden } });
        await log("COMMENT_HIDE", b.id); break;
      case "REPORT_STATUS":
        await prisma.report.update({ where: { id: b.id }, data: { status: b.status } });
        await log("REPORT_" + b.status, b.id); break;
      case "BOOKING_STATUS":
        await prisma.booking.update({ where: { id: b.id }, data: { status: b.status } });
        await log("BOOKING_" + b.status, b.id); break;
      case "ENTRY_REVIEW":
        await prisma.tournamentEntry.update({ where: { id: b.id }, data: { status: b.status } });
        await log("ENTRY_" + b.status, b.id); break;
      case "USER_ROLE":
        await prisma.user.update({ where: { id: b.id }, data: { role: b.role } });
        await log("USER_ROLE_" + b.role, b.id); break;
      case "TOURNAMENT_CREATE":
        await prisma.tournament.create({ data: {
          title: b.title, type: b.tType || "WEEKLY", speciesName: b.speciesName || null,
          description: b.description || null, rules: b.rules || "길이 cm 기준 순위",
          startAt: new Date(b.startAt || Date.now()), endAt: new Date(b.endAt || Date.now() + 7 * 86400000),
          status: b.status || "UPCOMING", bannerUrl: b.bannerUrl || null,
        }});
        await log("TOURNAMENT_CREATE", undefined, b.title); break;
      case "TOURNAMENT_DELETE":
        await prisma.tournament.delete({ where: { id: b.id } });
        await log("TOURNAMENT_DELETE", b.id); break;
      case "PRODUCT_CREATE":
        await prisma.product.create({ data: {
          name: b.name, brand: b.brand || null, category: b.category || "ETC",
          price: Number(b.price) || 0, imageUrl: b.imageUrl || `https://picsum.photos/seed/p${Date.now()}/600/600`,
          buyUrl: b.buyUrl || "#", description: b.description || null, feeRate: Number(b.feeRate) || 10,
        }});
        await log("PRODUCT_CREATE", undefined, b.name); break;
      case "PRODUCT_DELETE":
        await prisma.product.delete({ where: { id: b.id } });
        await log("PRODUCT_DELETE", b.id); break;
      case "LISTING_DELETE":
        await prisma.reservationListing.delete({ where: { id: b.id } });
        await log("LISTING_DELETE", b.id); break;
      case "BANNER_TOGGLE":
        const bn = await prisma.banner.findUnique({ where: { id: b.id } });
        await prisma.banner.update({ where: { id: b.id }, data: { active: !bn?.active } });
        await log("BANNER_TOGGLE", b.id); break;
      case "BANNER_CREATE":
        await prisma.banner.create({ data: { title: b.title, body: b.body || null, imageUrl: b.imageUrl || null, active: true } });
        await log("BANNER_CREATE", undefined, b.title); break;
      case "SETTING_SET":
        await prisma.setting.upsert({
          where: { key: b.key },
          update: { value: String(b.value) },
          create: { key: b.key, value: String(b.value) },
        });
        await log("SETTING_SET", b.key, String(b.value)); break;
      case "BANNER_DELETE":
        await prisma.banner.delete({ where: { id: b.id } });
        await log("BANNER_DELETE", b.id); break;
      case "SPECIES_CREATE":
        await prisma.fishSpecies.create({ data: { slug: `sp-${b.label}-${Date.now()}`, label: b.label, water: b.water || "SEA" } });
        await log("SPECIES_CREATE", undefined, b.label); break;
      default:
        return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "처리 실패" }, { status: 500 });
  }
}
