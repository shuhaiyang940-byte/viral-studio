// Coordinator：团队负责人 / 决策系统。只做调度、比较、仲裁、约束、汇总。
// 绝不自己编造专业知识；专业知识必须来自各角色判断 / 知识库。

import { randomUUID } from "node:crypto";
import { q, hasDatabase } from "@/lib/db";
import { buildFactSheet } from "./fact-sheet";
import { detectTaskType, TASK_PROFILES, type CreativeInput } from "./tasks";
import { activateRoles, toRoleActivations, resolveActivatedRoles } from "./activation";
import { judgeRole } from "./roles";
import { detectAndResolve, summaryReason, hasVeto } from "./conflict";
import { buildIntent } from "./intent";
import type {
  CreativeDecision, CreativeFactSheet, RoleJudgment, CreativeConflict,
} from "./types";
import type { Role } from "@/lib/knowledge-logic";

export interface CreativeRunResult {
  taskId: string | null;
  activatedRoles: Role[];
  inactiveRoles: Role[];
  roleWeights: Record<Role, number>;
  judgments: RoleJudgment[];
  conflicts: CreativeConflict[];
  decision: CreativeDecision;
  judgeCalls: number;
  challengeTriggered: boolean;
}

function normalizeWeights(w: Record<Role, number>, roles: Role[]): Record<Role, number> {
  const sum = roles.reduce((s, r) => s + (w[r] ?? 0), 0);
  if (sum === 0) return { ...w };
  const out = { ...w };
  roles.forEach((r) => { out[r] = Math.round(((w[r] ?? 0) / sum) * 100) / 100; });
  return out;
}

export async function runCreativePipeline(input: CreativeInput): Promise<CreativeRunResult> {
  const taskType = detectTaskType(input);
  const profile = TASK_PROFILES[taskType];
  const facts: CreativeFactSheet = buildFactSheet(input, taskType);
  if (input.audience) facts.audience = input.audience;
  if (input.goal) facts.goal = input.goal;
  if (input.platform) facts.platform = input.platform;
  if (input.content_type) facts.content_type = input.content_type;

  const activation = activateRoles(profile, {
    goal: input.goal, platform: input.platform, content_type: input.content_type,
    budget: input.budget, time: input.time, materials: input.materials,
  });

  const { activated: activatedRoles, weights: rawActivatedWeights } = resolveActivatedRoles(
    activation,
    facts,
    input.problem ?? ""
  );
  const roleWeights = normalizeWeights(rawActivatedWeights, activatedRoles);
  const inactiveRoles: Role[] = (Object.keys(rawActivatedWeights) as Role[]).filter(
    (r) => !activatedRoles.includes(r)
  );
  let judgeCalls = 0;

  // 每个激活角色独立判断（并行，节省时间；绝不把五段文字拼一起）
  const judged = await Promise.all(activatedRoles.map(async (role) => {
    judgeCalls += 1;
    return judgeRole(role, facts);
  }));

  let judgments = judged;
  let conflicts = detectAndResolve(judgments, facts, roleWeights, profile.veto);
  let challengeTriggered = false;

  // 仅在「确有其冲突」时才做一次二次质询（成本控制；无冲突绝不重复调用）
  if (profile.allowChallenge && conflicts.length > 0 && !hasVeto(conflicts)) {
    conflictRoles(conflicts).forEach((r) => { judgeCalls += 1; });
    challengeTriggered = true;
    const challengedRoles = conflictRoles(conflicts);
    const rejudged = await Promise.all(challengedRoles.map((r) => judgeRole(r, facts)));
    judgments = judgments.map((j) => rejudged.find((rj) => rj.role === j.role) ?? j);
    conflicts = detectAndResolve(judgments, facts, roleWeights, profile.veto);
  }

  const intent = buildIntent({ facts, judgments, conflicts, activatedRoles, roleWeights });
  const confidence = judgments.length
    ? Math.round((judgments.reduce((s, j) => s + j.confidence, 0) / judgments.length) * 100) / 100
    : 0;

  const decision: CreativeDecision = {
    final_decision: intent.core_message,
    confidence,
    activated_roles: activatedRoles,
    role_weights: roleWeights,
    conflicts,
    knowledge_used: Array.from(new Set(judgments.flatMap((j) => j.knowledgeIds))),
    creative_intent: intent,
    reason: summaryReason(conflicts),
  };

  const taskId = await persistCreative(facts, rawActivatedWeights, inactiveRoles, judgments, conflicts, intent, decision, profile.veto);
  return {
    taskId,
    activatedRoles,
    inactiveRoles,
    roleWeights,
    judgments,
    conflicts,
    decision,
    judgeCalls,
    challengeTriggered,
  };
}

