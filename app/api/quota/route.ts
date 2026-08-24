import { NextRequest, NextResponse } from "next/server";
import { getQuotaInfo } from "@/lib/quota-server";

export const dynamic = "force-dynamic";

/** 当前分析配额（登录用户按账号，匿名按 IP） */
export async function GET(req: NextRequest) {
  const quota = await getQuotaInfo(req);
  return NextResponse.json({ quota });
}
