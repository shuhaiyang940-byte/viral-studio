import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { runLearningJob } from "@/lib/learning/job";

export const dynamic = "force-dynamic";

/** 手动触发一次每日学习（幂等）。需 ADMIN_TOKEN。 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const result = await runLearningJob({
    runDate: typeof body.runDate === "string" ? body.runDate : undefined,
    maxItems: typeof body.maxItems === "number" ? body.maxItems : undefined,
    budgetAiCalls: typeof body.budgetAiCalls === "number" ? body.budgetAiCalls : undefined,
    idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : "daily",
    changedBy: "admin",
  });
  return NextResponse.json(result, { status: result.status === "PAUSED" ? 503 : 200 });
}
