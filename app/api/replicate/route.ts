import { NextRequest, NextResponse } from "next/server";
import { generateReplica } from "@/lib/replica";
import type { Category } from "@/lib/types";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { requireEntitlement, isProTier } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID: Category[] = ["生活", "旅游", "美食", "情感", "知识", "商业"];

export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "replicate");
  if (!g.ok) return g.res;

  // 权限只来自服务端：读当前登录用户 → 数据库真实 tier → entitlement。
  // 客户端即使传 isPro:true 也会被忽略（下方不再读取 body.isPro）。
  const user = await getCurrentUser();
  const entReq = await requireEntitlement(user?.id, "replica");
  if (!entReq.ok) {
    return NextResponse.json({ error: entReq.error }, { status: entReq.status });
  }

  const body = await req.json().catch(() => ({}));
  const category = body.category as Category;
  if (!VALID.includes(category)) {
    return NextResponse.json({ error: "无效的赛道" }, { status: 400 });
  }
  const result = generateReplica({
    category,
    platform: typeof body.platform === "string" ? body.platform : undefined,
    style: typeof body.style === "string" ? body.style : undefined,
    topic: typeof body.topic === "string" ? body.topic : undefined,
    // isPro 由服务端真实档位决定，客户端无法伪造
    isPro: isProTier(entReq.ent?.tier),
  });
  return NextResponse.json(result);
}
