export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getReferralEarnings } from "@/lib/referral";

export async function GET() {
  let user; try { user = await requireUser(); } catch { return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); }
  const data = await getReferralEarnings(user.id);
  return NextResponse.json(data);
}
