import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const uuid = randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `ipnak-ball-${uuid}-${safeName}`;

    await writeFile(join(uploadsDir, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e: any) {
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }
}
