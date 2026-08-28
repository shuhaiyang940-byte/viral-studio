import { NextRequest, NextResponse } from "next/server";
import { readDiagLogs } from "@/lib/diag-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 读取诊断日志（需 ADMIN_TOKEN；用于排查上传故障与回看历史动作） */
export async function GET(req: NextRequest) {
  const admin = process.env.ADMIN_TOKEN;
  const token = req.headers.get("x-admin-token");
  if (admin && token !== admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = req.nextUrl.searchParams.get("sessionId") || undefined;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 500);
  const rows = await readDiagLogs(Number.isFinite(limit) ? limit : 100, sessionId);
  return NextResponse.json({ rows });
}
