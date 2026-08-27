// 五角色独立判断层。每个角色只基于：
//   1) Creative Fact Sheet（共享事实层）
//   2) 自身角色知识（来自 knowledge 表，ACTIVE/TESTING、未 DEPRECATED）
// 产出结构化 RoleJudgment；缺数据时明确 INSUFFICIENT_EVIDENCE / NO_DATA。

import { recallKnowledge, type Knowledge } from "@/lib/knowledge";
import { isUsableAsValidated } from "@/lib/knowledge-taxonomy";
import type { CreativeFactSheet, RoleJudgment } from "./types";
import type { Role } from "@/lib/knowledge-logic";

function base(role: Role): RoleJudgment {
  return {
    role,
    conclusion: "",
    confidence: 0,
    evidence: [],
    recommendations: [],
    risks: [],
    objections: [],
    must_have: [],
    should_have: [],
    avoid: [],
    questions: [],
    knowledgeIds: [],
    evidenceSource: "fact",
  };
}

const isShortForm = (f: CreativeFactSheet) => /抖音|快手|视频号|短视频|TikTok/i.test(f.platform) || /口播|vlog/.test(f.content_type);

export async function judgeRole(role: Role, facts: CreativeFactSheet): Promise<RoleJudgment> {
  const k = base(role);
  // 只取本角色知识（ACTIVE/TESTING、未 DEPRECATED），有则作为知识支撑。
  const pool: Knowledge[] = role === "COMMON" ? [] : await recallKnowledge(role, { limit: 6, platform: facts.platform });
  // 只有「已验证知识」（非 SYSTEM_DEFINED、非 LEVEL_0、weight≥40、ACTIVE/TESTING）才可作为知识支撑
  const validated = pool.filter(isUsableAsValidated);
  k.knowledgeIds = validated.map((x) => x.id);
  const useK = validated.length > 0;

  switch (role) {
    case "DIRECTOR": {
      k.conclusion = contentDirection(facts);
      k.confidence = facts.audience ? 0.7 : 0.5;
      k.evidence.push(`事实层：内容类型=${facts.content_type || "未知"}，平台=${facts.platform || "未知"}，目标=${facts.goal || "未指定"}`);
      const emotive = /情感|剧情|治愈|故事|品牌/.test(facts.content_type);
      const userSlow = /留白|慢节奏|慢|文艺|情绪/.test(facts.goal || "");
      const slowOk = emotive || userSlow;
      k.recommendations.push(
        isShortForm(facts)
          ? "前2~3秒建立信息钩子，再展开叙事"
          : slowOk
            ? "可用留白/氛围铺垫，前5秒给主题承诺"
            : "前5秒给出主题与信息承诺，再展开"
      );
      // 用户目标优先级：用户明确想要留白/慢节奏时，导演应尊重，而不是被平台节奏反噬。
      if (userSlow) {
        k.recommendations.unshift("尊重用户想要留白/慢节奏的创作意图");
        k.risks.push("慢节奏/留白在短平快平台会掉留存（与运营/剪辑目标冲突）");
      }
      if (/情感|剧情|品牌/.test(facts.content_type)) k.must_have.push("情绪落点");
      if (!front3s(facts)) k.should_have.push("补一个反常识 / 身份共鸣钩子");
      k.risks.push(isShortForm(facts) ? "留白或铺垫过长会掉留存" : "主题推进过慢");
      k.avoid.push("为大而全牺牲节奏");
      break;
    }
    case "EDITOR": {
      if (!facts.materials.trim()) {
        k.conclusion = "素材未明确，无法给出可落地的镜头实现";
        k.confidence = 0.3;
        k.evidenceSource = "no_data";
        k.evidence.push("事实层：materials 为空 → NO_DATA");
        k.questions.push("请补充已有素材类型（口播/产品/空镜/人物）");
        k.risks.push("素材/设备无法支撑方案");
      } else {
        k.conclusion = isShortForm(facts) ? "尽量紧凑，逐镜头降低时长" : "保留呼吸感，节奏随情绪起伏";
        k.confidence = 0.82;
        k.recommendations.push(isShortForm(facts) ? "每镜头控制在 1~3 秒" : "关键观点处放慢 + 补 B-roll");
        k.recommendations.push("用转场/字幕/音效抬信息密度");
        if (/产品|口播/.test(facts.materials)) k.should_have.push("产品/口播近景");
        k.risks.push("若全套复杂运镜/灯光，素材条件不足");
        k.avoid.push("为『快剪』而快剪");
      }
      break;
    }
    case "OPERATOR": {
      k.conclusion = `${facts.platform || "平台"} 场景下，更看重${isShortForm(facts) ? "前3秒钩子 + 结尾CTA" : "选题门槛 + 完播结构"}`;
      k.confidence = facts.goal ? 0.8 : 0.6;
      k.evidence.push(`事实层：平台=${facts.platform || "未知"}，目标=${facts.goal || "未指定"}`);
      k.recommendations.push(isShortForm(facts) ? "标题+封面承诺，前3秒兑现" : "埋一个可讨论的话题");
      k.should_have.push("结尾给互动 hook");
      k.risks.push("若强行追一次性梗 / 广告味过重 → 损害长期");
      k.avoid.push("为转化强行扭曲内容本体");
      // 甄别趋势类型：只有知识库给出 LONG_TERM 才可当长期规律
      const longTerm = validated.some((x) => x.trend_type === "LONG_TERM");
      if (!longTerm) k.evidence.push("注意：当前无 LONG_TERM 知识支撑，不应把短期热点当长期规律");
      break;
    }
    case "PRODUCER": {
      const ambitious = /电影|大片|3分钟|剧情|实景|多机位|复杂/.test(`${facts.goal} ${facts.materials}`);
      const lowBudget = /低|省|便宜|有限|少|控制|500|几百/i.test(`${facts.budget} ${facts.time}`);
      const premium = /品牌|质感|大片|宣传|高端|形象/.test(`${facts.goal} ${facts.content_type} ${facts.materials}`);
      if (ambitious && lowBudget) {
        k.conclusion = "方案不可执行：制作成本/时间超出用户约束";
        k.confidence = 0.9;
        k.evidenceSource = "fact";
        k.evidence.push(`事实层：预算=${facts.budget || "未知"}，时间=${facts.time || "未知"}，内容=${facts.goal || "未知"}`);
        k.objections.push("投入产出比过低，应降级为单人/单场景/手机可执行方案");
      } else if (premium && !lowBudget) {
        k.conclusion = "值得投入，但需把预算集中在关键表现点并兼顾可规模化";
        k.confidence = 0.8;
        k.recommendations.push("把预算投入到记忆点镜头/视觉辨识度，而非平均铺满");
        k.recommendations.push("评估可持续复用的置景/方案，避免一次性高成本");
        k.risks.push("若追求廉价感会压垮品牌信任");
        k.avoid.push("为省钱削弱核心表达");
      } else {
        k.conclusion = "在当前约束下可执行，建议做低成本、可复用、可量产化";
        k.confidence = 0.75;
        k.recommendations.push("优先复用现有素材，控制拍摄镜头数");
        k.recommendations.push("尽量单人 + 手机 + 自然光可完成");
        k.risks.push("制片过度保守会压制创意");
        k.avoid.push("为省钱把方案做死");
      }
      break;
    }
    case "AUDIENCE": {
      if (!facts.audience && !facts.content_type) {
        k.conclusion = "受众未指定，无法判断理解度/留白风险";
        k.confidence = 0.3;
        k.evidenceSource = "no_data";
        k.evidence.push("事实层：audience/content_type 为空 → INSUFFICIENT_EVIDENCE");
        k.questions.push("请指定目标受众，或补充内容类型");
      } else {
        const emotive = /情感|剧情|品牌|治愈|故事/.test(facts.content_type);
        k.conclusion = `目标受众${facts.audience || "泛用户"}，需在${isShortForm(facts) ? "前2秒" : "前5秒"}让对方理解主题并产生继续看理由`;
        k.confidence = 0.75;
        k.recommendations.push("前3秒给出信息/承诺，避免空留白");
        k.recommendations.push("用他人能感知的细节证明价值，避免『创作者自嗨』");
        if (emotive) {
          k.risks.push("若留白无上下文，观众会判定拖沓而划走");
          k.objections.push("用户可能不理解导演的『情绪留白』");
        } else {
          k.risks.push("若前3秒无信息承诺，用户会划走");
        }
        k.avoid.push("广告味过重");
      }
      break;
    }
    default:
      k.conclusion = "事实不足，暂不判断";
      k.evidenceSource = "no_data";
  }

  // 知识可叠加为证据/建议（但绝不直接覆盖事实判断）
  if (useK) {
    k.evidenceSource = "knowledge";
    for (const x of validated.slice(0, 2)) {
      k.recommendations.push(`[知识·${x.lifecycle}] ${x.action || x.pattern}`);
      k.evidence.push(`知识#${x.id} weight=${x.weight}`);
    }
  }
  return k;
}

