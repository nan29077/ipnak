import { NextResponse } from "next/server";
import { getLegalData } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getLegalData();
  return NextResponse.json(data);
}
