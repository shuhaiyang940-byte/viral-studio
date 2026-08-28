import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { putSignatureUrl, ensureOssCors, ossConfigured } from "@/lib/oss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 生成 OSS PUT 预签名 URL：前端用 XHR/fetch 直接 PUT 文件到 OSS（绕开 Vercel 4.5MB body 限制） */
export async function GET(req: NextRequest) {
  if (!ossConfigured()) {
    return NextResponse.json({ error: "OSS 尚未配置" }, { status: 500 });
  }
  const rawDir = req.nextUrl.searchParams.get("dir") || "";
  const dir = ["videos", "images"].includes(rawDir) ? rawDir : "videos";
  const contentType = req.nextUrl.searchParams.get("contentType") || "video/mp4";
  const ext = dir === "images"
    ? (contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "webp")
    : "mp4";
  const key = `${dir}/${randomUUID()}.${ext}`;

  try {
    await ensureOssCors(); // 幂等；配置失败仅记录，不影响后端签名
  } catch {
    /* ignore */
  }
  const { putUrl, publicUrl } = await putSignatureUrl(key, contentType);
  return NextResponse.json({ putUrl, publicUrl, key });
}
