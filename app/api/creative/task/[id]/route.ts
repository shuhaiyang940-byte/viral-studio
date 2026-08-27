import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 查看完整决策链（审计）。需 ADMIN_TOKEN。 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const task = (await q<Record<string, any>>(`SELECT * FROM creative_task WHERE id = $1`, [id]).catch(() => []))[0];
  if (!task) return NextResponse.json({ error: "task 不存在" }, { status: 404 });

  const activations = await q<Record<string, any>>(`SELECT role, state, weight, reason FROM role_activation WHERE task_id = $1 ORDER BY created_at`, [id]).catch(() => []);
  const judgments = await q<Record<string, any>>(`SELECT role, conclusion, confidence, evidence, recommendations, risks, objections, must_have, should_have, avoid, questions, knowledge_ids, evidence_source FROM role_judgment WHERE task_id = $1 ORDER BY created_at`, [id]).catch(() => []);
  const conflicts = await q<Record<string, any>>(`SELECT conflict_type, roles, evidence, severity, resolution, winner, reason, unresolved FROM creative_conflict WHERE task_id = $1 ORDER BY created_at`, [id]).catch(() => []);
  const intent = (await q<Record<string, any>>(`SELECT * FROM creative_intent WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]).catch(() => []))[0] ?? null;
  const decision = (await q<Record<string, any>>(`SELECT * FROM creative_decision WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]).catch(() => []))[0] ?? null;

  return NextResponse.json({ task, activations, judgments, conflicts, intent, decision });
}
