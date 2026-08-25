// 用户行为事件（Beta 期最小埋点）。只记录产品行为，不采集原始视频/完整输入等敏感数据。
// 仅服务端引用（/api/*），切勿在 'use client' 中 import。

import { q, hasDatabase } from "./db";

export const EVENTS = {
  signup: "signup",
  login: "login",
  analyze_started: "analyze_started",
  analyze_completed: "analyze_completed",
  analyze_failed: "analyze_failed",
  report_viewed: "report_viewed",
  start_creation_clicked: "start_creation_clicked",
  script_generated: "script_generated",
  storyboard_generated: "storyboard_generated",
  plan_generated: "plan_generated",
  export_completed: "export_completed",
  history_viewed: "history_viewed",
  continue_creation_clicked: "continue_creation_clicked",
  feedback_positive: "feedback_positive",
  feedback_negative: "feedback_negative",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export async function logEvent(opts: {
  userId?: string | null;
  event: EventName | string;
  assetId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await q(
      `INSERT INTO events (user_id, event, asset_id, meta) VALUES ($1, $2, $3, $4)`,
      [opts.userId ?? null, opts.event, opts.assetId ?? null, JSON.stringify(opts.meta ?? {})]
    );
  } catch (e) {
    console.warn("[analytics] 记录事件失败（不影响主流程）：", e);
  }
}
