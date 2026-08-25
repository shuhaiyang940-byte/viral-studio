import { NextRequest, NextResponse } from "next/server";
import { q, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 管理员行为汇总（需 ADMIN_TOKEN）。返回漏斗/功能计数/重度用户，供判断产品去向。 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  if (!hasDatabase()) return NextResponse.json({ error: "无数据库" }, { status: 503 });

  const events = [
    "signup", "login", "analyze_started", "analyze_completed", "analyze_failed",
    "report_viewed", "start_creation_clicked", "continue_creation_clicked",
    "script_generated", "storyboard_generated", "plan_generated",
    "export_completed", "history_viewed", "feedback_positive", "feedback_negative",
  ];
  const counts: Record<string, number> = {};
  for (const e of events) {
    const r = await q<{ c: number }>(`SELECT count(*)::int AS c FROM events WHERE event = $1`, [e]);
    counts[e] = r[0]?.c ?? 0;
  }
  const top = await q<{ user_id: string | null; c: number }>(
    `SELECT user_id, count(*)::int AS c FROM events
     WHERE event IN ('script_generated','storyboard_generated','plan_generated','analyze_completed')
     GROUP BY user_id ORDER BY c DESC LIMIT 10`
  );
  return NextResponse.json({ counts, topUsers: top.map((t) => ({ userId: t.user_id, count: t.c })) });
}
