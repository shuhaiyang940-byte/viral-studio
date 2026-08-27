// 任务画像（Task Profile）与任务识别。
// 关键：不同任务用不同团队；绝不固定五角色、绝不五等分权重。

import type { TaskProfile, TaskType } from "./types";
import type { Role } from "@/lib/knowledge-logic";

const R = (n: number) => ({ DIRECTOR: 0, PRODUCER: 0, OPERATOR: 0, EDITOR: 0, AUDIENCE: 0, COMMON: 0 } as Record<Role, number>);

function profile(
  id: TaskType,
  label: string,
  required: Role[],
  optional: Role[],
  inactive: Role[],
  weights: Record<Role, number>,
  allowChallenge: boolean,
  veto: Role[]
): TaskProfile {
  return { id, label, required, optional, inactive, weights, allowChallenge, veto };
}

export const TASK_PROFILES: Record<TaskType, TaskProfile> = {
  VIDEO_ANALYSIS: profile("VIDEO_ANALYSIS", "爆款分析（为什么火）",
    ["OPERATOR", "AUDIENCE", "DIRECTOR", "EDITOR"], [], ["PRODUCER"],
    { ...R(0), OPERATOR: 0.28, AUDIENCE: 0.24, DIRECTOR: 0.26, EDITOR: 0.22 }, true, ["AUDIENCE", "OPERATOR"]),
  VIRAL_ANALYSIS: profile("VIRAL_ANALYSIS", "爆款复刻/拆解",
    ["DIRECTOR", "OPERATOR", "EDITOR"], ["AUDIENCE"], ["PRODUCER"],
    { ...R(0), DIRECTOR: 0.34, OPERATOR: 0.3, EDITOR: 0.24, AUDIENCE: 0.12 }, true, ["OPERATOR"]),
  SCRIPT_CREATION: profile("SCRIPT_CREATION", "文案→可拍摄方案",
    ["DIRECTOR", "EDITOR", "AUDIENCE"], ["PRODUCER", "OPERATOR"], [],
    { ...R(0), DIRECTOR: 0.34, EDITOR: 0.3, AUDIENCE: 0.24, PRODUCER: 0.06, OPERATOR: 0.06 }, true, ["AUDIENCE", "EDITOR"]),
  SCRIPT_REWRITE: profile("SCRIPT_REWRITE", "脚本改写",
    ["DIRECTOR", "EDITOR", "AUDIENCE"], ["OPERATOR"], ["PRODUCER"],
    { ...R(0), DIRECTOR: 0.36, EDITOR: 0.32, AUDIENCE: 0.2, OPERATOR: 0.12 }, true, ["AUDIENCE"]),
  STORYBOARD: profile("STORYBOARD", "分镜表",
    ["DIRECTOR", "EDITOR", "AUDIENCE"], ["OPERATOR"], ["PRODUCER"],
    { ...R(0), DIRECTOR: 0.36, EDITOR: 0.36, AUDIENCE: 0.16, OPERATOR: 0.12 }, true, ["EDITOR"]),
  SHOOTING_PLAN: profile("SHOOTING_PLAN", "拍摄计划（低成本）",
    ["PRODUCER", "EDITOR", "DIRECTOR"], ["AUDIENCE"], ["OPERATOR"],
    { ...R(0), PRODUCER: 0.4, EDITOR: 0.3, DIRECTOR: 0.2, AUDIENCE: 0.1 }, true, ["PRODUCER", "EDITOR"]),
  EDITING_PLAN: profile("EDITING_PLAN", "剪辑（已有素材）",
    ["EDITOR", "AUDIENCE"], ["DIRECTOR", "OPERATOR"], ["PRODUCER"],
    { ...R(0), EDITOR: 0.5, AUDIENCE: 0.3, DIRECTOR: 0.12, OPERATOR: 0.08 }, true, ["EDITOR", "AUDIENCE"]),
  CONTENT_STRATEGY: profile("CONTENT_STRATEGY", "内容策略",
    ["OPERATOR", "AUDIENCE"], ["DIRECTOR"], ["PRODUCER", "EDITOR"],
    { ...R(0), OPERATOR: 0.45, AUDIENCE: 0.35, DIRECTOR: 0.2 }, true, ["OPERATOR"]),
  ACCOUNT_STRATEGY: profile("ACCOUNT_STRATEGY", "账号策略",
    ["OPERATOR", "AUDIENCE"], ["DIRECTOR"], ["PRODUCER", "EDITOR"],
    { ...R(0), OPERATOR: 0.45, AUDIENCE: 0.35, DIRECTOR: 0.2 }, true, ["OPERATOR"]),
  PRODUCT_MARKETING: profile("PRODUCT_MARKETING", "产品种草/带货",
    ["OPERATOR", "PRODUCER", "AUDIENCE"], ["DIRECTOR", "EDITOR"], [],
    { ...R(0), OPERATOR: 0.36, PRODUCER: 0.24, AUDIENCE: 0.24, DIRECTOR: 0.08, EDITOR: 0.08 }, true, ["AUDIENCE", "OPERATOR"]),
  BRAND_VIDEO: profile("BRAND_VIDEO", "品牌宣传片",
    ["DIRECTOR", "PRODUCER", "EDITOR", "AUDIENCE"], ["OPERATOR"], [],
    { ...R(0), DIRECTOR: 0.34, PRODUCER: 0.24, EDITOR: 0.22, AUDIENCE: 0.14, OPERATOR: 0.06 }, true, ["DIRECTOR", "AUDIENCE"]),
  COMMERCIAL_VIDEO: profile("COMMERCIAL_VIDEO", "商业视频",
    ["OPERATOR", "PRODUCER", "DIRECTOR", "EDITOR"], ["AUDIENCE"], [],
    { ...R(0), OPERATOR: 0.28, PRODUCER: 0.24, DIRECTOR: 0.22, EDITOR: 0.16, AUDIENCE: 0.1 }, true, ["PRODUCER", "OPERATOR"]),
  TREND_DECISION: profile("TREND_DECISION", "热点决策（要不要跟）",
    ["OPERATOR", "PRODUCER", "AUDIENCE"], ["DIRECTOR"], ["EDITOR"],
    { ...R(0), OPERATOR: 0.34, PRODUCER: 0.28, AUDIENCE: 0.26, DIRECTOR: 0.12 }, true, ["PRODUCER", "AUDIENCE"]),
};

