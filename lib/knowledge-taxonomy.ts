// 知识分类 / 来源 / 可信度 / scope 体系（Phase 16.6）。
// 诚实原则：SYSTEM_DEFINED 只是基础原则，不是真实案例；LEVEL_0 不得伪装成验证过的经验。

import type { Knowledge } from "./knowledge";

export const KNOWLEDGE_TYPES = [
  "PRINCIPLE", "PATTERN", "TECHNIQUE", "CASE", "COUNTER_EXAMPLE", "FAILURE_MODE",
  "CONSTRAINT", "HEURISTIC", "TREND", "PLATFORM_RULE", "PRODUCTION_RULE", "AUDIENCE_SIGNAL",
] as const;

export const KNOWLEDGE_ORIGINS = [
  "SYSTEM_DEFINED", "LEARNED", "OBSERVED", "USER_PROVIDED", "EXTERNAL_SOURCE", "EXPERIMENTAL",
] as const;

export const EVIDENCE_LEVELS = ["LEVEL_0", "LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4", "LEVEL_5"] as const;

/** 可信度标签（0-100 数值 → 标签）。 */
export function confidenceLabel(c: number): "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" {
  if (c < 30) return "LOW";
  if (c < 60) return "MEDIUM";
  if (c < 80) return "HIGH";
  return "VERY_HIGH";
}

/**
 * 是否可作为「已验证知识」被角色判断采纳。
 * 仅当：不是系统定义、证据等级非 LEVEL_0、权重 >= 40、生命周期 ACTIVE/TESTING。
 * 否则只能作为降级参考，绝不能伪装成真实经验。
 */
export function isUsableAsValidated(k: Knowledge): boolean {
  return (
    k.knowledge_origin !== "SYSTEM_DEFINED" &&
    k.evidence_level !== "LEVEL_0" &&
    k.weight >= 40 &&
    (k.lifecycle === "ACTIVE" || k.lifecycle === "TESTING")
  );
}

/* ───────────── 少量 SYSTEM_DEFINED 基础原则（证据等级 LEVEL_0，可信度 LOW）─────────────
 * 这些是「知识骨架 / 基础原则」，不是从市场学到的经验。
 */
export interface FoundationalPrinciple {
  role: "DIRECTOR" | "PRODUCER" | "OPERATOR" | "EDITOR" | "AUDIENCE" | "COMMON";
  pattern: string;
  description: string;
  why: string;
  action: string;
  applies_when: string;
  not_applies_when: string;
  failure_mode: string;
}

