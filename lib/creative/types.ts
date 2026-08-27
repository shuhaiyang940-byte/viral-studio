// Phase 16 类型：五人创作团队。
// 角色 ID 与 Phase 15-B 的 knowledge.role 保持一致（大写）。

import type { Role } from "@/lib/knowledge-logic";

export type TaskType =
  | "VIDEO_ANALYSIS"
  | "VIRAL_ANALYSIS"
  | "SCRIPT_CREATION"
  | "SCRIPT_REWRITE"
  | "STORYBOARD"
  | "SHOOTING_PLAN"
  | "EDITING_PLAN"
  | "CONTENT_STRATEGY"
  | "ACCOUNT_STRATEGY"
  | "PRODUCT_MARKETING"
  | "BRAND_VIDEO"
  | "COMMERCIAL_VIDEO"
  | "TREND_DECISION";

export interface TaskProfile {
  id: TaskType;
  label: string;
  required: Role[];
  optional: Role[];
  /** 明确禁用（不激活）的角色 */
  inactive: Role[];
  weights: Record<Role, number>;
  /** 是否允许角色间二次质询 */
  allowChallenge: boolean;
  /** 哪些角色有否决权 */
  veto: Role[];
}

export type ActivationState = "required" | "optional" | "inactive";

export interface RoleActivation {
  role: Role;
  state: ActivationState;
  weight: number;
  reason: string;
}

export interface ActivationResult {
  required: Role[];
  optional: Role[];
  inactive: Role[];
  roleWeights: Record<Role, number>;
  reasons: Record<Role, string>;
}

/** 五个角色共享的单一事实层（防止各自脑补事实）。 */
export interface CreativeFactSheet {
  taskType: TaskType;
  goal: string;
  platform: string;
  content_type: string;
  audience: string;
  budget: string;
  time: string;
  materials: string;
  hookType?: string;
  title?: string;
  analysis: {
    overall?: number;
    hook?: number;
    storyboardCount?: number;
    title?: string;
    hookType?: string;
    duration?: string;
    whyHot?: string[];
  };
  constraints: string[];
  questions: string[];
}

export interface RoleJudgment {
  role: Role;
  conclusion: string;
  confidence: number; // 0-1
  evidence: string[];
  recommendations: string[];
  risks: string[];
  objections: string[];
  must_have: string[];
  should_have: string[];
  avoid: string[];
  questions: string[];
  /** 依赖的知识条目 id（无则空） */
  knowledgeIds: string[];
  /** fact=事实推导 / knowledge=知识支撑 / no_data=缺数据 */
  evidenceSource: "fact" | "knowledge" | "no_data";
}

export interface CreativeConflict {
  conflictType: string;
  roles: Role[];
  evidence: string[];
  severity: number; // 0-1
  resolution: string;
  winner: Role | null;
  reason: string;
  unresolved: boolean;
}

export interface CreativeIntent {
  goal: string;
  platform: string;
  audience: string;
  content_type: string;
  core_message: string;
  narrative_intent: string;
  market_intent: string;
  execution_intent: string;
  editing_intent: string;
  audience_intent: string;
  priority_rules: string[];
  hard_constraints: string[];
  soft_constraints: string[];
  risks: string[];
  unresolved_questions: string[];
  activated_roles: Role[];
  role_weights: Record<Role, number>;
  evidence_summary: string;
}

export interface CreativeDecision {
  final_decision: string;
  confidence: number;
  activated_roles: Role[];
  role_weights: Record<Role, number>;
  conflicts: CreativeConflict[];
  knowledge_used: string[];
  creative_intent: CreativeIntent;
  reason: string;
}
