import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { aiSettingKey, protectAiCredential, type AiCredentialName } from "@/lib/aiCredentials";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { TOURNAMENT_TYPES } from "@/lib/taxonomy";
import { effectiveStatus, kstDayEnd, kstDayStart } from "@/lib/tournamentStatus";
import { toDbDate } from "@/lib/dbDate";

// 대회 참가비/보상 포인트 입력 필드 — 비워두면 null(없음), 값이 있으면 양의 정수만 허용
const TOURNAMENT_POINT_FIELDS = [
  ["entryFee", "참가비"],
  ["reward1st", "1위 보상"],
  ["reward2nd", "2위 보상"],
  ["reward3rd", "3위 보상"],
] as const;
type TournamentPointField = (typeof TOURNAMENT_POINT_FIELDS)[number][0];
const MAX_TOURNAMENT_POINT = 10_000_000;

// 관리자 정책 조회 (GET)
export async function GET(req: Request) {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 }); }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type === "GET_POLICY") {
    const [refund, shipping] = await Promise.all([
      getSetting("refund_policy"),
      getSetting("shipping_guide"),
    ]);
    return NextResponse.json({ refund_policy: refund ?? "", shipping_guide: shipping ?? "" });
  }

  return NextResponse.json({ error: "알 수 없는 요청" }, { status: 400 });
}

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
    if (b.type === "AI_CONNECTION_SAVE") {
      const values = [b.openai, b.naverClientId, b.naverClientSecret];
      if (values.some((v) => v != null && (typeof v !== "string" || v.length > 512))) {
        return NextResponse.json({ error: "API 키 형식이 올바르지 않습니다." }, { status: 400 });
      }
      if ((Boolean(b.naverClientId) && !b.naverClientSecret) || (!b.naverClientId && Boolean(b.naverClientSecret))) {
        return NextResponse.json({ error: "네이버 Client ID와 Secret을 함께 입력해 주세요." }, { status: 400 });
      }
      const entries: [AiCredentialName, string][] = ([
        ["openai", b.openai], ["naverClientId", b.naverClientId], ["naverClientSecret", b.naverClientSecret],
      ] as [AiCredentialName, string][]).filter((entry) => Boolean(entry[1]));
      await Promise.all(entries.map(([name, value]) => prisma.setting.upsert({ where: { key: aiSettingKey(name) }, update: { value: protectAiCredential(value) }, create: { key: aiSettingKey(name), value: protectAiCredential(value) } })));
      await log("AI_CONNECTION_SAVE", "AI_API", `OpenAI: ${b.openai ? "updated" : "unchanged"}, NAVER: ${b.naverClientId ? "updated" : "unchanged"}`);
      return NextResponse.json({ ok: true });
    }
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
        if (!["PENDING", "RESOLVED", "REJECTED"].includes(b.status)) return NextResponse.json({ error: "유효하지 않은 상태" }, { status: 400 });
        await prisma.report.update({ where: { id: b.id }, data: { status: b.status } });
        await log("REPORT_" + b.status, b.id); break;
      case "BOOKING_STATUS":
        if (!["REQUESTED", "CONFIRMED", "CANCELLED", "DONE"].includes(b.status)) return NextResponse.json({ error: "유효하지 않은 상태" }, { status: 400 });
        await prisma.booking.update({ where: { id: b.id }, data: { status: b.status } });
        await log("BOOKING_" + b.status, b.id); break;
      case "ENTRY_REVIEW": {
        if (!["REVIEW", "APPROVED", "REJECTED"].includes(b.status)) return NextResponse.json({ error: "유효하지 않은 상태" }, { status: 400 });
        if (!b.id || typeof b.id !== "string") return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        const exists = await prisma.tournamentEntry.findUnique({ where: { id: b.id }, select: { id: true } });
        if (!exists) return NextResponse.json({ error: "참가 기록을 찾을 수 없습니다." }, { status: 404 });
        await prisma.tournamentEntry.update({ where: { id: b.id }, data: { status: b.status } });
        await log("ENTRY_" + b.status, b.id); break;
      }
      case "USER_ROLE":
        if (!["SUPER_ADMIN", "ANGLER", "PARTNER"].includes(b.role)) return NextResponse.json({ error: "유효하지 않은 역할" }, { status: 400 });
        await prisma.user.update({ where: { id: b.id }, data: { role: b.role } });
        await log("USER_ROLE_" + b.role, b.id); break;
      case "USER_SUSPEND": {
        if (!b.id || typeof b.id !== "string") return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        if (b.id === user.id) return NextResponse.json({ error: "자기 자신의 상태는 변경할 수 없습니다." }, { status: 400 });
        const target = await prisma.user.findUnique({ where: { id: b.id } });
        if (!target) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
        await prisma.user.update({ where: { id: b.id }, data: { isActive: !target.isActive } });
        await log(target.isActive ? "USER_SUSPEND" : "USER_UNSUSPEND", b.id); break;
      }
      case "USER_DELETE": {
        if (!b.id || typeof b.id !== "string") return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        if (b.id === user.id) return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 });
        // 세션만 먼저 삭제 (로그인 차단), 나머지 연관 데이터는 onDelete: Cascade 적용됨
        await prisma.session.deleteMany({ where: { userId: b.id } });
        await prisma.user.delete({ where: { id: b.id } });
        await log("USER_DELETE", b.id); break;
      }
      case "TOURNAMENT_CREATE": {
        const title = typeof b.title === "string" ? b.title.trim() : "";
        if (!title) return NextResponse.json({ error: "대회명을 입력하세요." }, { status: 400 });
        // 참가비/순위 보상 포인트 — 비워두면 null(= 참가비 없음 / 보상 없음)
        const points: Record<TournamentPointField, number | null> = {
          entryFee: null, reward1st: null, reward2nd: null, reward3rd: null,
        };
        for (const [key, label] of TOURNAMENT_POINT_FIELDS) {
          const raw = b[key];
          if (raw === null || raw === undefined || raw === "") continue;
          const n = Number(raw);
          if (!Number.isInteger(n) || n <= 0 || n > MAX_TOURNAMENT_POINT) {
            return NextResponse.json(
              { error: `${label}은(는) 1 이상 ${MAX_TOURNAMENT_POINT.toLocaleString()} 이하의 정수로 입력하세요.` },
              { status: 400 },
            );
          }
          points[key] = n;
        }
        const tType = b.tType || "WEEKLY";
        if (!TOURNAMENT_TYPES.some((t) => t.key === tType)) {
          return NextResponse.json({ error: "유효하지 않은 대회 타입" }, { status: 400 });
        }
        // <input type="date"> 값은 KST 기준 하루 전체(00:00~23:59:59)로 해석한다.
        // new Date("2026-08-02") 는 UTC 자정(=KST 09:00)이라 그대로 쓰면 9시간 밀린다.
        const startAt = kstDayStart(b.startAt) ?? new Date();
        const endAt = kstDayEnd(b.endAt) ?? new Date(startAt.getTime() + 7 * 86400000);
        if (endAt <= startAt) {
          return NextResponse.json({ error: "종료일은 시작일보다 뒤여야 합니다." }, { status: 400 });
        }
        // 상태는 기간으로 결정한다(관리자가 고른 값이 기간과 어긋나면 즉시 뒤틀린다)
        await prisma.tournament.create({ data: {
          title, type: tType, speciesName: b.speciesName || null,
          description: b.description || null, rules: b.rules || "길이 cm 기준 순위",
          startAt, endAt,
          status: effectiveStatus({ startAt, endAt }), bannerUrl: b.bannerUrl || null,
          // 관리자가 올린 배너 (base64 data URI). 없으면 어종별 기본 배너로 폴백한다.
          bannerImage: b.bannerImage || null,
          ...points,
        }});
        await log("TOURNAMENT_CREATE", undefined, title); break;
      }
      case "TOURNAMENT_DELETE":
        if (!b.id || typeof b.id !== "string") return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        await prisma.tournament.delete({ where: { id: b.id } });
        await log("TOURNAMENT_DELETE", b.id); break;
      case "PRODUCT_CREATE":
        // 누락 컬럼 대비 ALTER TABLE (이미 있으면 무시)
        try { await prisma.$executeRawUnsafe(`ALTER TABLE \`Product\` ADD COLUMN \`stock\` INTEGER NOT NULL DEFAULT 0`); } catch {}
        try { await prisma.$executeRawUnsafe(`ALTER TABLE \`Product\` ADD COLUMN \`freeShippingThreshold\` INTEGER NOT NULL DEFAULT 0`); } catch {}
        // NOW()는 SQLite에 없으므로 바인딩으로 대체 (MariaDB/SQLite 공통 동작)
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`Product\` (\`id\`,\`sellerId\`,\`name\`,\`brand\`,\`category\`,\`price\`,\`shippingFee\`,\`freeShippingThreshold\`,\`options\`,\`imageUrl\`,\`buyUrl\`,\`description\`,\`feeRate\`,\`stock\`,\`createdAt\`)
           VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          randomUUID(),
          b.name, b.brand || null, b.category || "ETC",
          Number(b.price) || 0, Number(b.shippingFee) || 0,
          Number(b.freeShippingThreshold) || 0,
          b.options || null, b.imageUrl || null, b.buyUrl || "#",
          b.description || null, Number(b.feeRate) || 0, Number(b.stock) || 0,
          toDbDate(),
        );
        await log("PRODUCT_CREATE", undefined, b.name); break;
      case "PRODUCT_UPDATE": {
        const { id, name, brand, category, price, feeRate, shippingFee, description, imageUrl, options, stock, freeShippingThreshold } = b;
        // Product 테이블에는 updatedAt 컬럼이 없다(schema.prisma 기준). 포함하면 UPDATE 전체가 실패한다.
        await prisma.$executeRawUnsafe(
          `UPDATE \`Product\` SET \`name\`=?, \`brand\`=?, \`category\`=?, \`price\`=?, \`feeRate\`=?, \`shippingFee\`=?, \`description\`=?, \`imageUrl\`=?, \`options\`=?, \`stock\`=?, \`freeShippingThreshold\`=? WHERE \`id\`=?`,
          name, brand ?? null, category || "ETC", Number(price) || 0, Number(feeRate) || 0,
          Number(shippingFee) || 0, description ?? null, imageUrl ?? null, options ?? null,
          Number(stock) || 0, Number(freeShippingThreshold) || 0, id,
        );
        await log("PRODUCT_UPDATE", id, name); break;
      }
      case "PRODUCT_DELETE":
        await prisma.product.delete({ where: { id: b.id } });
        await log("PRODUCT_DELETE", b.id); break;
      case "SAVE_POLICY": {
        const refundVal = String(b.refund_policy ?? "");
        const shippingVal = String(b.shipping_guide ?? "");
        await Promise.all([
          prisma.setting.upsert({ where: { key: "refund_policy" }, update: { value: refundVal }, create: { key: "refund_policy", value: refundVal } }),
          prisma.setting.upsert({ where: { key: "shipping_guide" }, update: { value: shippingVal }, create: { key: "shipping_guide", value: shippingVal } }),
        ]);
        await log("SAVE_POLICY", "policy", "refund_policy+shipping_guide"); break;
      }
      case "LISTING_DELETE":
        await prisma.reservationListing.delete({ where: { id: b.id } });
        await log("LISTING_DELETE", b.id); break;
      case "BANNER_TOGGLE":
        const bn = await prisma.banner.findUnique({ where: { id: b.id } });
        await prisma.banner.update({ where: { id: b.id }, data: { active: !bn?.active } });
        await log("BANNER_TOGGLE", b.id); break;
      case "BANNER_CREATE":
        await prisma.banner.create({ data: { title: b.title, body: b.body || null, imageUrl: b.imageUrl || null, linkUrl: b.linkUrl || null, section: b.section || "main_top", active: true } });
        await log("BANNER_CREATE", undefined, b.title); break;
      case "SETTING_SET": {
        if (String(b.key || "").startsWith("ai_connection_")) return NextResponse.json({ error: "AI 키는 AI API 연결 메뉴에서만 변경할 수 있습니다." }, { status: 400 });
        // 비밀번호 찾기 인증번호는 Setting에 저장된다 — 관리자라도 임의로 만들 수 없어야 한다.
        if (String(b.key || "").startsWith("pwreset_")) return NextResponse.json({ error: "변경할 수 없는 설정입니다." }, { status: 400 });
        // 가상회원 일일 호출 집계는 시스템이 관리한다 — 한도 우회를 막기 위해 직접 수정을 금지한다.
        if (String(b.key || "").startsWith("virtual_member_usage")) return NextResponse.json({ error: "변경할 수 없는 설정입니다." }, { status: 400 });
        if (!b.key || typeof b.value === "undefined") return NextResponse.json({ error: "key와 value가 필요합니다." }, { status: 400 });
        const key = String(b.key);
        let value = String(b.value);
        // 쇼핑 메뉴가 꺼져 있으면 쇼핑 태그는 켤 수 없다.
        if (key === "shop_tag_enabled" && value === "true") {
          const shopMenuEnabled = await getBoolSetting("shop_menu_enabled");
          if (!shopMenuEnabled) value = "false";
        }
        // 포인트 기능이 꺼져 있으면 낚시단 유료 개설은 켤 수 없다.
        if (key === "group_points_required" && value === "true") {
          const pointsOn = await getBoolSetting("points_enabled");
          if (!pointsOn) value = "false";
        }
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
        await log("SETTING_SET", key, value); break;
      }
      case "BANNER_UPDATE":
        await prisma.banner.update({
          where: { id: b.id },
          data: {
            title: b.title,
            body: b.body || null,
            imageUrl: b.imageUrl || null,
            linkUrl: b.linkUrl || null,
            section: b.section || "main_top",
          },
        });
        await log("BANNER_UPDATE", b.id, b.title); break;
      case "BANNER_DELETE":
        await prisma.banner.delete({ where: { id: b.id } });
        await log("BANNER_DELETE", b.id); break;
      case "SPECIES_CREATE":
        await prisma.fishSpecies.create({ data: { slug: `sp-${b.label}-${Date.now()}`, label: b.label, water: b.water || "SEA" } });
        await log("SPECIES_CREATE", undefined, b.label); break;
      case "MARKET_STATUS":
        if (!["SELLING", "RESERVED", "SOLD"].includes(b.status)) return NextResponse.json({ error: "유효하지 않은 상태" }, { status: 400 });
        await prisma.marketListing.update({ where: { id: b.id }, data: { status: b.status } });
        await log("MARKET_STATUS", b.id, b.status); break;
      case "MARKET_DELETE":
        await prisma.marketMessage.deleteMany({ where: { chat: { listingId: b.id } } });
        await prisma.marketChat.deleteMany({ where: { listingId: b.id } });
        await prisma.marketFavorite.deleteMany({ where: { listingId: b.id } });
        await prisma.marketImage.deleteMany({ where: { listingId: b.id } });
        await prisma.marketListing.delete({ where: { id: b.id } });
        await log("MARKET_DELETE", b.id); break;
      default:
        return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // 내부 예외 메시지(스키마/SQL 정보)를 클라이언트에 그대로 노출하지 않는다
    console.error("[admin/action]", e);
    return NextResponse.json({ error: "처리 실패" }, { status: 500 });
  }
}
