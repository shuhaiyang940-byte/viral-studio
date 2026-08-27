// 角色激活引擎：按任务动态召集，绝不全员出动、绝不均权。

import type { TaskProfile } from "./types";
import type { ActivationResult, RoleActivation, CreativeFactSheet } from "./types";
import type { Role } from "@/lib/knowledge-logic";

export interface ActivationContext {
  goal?: string;
  platform?: string;
  content_type?: string;
  budget?: string;
  time?: string;
  materials?: string;
  taskTypeLabel?: string;
}

/** 计算本次任务要召集哪些角色。 */
export function activateRoles(profile: TaskProfile, ctx: ActivationContext): ActivationResult {
  const roleWeights = { ...profile.weights } as Record<Role, number>;
  const reasons: Record<Role, string> = {} as Record<Role, string>;
  const required: Role[] = [...profile.required];
  const optional: Role[] = [...profile.optional];
  const add = (r: Role, state: "required" | "optional") => {
    if (required.includes(r) || optional.includes(r)) return;
    if (state === "required") required.push(r);
    else optional.push(r);
  };

  // 用户目标 / 硬约束 > 角色默认（P1 校准：让真正有用的人在正确时间介入）
  const goal = ctx.goal ?? "";
  const lowBudget = /低|省|便宜|有限|少|控制|500|几百/i.test(`${ctx.budget ?? ""} ${ctx.time ?? ""}`);
  const growth = /涨粉|转化|流量|带货|增长|卖/i.test(goal);
  const brand = /品牌|质感|形象|宣传|调性/i.test(goal);

  if (growth) {
    add("OPERATOR", "optional");
    roleWeights.OPERATOR = Math.max(roleWeights.OPERATOR, 0.15);
    reasons.OPERATOR = "用户目标含增长，召回运营判断平台与转化";
  }
  if (brand) {
    add("DIRECTOR", "optional");
    roleWeights.DIRECTOR = Math.max(roleWeights.DIRECTOR, 0.15);
    reasons.DIRECTOR = "用户目标含品牌/质感，召回导演做表达";
  }
  if (lowBudget) {
    add("PRODUCER", "optional");
    roleWeights.PRODUCER = Math.max(roleWeights.PRODUCER, 0.1);
    reasons.PRODUCER = "成本/时间受限，召回制片评估可执行性";
  }

  // 未激活的 profile.inactive 保持 inactive（且权重 = 0）
  const inactive: Role[] = [];
  profile.inactive.forEach((r) => {
    if (required.includes(r) || optional.includes(r)) return;
    inactive.push(r);
    roleWeights[r] = 0;
    reasons[r] = `本任务不需要（成本控制）`;
  });

  required.forEach((r) => { if (!reasons[r]) reasons[r] = `任务「${profile.label}」的必要角色`; });
  optional.forEach((r) => { if (!reasons[r]) reasons[r] = `本任务可选，视冲突/证据再召回`; });

  return { required, optional, inactive, roleWeights, reasons };
}

export function toRoleActivations(res: ActivationResult): RoleActivation[] {
  const out: RoleActivation[] = [];
  const mark = new Set<Role>();
  for (const r of res.required) if (!mark.has(r)) { out.push({ role: r, state: "required", weight: res.roleWeights[r] ?? 0, reason: res.reasons[r] ?? "" }); mark.add(r); }
  for (const r of res.optional) if (!mark.has(r)) { out.push({ role: r, state: "optional", weight: res.roleWeights[r] ?? 0, reason: res.reasons[r] ?? "" }); mark.add(r); }
  for (const r of res.inactive) if (!mark.has(r)) { out.push({ role: r, state: "inactive", weight: 0, reason: res.reasons[r] ?? "" }); mark.add(r); }
  return out;
}

/** optional 角色是否被触发（按需召回，避免全员跑）。 */
function optionalTriggered(r: Role, facts: CreativeFactSheet, problem: string): boolean {
  const p = problem ?? "";
  switch (r) {
    case "OPERATOR":
      return /涨粉|转化|流量|带货|增长|卖/.test(facts.goal) || !!facts.platform || !!facts.content_type;
    case "PRODUCER":
      return /低|省|便宜|有限|少|控制|500|几百/.test(`${facts.budget} ${facts.time}`) ||
        /拍摄|镜头|预算|成本|设备|场景|演/.test(`${p} ${facts.materials} ${facts.goal}`);
    case "DIRECTOR":
      return !!facts.content_type || !!facts.goal;
    case "EDITOR":
      return !!facts.materials || /剪辑|剪|拍摄|镜头|后期|成片/.test(`${p} ${facts.goal}`);
    case "AUDIENCE":
      return !!facts.content_type || !!facts.audience;
    default:
      return false;
  }
}

/** 计算真正要召集的角色：required 必定到场；optional 按触发条件召回；其余全部缺席。 */
export function resolveActivatedRoles(
  activation: ActivationResult,
  facts: CreativeFactSheet,
  problem = ""
): { activated: Role[]; weights: Record<Role, number> } {
  const triggered: Role[] = [];
  for (const r of activation.optional) {
    if (optionalTriggered(r, facts, problem)) triggered.push(r);
  }
  const activated = [...activation.required, ...triggered];
  const weights = { ...activation.roleWeights } as Record<Role, number>;
  // 未召集的角色权重归零（缺席本身也是决策）
  (Object.keys(weights) as Role[]).forEach((r) => {
    if (!activated.includes(r)) weights[r] = 0;
  });
  return { activated, weights };
}
