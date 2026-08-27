import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getLearningReport } from "@/lib/learning/report";

export const dynamic = "force-dynamic";

/** 学习审计报告（今天学了什么 / 来自哪 / 用量 / 源状态）。需 ADMIN_TOKEN。 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json(await getLearningReport());
}
