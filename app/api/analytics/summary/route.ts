import { NextRequest, NextResponse } from "next/server";
import { q, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BEHAVIOR = [
  "analyze_started", "analyze_completed", "script_generated", "storyboard_generated",
  "plan_generated", "export_completed", "history_viewed", "continue_creation_clicked",
];
const SYSTEM_ERR = ["AI_PROVIDER_ERROR", "DATABASE_ERROR", "INTERNAL_ERROR"];

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  if (!hasDatabase()) return NextResponse.json({ error: "无数据库" }, { status: 503 });

  const funnelKeys = ["signup", "analyze_started", "analyze_completed", "start_creation_clicked",
    "script_generated", "storyboard_generated", "plan_generated", "export_completed"] as const;
  const counts: Record<string, number> = {};
  for (const e of funnelKeys) {
    const r = await q<{ c: number }>(`SELECT count(*)::int AS c FROM events WHERE event = $1`, [e]);
    counts[e] = r[0]?.c ?? 0;
  }
  const regs = await q<{ c: number }>(`SELECT count(*)::int AS c FROM users`);
  const active7 = await q<{ c: number }>(`SELECT count(DISTINCT user_id)::int AS c FROM events WHERE created_at > now() - interval '7 days'`);
  const apiErr = await q<{ meta: any }>(`SELECT meta FROM events WHERE event = 'api_error'`);
  const errs = apiErr.map((r) => (typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta));
  const byEndpoint: Record<string, { total: number; r5xx: number; r502: number; r429: number; rate: number; system: number }> = {};
  for (const e of errs) {
    const ep = e?.endpoint || "unknown";
    const st = Number(e?.status ?? 500);
    const type = String(e?.errorType ?? "INTERNAL_ERROR");
    const b = (byEndpoint[ep] ||= { total: 0, r5xx: 0, r502: 0, r429: 0, rate: 0, system: 0 });
    b.total++;
    if (st >= 500) b.r5xx++;
    if (st === 502) b.r502++;
    if (st === 429) b.r429++;
    if (type === "RATE_LIMIT" || type === "IP_BLOCKED") b.rate++;
    if (SYSTEM_ERR.includes(type)) b.system++;
  }

  // D1 / D7（UTC 日，样本不足 rate=null）
  const today = new Date().toISOString().slice(0, 10);
  const signups = await q<{ user_id: string; day: string }>(`SELECT user_id, to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day FROM events WHERE event='signup'`);
  const behaved = await q<{ user_id: string; day: string }>(`SELECT DISTINCT user_id, to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day FROM events WHERE event = ANY($1)`, [BEHAVIOR]);
  const behavedSet = new Set(behaved.map((b) => `${b.user_id}:${b.day}`));
  const retention = (dayOffset: number) => {
    const eligible = signups.filter((s) => {
      const d = new Date(s.day + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + dayOffset);
      return d.toISOString().slice(0, 10) <= today;
    });
    const retained = eligible.filter((s) => {
      const d = new Date(s.day + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + dayOffset);
      return behavedSet.has(`${s.user_id}:${d.toISOString().slice(0, 10)}`);
    });
    return {
      eligible: eligible.length,
      retained: retained.length,
      rate: eligible.length ? Math.round((retained.length / eligible.length) * 1000) / 10 : null,
    };
  };

  return NextResponse.json({
    meta: { analyticsDay: "UTC" },
    metrics: { registeredUsers: regs[0]?.c ?? 0, activeUsers7d: active7[0]?.c ?? 0 },
    funnel: counts,
    retention: { d1: retention(1), d7: retention(7) },
    health: {
      aiFailures: counts.analyze_failed ?? 0,
      systemErrors: errs.filter((e) => SYSTEM_ERR.includes(String(e?.errorType))).length,
      byEndpoint,
    },
    tokenUsage: { hasData: false, note: "provider 未返回 usage，未记录 token（不估算）" },
  });
}
