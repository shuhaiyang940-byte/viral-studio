import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logEvent, EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_EVENTS = new Set<string>([
  EVENTS.report_viewed,
  EVENTS.start_creation_clicked,
  EVENTS.continue_creation_clicked,
  EVENTS.feedback_positive,
  EVENTS.feedback_negative,
]);

/** 前端轻量埋点：POST { event, assetId?, meta? }（仅记录产品行为，未登录也可记录 userId=null） */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { event?: string; assetId?: string; meta?: Record<string, unknown> };
  const event = String(body.event ?? "");
  if (!CLIENT_EVENTS.has(event)) return NextResponse.json({ error: "无效事件" }, { status: 400 });
  const user = await getCurrentUser();
  await logEvent({ userId: user?.id, event, assetId: typeof body.assetId === "string" ? body.assetId : undefined, meta: body.meta });
  return NextResponse.json({ ok: true });
}
