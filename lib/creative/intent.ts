// Creative Intent：最终创作模型只接收这一个结构化产物，绝不接收五段聊天记录。

import type {
  CreativeConflict, CreativeFactSheet, CreativeIntent, RoleJudgment,
} from "./types";
import type { Role } from "@/lib/knowledge-logic";
import { summaryReason } from "./conflict";

export function buildIntent(params: {
  facts: CreativeFactSheet;
  judgments: RoleJudgment[];
  conflicts: CreativeConflict[];
  activatedRoles: Role[];
  roleWeights: Record<Role, number>;
}): CreativeIntent {
  const { facts, judgments, conflicts, activatedRoles, roleWeights } = params;
  const by = (r: Role) => judgments.find((j) => j.role === r);
  const dir = by("DIRECTOR");
  const op = by("OPERATOR");
  const prod = by("PRODUCER");
  const ed = by("EDITOR");
  const au = by("AUDIENCE");

  const risks = Array.from(new Set(judgments.flatMap((j) => j.risks)));
  const unresolved = Array.from(new Set(judgments.flatMap((j) => j.questions)));
  conflicts.forEach((c) => { if (c.unresolved) unresolved.push(c.reason); });

  const hard: string[] = [];
  const soft: string[] = [];
  judgments.forEach((j) => { j.must_have.forEach((m) => soft.push(`${j.role}: ${m}`)); j.should_have.forEach((m) => soft.push(`${j.role}(建议): ${m}`)); });
  conflicts.forEach((c) => {
    if (c.severity >= 0.9) hard.push(`否决(${c.winner}): ${c.resolution}`);
    else soft.push(`裁决(${c.conflictType}): ${c.resolution}`);
  });

  return {
    goal: facts.goal || "未指定目标",
    platform: facts.platform || "未指定平台",
    audience: facts.audience || "泛用户",
    content_type: facts.content_type || "通用",
    core_message: dir?.conclusion || op?.conclusion || "请按用户目标形成核心表达",
    narrative_intent: dir?.recommendations.join("；") || "按内容类型选择叙事节奏",
    market_intent: op?.recommendations.join("；") || "按平台规则打磨钩子与CTA",
    execution_intent: prod?.recommendations.join("；") || "控制成本，优先可执行",
    editing_intent: ed?.recommendations.join("；") || "控制节奏，适当加密度",
    audience_intent: au?.recommendations.join("；") || "前3秒给信息，避免自嗨",
    priority_rules: [summaryReason(conflicts), `权重：${Object.entries(roleWeights).filter(([, v]) => v > 0).map(([r, v]) => `${r}=${v}`).join(" ") || "—"}`],
    hard_constraints: hard,
    soft_constraints: soft,
    risks,
    unresolved_questions: unresolved,
    activated_roles: activatedRoles,
    role_weights: roleWeights,
    evidence_summary: summaryReason(conflicts),
  };
}

/** 注入 Prompt 的紧凑上下文块（替代五段角色原文）。 */
export function intentToPromptBlock(intent: CreativeIntent): string {
  const lines: string[] = [];
  lines.push(`【团队创作方案 · 由 ${intent.activated_roles.join("/") || "协调器"} 综合】`);
  lines.push(`- 目标：${intent.goal}｜平台：${intent.platform}｜受众：${intent.audience}｜类型：${intent.content_type}`);
  lines.push(`- 核心表达：${intent.core_message}`);
  if (intent.narrative_intent) lines.push(`- 叙事：${intent.narrative_intent}`);
  if (intent.market_intent) lines.push(`- 运营：${intent.market_intent}`);
  if (intent.execution_intent) lines.push(`- 执行：${intent.execution_intent}`);
  if (intent.editing_intent) lines.push(`- 剪辑：${intent.editing_intent}`);
  if (intent.audience_intent) lines.push(`- 观众：${intent.audience_intent}`);
  if (intent.hard_constraints.length) lines.push(`- 硬约束：${intent.hard_constraints.join("；")}`);
  if (intent.soft_constraints.length) lines.push(`- 建议：${intent.soft_constraints.slice(0, 6).join("；")}`);
  if (intent.risks.length) lines.push(`- 风险：${intent.risks.slice(0, 3).join("；")}`);
  if (intent.unresolved_questions.length) lines.push(`- 待确认：${intent.unresolved_questions.slice(0, 3).join("；")}`);
  lines.push("请严格遵循以上方案，不要自行改变核心方向。");
  return lines.join("\n");
}

/** 从 Intent 提取镜头硬约束（供 Storyboard / Plan 落地）。 */
export function intentShotRules(intent: CreativeIntent): {
  maxShots: number | null;
  maxShotSec: number | null;
} {
  let maxShots: number | null = null;
  let maxShotSec: number | null = null;
  const all = intent.hard_constraints
    .concat(intent.soft_constraints, [intent.editing_intent, intent.narrative_intent])
    .join(" ");
  const m = all.match(/镜头\s*[数≤数量不超过]{0,4}\s*(\d+)/);
  if (m) maxShots = Number(m[1]);
  const s = all.match(/(\d)\s*秒|镜头\S{0,4}(\d)\s*s/i);
  if (s) maxShotSec = Number(s[1] || s[2]);
  return { maxShots, maxShotSec };
}
