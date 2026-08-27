import { NextRequest, NextResponse } from "next/server";
import { guardAiRequest } from "@/lib/ai-guard";
import { runCreativePipeline } from "@/lib/creative/coordinator";
import type { CreativeInput } from "@/lib/creative/tasks";
import { intentToPromptBlock } from "@/lib/creative/intent";

export const dynamic = "force-dynamic";

/** 运行一次「五人专业创作团队」决策，返回 Creative Intent（单一产物）+ 完整决策链。 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "creative");
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as CreativeInput;
  const run = await runCreativePipeline(body);
  return NextResponse.json({
    taskId: run.taskId,
    taskType: detectType(body),
    activatedRoles: run.activatedRoles,
    inactiveRoles: run.inactiveRoles,
    roleWeights: run.roleWeights,
    conflicts: run.conflicts,
    judgments: run.judgments,
    decision: run.decision,
    judgeCalls: run.judgeCalls,
    challengeTriggered: run.challengeTriggered,
    // 可直接注入 Script / Storyboard / Plan 的紧凑文本
    promptBlock: intentToPromptBlock(run.decision.creative_intent),
  });
}

function detectType(body: CreativeInput): string {
  return body.taskType ?? "auto";
}
