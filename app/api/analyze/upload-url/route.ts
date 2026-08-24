import { NextRequest, NextResponse } from "next/server";
import { guardAiRequest } from "@/lib/ai-guard";
import { createVideoUploadTicket } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 获取视频直传票据（Blob 模式）或回退标记（本机模式） */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "analyze");
  if (!g.ok) return g.res;
  return NextResponse.json(await createVideoUploadTicket());
}
