import { NextRequest, NextResponse } from "next/server";
import { generateReplica } from "@/lib/replica";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID: Category[] = ["生活", "旅游", "美食", "情感", "知识", "商业"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category = body.category as Category;
  if (!VALID.includes(category)) {
    return NextResponse.json({ error: "无效的赛道" }, { status: 400 });
  }
  // 注：isPro 由前端门禁传入（demo 性质，与全站 localStorage 配额一致）。
  // 真实付费校验应在此读取服务端 session；当前项目无后端付费系统，故沿用前端传入。
  const result = generateReplica({
    category,
    platform: typeof body.platform === "string" ? body.platform : undefined,
    style: typeof body.style === "string" ? body.style : undefined,
    topic: typeof body.topic === "string" ? body.topic : undefined,
    isPro: body.isPro === true,
  });
  return NextResponse.json(result);
}