export interface CreativeInput {
  problem?: string;
  goal?: string;
  platform?: string;
  content_type?: string;
  taskType?: string;
  budget?: string;
  time?: string;
  materials?: string;
  audience?: string;
}

/** 从输入推断任务类型（无显式 taskType 时用关键词）。 */
export function detectTaskType(input: CreativeInput): TaskType {
  const raw = input.taskType?.trim();
  if (raw && (raw in TASK_PROFILES)) return raw as TaskType;
  const p = [input.problem, input.goal, input.content_type].filter(Boolean).join(" ").toLowerCase();
  if (/品牌|宣传|形象/.test(p)) return "BRAND_VIDEO";
  if (/带货|种草|商品|好物|转化|卖/.test(p)) return /商业|广告/.test(p) ? "COMMERCIAL_VIDEO" : "PRODUCT_MARKETING";
  if (/要不要.{0,4}(追|跟)|值不值|该不该|追不追|跟不跟|值得做|做不做|值不值得/.test(p)) return "TREND_DECISION";
  if (/剪辑|剪|后期|成片|素材.*剪/.test(p)) return "EDITING_PLAN";
  if (/拍摄|机位|景别|补拍|怎么拍/.test(p)) return "SHOOTING_PLAN";
  if (/分镜|镜头表/.test(p)) return "STORYBOARD";
  if (/账号|人设|定位|选题|策略|涨粉/.test(p)) return "ACCOUNT_STRATEGY";
  if (/热点|借势|热度|蹭|话题|当下|流行/.test(p)) return "CONTENT_STRATEGY";
  if (/内容策略|内容规划|趋势/.test(p)) return "CONTENT_STRATEGY";
  if (/复刻|拆解|改编|改成我的/.test(p)) return "VIRAL_ANALYSIS";
  if (/为什么火|分析|爆款.*火|流量密码/.test(p)) return "VIDEO_ANALYSIS";
  if (/改写|重写|改文案/.test(p)) return "SCRIPT_REWRITE";
  if (/文案|口播|脚本/.test(p)) return "SCRIPT_CREATION";
  return "SCRIPT_CREATION";
}

/** 五角色能力矩阵：每个任务的权重 / 必选 / 可选 / 禁用 / 否决。 */
export function roleCapabilityMatrix() {
  return (Object.keys(TASK_PROFILES) as TaskType[]).map((id) => {
    const p = TASK_PROFILES[id];
    return {
      task: id,
      director_weight: p.weights.DIRECTOR,
      producer_weight: p.weights.PRODUCER,
      operator_weight: p.weights.OPERATOR,
      editor_weight: p.weights.EDITOR,
      audience_weight: p.weights.AUDIENCE,
      required_roles: p.required,
      optional_roles: p.optional,
      inactive_roles: p.inactive,
      veto_roles: p.veto,
    };
  });
}
