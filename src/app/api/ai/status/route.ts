import { NextResponse } from "next/server";
import { getAiConnectionStatus } from "@/lib/aiCredentials";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAiConnectionStatus());
}
