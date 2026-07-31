import { NextResponse } from "next/server";
import { getAiConnectionStatus } from "@/lib/aiCredentials";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await getAiConnectionStatus());
}