function contentDirection(f: CreativeFactSheet): string {
  if (/知识|干货|科普|教程/.test(f.content_type)) return "先抛结论，再给可操作步骤，信息递进";
  if (/情感|治愈|故事|剧情/.test(f.content_type)) return "情绪铺陈 → 共鸣 → 落点，允许留白";
  if (/品牌|宣传/.test(f.content_type)) return "价值观 + 仪式感 + 品牌记忆点";
  if (/种草|好物|带货|产品/.test(f.content_type)) return "痛点 → 卖点 → 试用证据 → 转化";
  return isShortForm(f) ? "钩子前置 + 紧凑叙事" : "节奏与情绪并重";
}

function front3s(f: CreativeFactSheet): boolean {
  return (f.analysis.hookType && f.analysis.hookType.length > 0) || /口播|知识/.test(f.content_type);
}

/** 各角色专业边界（Phase 16.5 审计用）：判断不能越出 PRIMARY / VETO 越权必须带证据。 */
export const ROLE_BOUNDARIES: Record<
  Role,
  {
    primary: string;
    secondary: string;
    veto: string;
    outOfScope: string[];
    biasToAvoid: string;
    evidenceRequired: string;
  }
> = {
  DIRECTOR: { primary: "叙事/情绪/视觉表达", secondary: "主题、立意、信息递进", veto: "内容表达逻辑无法成立", outOfScope: ["预算", "平台流量预测", "设备成本"], biasToAvoid: "电影化过度", evidenceRequired: "叙事/情绪相关证据或事实层" },
  PRODUCER: { primary: "可行性/成本/ROI", secondary: "创意价值、执行成本、风险、预期收益", veto: "明显不可执行", outOfScope: ["决定内容审美"], biasToAvoid: "过度保守", evidenceRequired: "预算/时间/设备等约束" },
  OPERATOR: { primary: "市场/平台/用户获取/转化", secondary: "趋势甄别、平台适配、内容定位", veto: "严重平台或商业风险", outOfScope: ["决定镜头语言"], biasToAvoid: "追热点成瘾", evidenceRequired: "平台/竞争/趋势信号" },
  EDITOR: { primary: "技术实现/拍摄/剪辑", secondary: "前期拍摄、后期节奏、信息密度", veto: "技术上无法实现", outOfScope: ["决定商业价值"], biasToAvoid: "万能快剪", evidenceRequired: "素材/设备/时间条件" },
  AUDIENCE: { primary: "理解/注意力/信任/情绪反应", secondary: "信息负荷、退出风险、动机", veto: "明显无法理解或体验风险过高", outOfScope: ["决定预算/市场战略"], biasToAvoid: "迎合所有用户", evidenceRequired: "目标受众/内容类型（缺则 NO_DATA）" },
  COMMON: { primary: "跨角色中立", secondary: "协作纪律", veto: "无", outOfScope: ["专业判断"], biasToAvoid: "越权代理", evidenceRequired: "无" },
};
