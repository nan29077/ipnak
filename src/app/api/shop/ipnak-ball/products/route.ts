import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  IPNAK_ENABLED_KEY,
  IPNAK_PRODUCT_TYPES,
  ensureIpnakRawColumns,
  getIpnakPrices,
  normalizeProductType,
} from "@/lib/ipnakProduct";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureIpnakRawColumns();
    // ?type=ball | keyring — 없으면 전체(구매 바텀시트가 두 탭을 한 번에 채운다)
    const raw = new URL(req.url).searchParams.get("type");
    const products = raw
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM \`IpnakBallProduct\` WHERE \`isActive\` = 1 AND \`type\` = ? ORDER BY \`createdAt\` ASC`,
          normalizeProductType(raw)
        )
      : await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM \`IpnakBallProduct\` WHERE \`isActive\` = 1 ORDER BY \`createdAt\` ASC`
        );

    // 판매 스위치는 설정값, 판매가는 각 상품 레코드의 price가 기준이다.
    // 스위치가 켜져 있어도 판매할 상품이 없으면(=가격 없음) 구매 탭을 노출하지 않는다.
    const settings = await getSettings(IPNAK_PRODUCT_TYPES.map((t) => IPNAK_ENABLED_KEY[t]));
    const prices = await getIpnakPrices();
    const config = Object.fromEntries(
      IPNAK_PRODUCT_TYPES.map((t) => [
        t,
        { enabled: settings[IPNAK_ENABLED_KEY[t]] === "true" && prices[t] > 0, price: prices[t] },
      ])
    );

    return NextResponse.json({
      products: products.map((p) => ({ ...p, type: normalizeProductType(p.type), isActive: Boolean(p.isActive), optionEnabled: Boolean(p.optionEnabled) })),
      config,
    });
  } catch {
    return NextResponse.json({ error: "상품 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
