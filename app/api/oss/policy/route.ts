import { NextRequest, NextResponse } from "next/server";
import { createPostPolicy, ensureOssCors, ossConfigured } from "@/lib/oss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 生成 OSS POST 表单直传 policy：前端把 file + policy 直接 POST 到 OSS，绕开 Vercel 4.5MB body 限制 */
export async function GET(req: NextRequest) {
  if (!ossConfigured()) {
    return NextResponse.json({ error: "OSS 尚未配置" }, { status: 500 });
  }
  const rawDir = req.nextUrl.searchParams.get("dir") || "";
  const dir = rawDir === "images" ? "images" : "videos";
  const ext = dir === "images" ? "png" : "mp4";
  try {
    await ensureOssCors(); // 幂等；失败仅记录
  } catch {
    /* ignore */
  }
  return NextResponse.json(await createPostPolicy(dir, ext));
}