export const SYSTEM_DEFINED_PRINCIPLES: FoundationalPrinciple[] = [
  { role: "COMMON", pattern: "内容目标与平台环境必须共同决定创作方案", description: "基础原则", why: "目标与平台共同约束，缺一不可", action: "先明确目标与平台，再决定表达", applies_when: "所有内容", not_applies_when: "无", failure_mode: "只看目标或只看平台，方案失衡" },
  { role: "DIRECTOR", pattern: "信息未建立前不要用留白", description: "叙事原则", why: "留白需要上下文支撑", action: "先给信息/主题承诺，再用情绪留白", applies_when: "信息已建立、观众理解上下文", not_applies_when: "信息尚未建立、需立即理解重点", failure_mode: "为『高级感』人为停顿，信息断裂" },
  { role: "DIRECTOR", pattern: "短视频叙事规律不等于电影理论", description: "边界原则", why: "平台节奏与电影节奏不同", action: "短平快平台优先钩子前置与信息递进", applies_when: "抖音/小红书等短内容", not_applies_when: "长内容/影视向", failure_mode: "用电影化理论套短视频，留存崩" },
  { role: "PRODUCER", pattern: "成本与收益共同决定是否值得做", description: "价值判断", why: "低成本≠差内容，高预算≠好内容", action: "用 Creative Value / Execution Cost / Risk / Return 四维判断", applies_when: "所有方案", not_applies_when: "无", failure_mode: "只看成本省钱，或只看创意烧钱" },
  { role: "PRODUCER", pattern: "先评估可执行性，再谈艺术性", description: "优先级", why: "无法执行的创意没有价值", action: "产出可行性否决/替代方案", applies_when: "有预算/时间/设备约束", not_applies_when: "无约束的创意探索", failure_mode: "方案不可执行仍推进" },
  { role: "OPERATOR", pattern: "热点 ≠ 长期规律", description: "趋势甄别", why: "热点生命周期短", action: "判断生命周期与内容/用户相关性，再决定是否追", applies_when: "热点/趋势评估", not_applies_when: "已确认的长期规律", failure_mode: "把短期热点当长期创作原则" },
  { role: "OPERATOR", pattern: "平台规则与用户目标冲突时，用户目标优先", description: "优先级", why: "用户目标是第一约束", action: "平台适配服从用户目标", applies_when: "平台与目标冲突", not_applies_when: "无冲突", failure_mode: "为适配平台牺牲用户目标" },
  { role: "EDITOR", pattern: "快剪不是万能答案", description: "边界原则", why: "节奏由信息密度/情绪/受众/平台共同决定", action: "按内容类型与叙事阶段定节奏", applies_when: "信息型、快节奏内容", not_applies_when: "情绪/剧情需要呼吸感", failure_mode: "一律快剪，损害情绪" },
  { role: "EDITOR", pattern: "实现不了先换机位/光线/B-roll，而不是否定创意", description: "替代实现", why: "技术问题可用替代方案解", action: "提出低成本替代实现", applies_when: "技术受限", not_applies_when: "方案本身方向错误", failure_mode: "因实现困难就否定创意本身" },
  { role: "AUDIENCE", pattern: "无受众数据不得假装知道用户行为", description: "诚实原则", why: "用户行为不能凭空猜测", action: "缺数据时 evidence_source = NO_DATA", applies_when: "受众/内容类型未知", not_applies_when: "已有明确受众与内容", failure_mode: "无数据仍给出确定『用户喜欢』结论" },
  { role: "AUDIENCE", pattern: "信息未建立时用户理解优先于艺术表达", description: "体验原则", why: "先懂后爱", action: "前3秒给信息承诺，再谈表达", applies_when: "信息未建立", not_applies_when: "信息已明确", failure_mode: "为表达牺牲理解，用户划走" },
  { role: "COMMON", pattern: "角色缺席（inactive）不得参与判断或进入最终方案", description: "协作原则", why: "没被召集的角色不应影响结果", action: "Coordinator 只汇总已激活角色", applies_when: "所有任务", not_applies_when: "无", failure_mode: "未激活角色注入建议/冲突" },
];

import { hasDatabase, q } from "./db";
import { createKnowledge, findKnowledgeByPattern } from "./knowledge";

/** 幂等初始化：写入 SYSTEM_DEFINED 基础原则（LEVEL_0 / LOW / lifecycle NEW，不作为已验证知识召回）。 */
export async function initFoundationalKnowledge(): Promise<{ added: number; skipped: number }> {
  if (!hasDatabase()) return { added: 0, skipped: 0 };
  let added = 0, skipped = 0;
  for (const p of SYSTEM_DEFINED_PRINCIPLES) {
    const existing = await findKnowledgeByPattern(p.role, p.pattern);
    if (existing) { skipped++; continue; }
    await createKnowledge({
      role: p.role,
      pattern: p.pattern,
      description: p.description,
      why: p.why,
      action: p.action,
      source: "system-defined",
      source_status: "OK",
      knowledge_type: "PRINCIPLE",
      knowledge_origin: "SYSTEM_DEFINED",
      evidence_level: "LEVEL_0",
      scope: { origin: "system", level: 0 },
      applies_when: p.applies_when,
      not_applies_when: p.not_applies_when,
      failure_mode: p.failure_mode,
      confidence: 15,
      weight: 20,
      lifecycle: "NEW",
      notes: "SYSTEM_DEFINED 基础原则（非真实案例，LEVEL_0）",
    });
    added++;
  }
  return { added, skipped };
}