function conflictRoles(conflicts: CreativeConflict[]): Role[] {
  const set = new Set<Role>();
  conflicts.forEach((c) => c.roles.forEach((r) => set.add(r)));
  return [...set];
}

async function persistCreative(
  facts: CreativeFactSheet,
  rawWeights: Record<Role, number>,
  inactiveRoles: Role[],
  judgments: RoleJudgment[],
  conflicts: CreativeConflict[],
  intent: ReturnType<typeof buildIntent>,
  decision: CreativeDecision,
  vetoRoles: Role[]
): Promise<string | null> {
  if (!hasDatabase()) return null;
  const taskId = randomUUID();
  try {
    await q(`INSERT INTO creative_task (id, task_type, user_goal, platform, content_type, status, done_at) VALUES ($1,$2,$3,$4,$5,'done',now())`,
      [taskId, facts.taskType, facts.goal, facts.platform, facts.content_type]);

    // role_activation
    const actRows = [...new Set([...Object.keys(rawWeights).filter((r) => rawWeights[r as Role] > 0), ...inactiveRoles])] as Role[];
    for (const r of actRows) {
      const state = inactiveRoles.includes(r) ? "inactive" : (rawWeights[r as Role] ? "required" : "optional");
      await q(`INSERT INTO role_activation (id, task_id, role, state, weight, reason) VALUES ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), taskId, r, state, rawWeights[r] ?? 0, state === "inactive" ? "本任务不需要" : "本次激活"]);
    }

    for (const j of judgments) {
      await q(`INSERT INTO role_judgment (id, task_id, role, conclusion, confidence, evidence, recommendations, risks, objections, must_have, should_have, avoid, questions, knowledge_ids, evidence_source)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [randomUUID(), taskId, j.role, j.conclusion, j.confidence, JSON.stringify(j.evidence), JSON.stringify(j.recommendations),
         JSON.stringify(j.risks), JSON.stringify(j.objections), JSON.stringify(j.must_have), JSON.stringify(j.should_have),
         JSON.stringify(j.avoid), JSON.stringify(j.questions), JSON.stringify(j.knowledgeIds), j.evidenceSource]);
    }

    for (const c of conflicts) {
      await q(`INSERT INTO creative_conflict (id, task_id, conflict_type, roles, evidence, severity, resolution, winner, reason, unresolved)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [randomUUID(), taskId, c.conflictType, JSON.stringify(c.roles), JSON.stringify(c.evidence), c.severity,
         c.resolution, c.winner, c.reason, c.unresolved]);
    }

    const intentId = randomUUID();
    await q(`INSERT INTO creative_intent (id, task_id, goal, platform, audience, content_type, core_message, narrative_intent, market_intent, execution_intent, editing_intent, audience_intent, priority_rules, hard_constraints, soft_constraints, risks, unresolved_questions, activated_roles, role_weights, evidence_summary)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [intentId, taskId, intent.goal, intent.platform, intent.audience, intent.content_type, intent.core_message,
       intent.narrative_intent, intent.market_intent, intent.execution_intent, intent.editing_intent, intent.audience_intent,
       JSON.stringify(intent.priority_rules), JSON.stringify(intent.hard_constraints), JSON.stringify(intent.soft_constraints),
       JSON.stringify(intent.risks), JSON.stringify(intent.unresolved_questions), JSON.stringify(intent.activated_roles),
       JSON.stringify(intent.role_weights), intent.evidence_summary]);

    await q(`INSERT INTO creative_decision (id, task_id, final_decision, confidence, activated_roles, role_weights, conflicts, knowledge_used, creative_intent_id, reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [randomUUID(), taskId, decision.final_decision, decision.confidence, JSON.stringify(decision.activated_roles),
       JSON.stringify(decision.role_weights), JSON.stringify(decision.conflicts), JSON.stringify(decision.knowledge_used),
       intentId, decision.reason]);
    return taskId;
  } catch (e) {
    console.warn("[coordinator] 持久化失败：", e);
    return taskId; // 决策照常返回，审计落库失败仅告警
  }
}
