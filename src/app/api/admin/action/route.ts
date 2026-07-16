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

  // 큐레이션/섹션/프로 기능은 db push 전 모델이 없을 수 있음 → graceful 안내
  const cf = (prisma as any).curationFeature;
  const cs = (prisma as any).curationSection;
  const pa = (prisma as any).proAngler;
  if (typeof b.type === "string" && b.type.startsWith("CURATION_") && !cf) {
    return NextResponse.json({ error: "큐레이션 기능은 npm run db:push 실행 후 사용할 수 있습니다." }, { status: 503 });
  }
  if (typeof b.type === "string" && b.type.startsWith("SECTION_") && !cs) {
    return NextResponse.json({ error: "섹션 관리 기능은 npm run db:push 실행 후 사용할 수 있습니다." }, { status: 503 });
  }
  if (typeof b.type === "string" && b.type.startsWith("PRO_") && (!pa || !cs)) {
    return NextResponse.json({ error: "프로 관리 기능은 npm run db:push 실행 후 사용할 수 있습니다." }, { status: 503 });
  }

  // SECTION 파라미터(어종/지역/테마/기간) → JSON params 빌드
  const buildParams = () => {
    const p: any = {};
    if (b.species) p.species = b.species;
    if (b.region) p.region = b.region;
    if (b.keywords) p.keywords = String(b.keywords).split(/[,\s]+/).filter(Boolean);
    if (b.period) p.period = b.period;
    if (b.style) p.style = b.style;
    return JSON.stringify(p);
  };

  try {
    switch (b.type) {
      case "PRO_CREATE": {
        let linkedUserId: string | null = null;
        if (b.linkedNickname) {
          const u = await prisma.user.findFirst({ where: { nickname: String(b.linkedNickname) } });
          linkedUserId = u?.id ?? null;
        }
        const pro = await pa.create({ data: { name: b.name || "프로", imageUrl: b.imageUrl || null, bio: b.bio || null, linkedUserId } });
        const agg = await cs.aggregate({ _max: { order: true } });
        const order = (agg?._max?.order ?? 0) + 10;
        await cs.create({ data: { key: `pro_${pro.id}`, title: `${pro.name} 프로 추천 포인트`, type: "PRO", params: JSON.stringify({ proId: pro.id, period: "weekly" }), mode: "AUTO", order, visible: true } });
        await log("PRO_CREATE", pro.id, b.name); break;
      }
      case "PRO_DELETE": {
        await cs.deleteMany({ where: { key: `pro_${b.id}` } });
        await pa.delete({ where: { id: b.id } });
        await log("PRO_DELETE", b.id); break;
      }
      case "PRO_TOGGLE": {
        const pro = await pa.findUnique({ where: { id: b.id } });
        const nv = !pro?.visible;
        await pa.update({ where: { id: b.id }, data: { visible: nv } });
        await cs.updateMany({ where: { key: `pro_${b.id}` }, data: { visible: nv } });
        await log("PRO_TOGGLE", b.id); break;
      }
      case "SECTION_CREATE": {
        const agg = await cs.aggregate({ _max: { order: true } });
        const order = (agg?._max?.order ?? 0) + 10;
        const baseKey = `sec_${(b.sType || "SPECIES").toLowerCase()}_${Date.now().toString(36)}`;
        await cs.create({ data: { key: baseKey, title: b.title || "새 섹션", type: b.sType || "SPECIES", params: buildParams(), mode: b.mode || "AUTO", order, visible: true } });
        await log("SECTION_CREATE", baseKey, b.title); break;
      }
      case "SECTION_UPDATE": {
        const data: any = {};
        if (b.title != null) data.title = b.title;
        if (b.mode != null) data.mode = b.mode;
        if (b.species != null || b.region != null || b.keywords != null || b.period != null || b.style != null) data.params = buildParams();
        await cs.update({ where: { id: b.id }, data });
        await log("SECTION_UPDATE", b.id); break;
      }
      case "SECTION_DELETE":
        await cs.delete({ where: { id: b.id } });
        await log("SECTION_DELETE", b.id); break;
      case "SECTION_TOGGLE": {
        const row = await cs.findUnique({ where: { id: b.id } });
        await cs.update({ where: { id: b.id }, data: { visible: !row?.visible } });
        await log("SECTION_TOGGLE", b.id); break;
      }
      case "SECTION_MOVE": {
        const row = await cs.findUnique({ where: { id: b.id } });
        if (row) {
          const neighbor = await cs.findFirst({
            where: { order: b.dir === "up" ? { lt: row.order } : { gt: row.order } },
            orderBy: { order: b.dir === "up" ? "desc" : "asc" },
          });
          if (neighbor) {
            await cs.update({ where: { id: row.id }, data: { order: neighbor.order } });
            await cs.update({ where: { id: neighbor.id }, data: { order: row.order } });
          }
        }
        await log("SECTION_MOVE", b.id, b.dir); break;
      }
      case "CURATION_ADD": {
        const agg = await cf.aggregate({ where: { section: b.section }, _max: { order: true } });
        const order = (agg?._max?.order ?? -1) + 1;
        await cf.upsert({
          where: { section_postId: { section: b.section, postId: b.postId } },
          update: { visible: true },
          create: { section: b.section, postId: b.postId, order, visible: true, pinnedById: user.id },
        });
        await log("CURATION_ADD", b.postId, b.section); break;
      }
      case "CURATION_REMOVE":
        await cf.delete({ where: { id: b.id } });
        await log("CURATION_REMOVE", b.id); break;
      case "CURATION_TOGGLE": {
        const row = await cf.findUnique({ where: { id: b.id } });
        await cf.update({ where: { id: b.id }, data: { visible: !row?.visible } });
        await log("CURATION_TOGGLE", b.id); break;
      }
      case "CURATION_MOVE": {
        const row = await cf.findUnique({ where: { id: b.id } });
        if (row) {
          const neighbor = await cf.findFirst({
            where: { section: row.section, order: b.dir === "up" ? { lt: row.order } : { gt: row.order } },
            orderBy: { order: b.dir === "up" ? "desc" : "asc" },
          });
          if (neighbor) {
            await cf.update({ where: { id: row.id }, data: { order: neighbor.order } });
            await cf.update({ where: { id: neighbor.id }, data: { order: row.order } });
          }
        }
        await log("CURATION_MOVE", b.id, b.dir); break;
      }
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
