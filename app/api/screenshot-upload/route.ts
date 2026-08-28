import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 截图本机上传（仅当无 BLOB_READ_WRITE_TOKEN 时回退用）。
 * 生产建议配 Blob（见 /api/screenshot-upload-url），本接口用于本地/开发演示。
 */
export async function POST(req: NextRequest) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "已配置对象存储，请改用直传票据接口" }, { status: 400 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请使用 multipart/form-data 上传" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少文件（字段名 file）" }, { status: 400 });
  }
  if (file.size <= 0) return NextResponse.json({ error: "文件为空" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "图片超过 20MB" }, { status: 413 });

  const ext = (path.extname(file.name || "") || ".png").toLowerCase();
  const name = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/screenshots/${name}` });
}
