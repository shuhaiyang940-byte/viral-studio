// PHASE1 诊断引擎：把"证据 + 指标"变成"针对性诊断 + 可执行改进"。
// 核心：AI 只负责把证据讲成诊断，不负责制造事实（事实来自 evidence 与用户提供的指标）。
// 不依赖外部数据源：指标来自用户上传截图/手填，内容证据来自真实看过/上传的视频分析。

import type { ContentEvidence } from "./evidence";
import { aggregateEvidence } from "./evidence";

export interface DiagnosisMetric {
  key: string;
  label: string;
  value: number | null;        // 归一化 0-100
  benchmark?: number | null;   // 同行基准（有则对比，无则标注"待对标"）
  status: "good" | "warn" | "gap" | "unknown";
  note: string;
}

export interface DiagnosisItem {
  id: string;
  title: string;               // 一句话诊断（针对性）
  severity: "high" | "medium" | "low";
  metricKey: string;
  detail: string;              // 为什么
  howToImprove: string[];      // 怎么增强/怎么加钩子（可执行）
  evidence: {
    type: string;
    detail: string;
    videoId?: string;
    count?: number;
  }[];
  confidence: number;
}

export interface DiagnosisEngineInput {
  evidences: ContentEvidence[];
  manual: {
    followers?: number;
    engagementRate?: number;
    avgPlays?: number;
    avgLikes?: number;
    avgComments?: number;
    avgShares?: number;
  };
}

export interface DiagnosisResult {
  overallScore: number;
  metrics: DiagnosisMetric[];
  diagnoses: DiagnosisItem[];
  summary: string;
  /** 诊断依据是否充分（若证据不足，诚实标注） */
  evidenceSufficient: boolean;
  availableCount: number;
  totalVideos: number;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function computeOverall(metrics: DiagnosisMetric[], diagnoses: DiagnosisItem[]): number {
  // 以内容质量维度为主，减扣严重问题
  let score = 60;
  const quality = metrics.find((m) => m.key === "content_quality")?.value;
  const hook = metrics.find((m) => m.key === "hook")?.value;
  const interaction = metrics.find((m) => m.key === "interaction")?.value;
  if (quality != null) score = quality * 0.4 + 60 * 0.6;
  if (hook != null) score += (hook - 60) * 0.15;
  if (interaction != null) score += (interaction - 60) * 0.15;
  const highPenalty = diagnoses.filter((d) => d.severity === "high").length * 6;
  const mediumPenalty = diagnoses.filter((d) => d.severity === "medium").length * 3;
  return Math.round(clamp(score - highPenalty - mediumPenalty));
}

export function runDiagnosis(input: DiagnosisEngineInput): DiagnosisResult {
  const agg = aggregateEvidence(input.evidences);
  const { manual } = input;

  // 互动率：用户截图/手填优先；否则用聚合证据里的互动评分估算
  const engagementRate = manual.engagementRate ?? null;
  const avgCommentRate = manual.avgComments && manual.avgPlays ? (manual.avgComments / manual.avgPlays) * 100 : null;

  const metrics: DiagnosisMetric[] = [
    {
      key: "content_quality",
      label: "内容质量",
      value: agg.avgOverall ?? null,
      benchmark: null,
      status: agg.avgOverall == null ? "unknown" : agg.avgOverall >= 70 ? "good" : agg.avgOverall >= 55 ? "warn" : "gap",
      note: "基于你上传视频的综合评分（有真实看过的视频才计算）",
    },
    {
      key: "hook",
      label: "开头钩子",
      value: agg.avgHook ?? null,
      benchmark: null,
      status: agg.avgHook == null ? "unknown" : agg.avgHook >= 70 ? "good" : agg.avgHook >= 55 ? "warn" : "gap",
      note: "前 3 秒留人能力（golden3s.hookType）",
    },
    {
      key: "interaction",
      label: "用户互动",
      value: engagementRate != null ? clamp(engagementRate * 18) : (agg.avgInteraction ?? null),
      benchmark: null,
      status: engagementRate != null ? (engagementRate >= 3 ? "good" : engagementRate >= 1 ? "warn" : "gap") : "unknown",
      note: engagementRate != null ? `你填的互动率 ${engagementRate}%` : "基于上传视频的互动评分",
    },
    {
      key: "cta",
      label: "互动引导(CTA)",
      value: agg.total ? clamp(agg.ctaHitRate * 100) : null,
      benchmark: null,
      status: agg.total ? (agg.ctaHitRate >= 0.6 ? "good" : agg.ctaHitRate >= 0.3 ? "warn" : "gap") : "unknown",
      note: `有明确CTA的视频占比 ${agg.total ? Math.round(agg.ctaHitRate * 100) : 0}%`,
    },
    {
      key: "updated",
      label: "内容稳定性",
      value: null,
      benchmark: null,
      status: "unknown",
      note: "需多次诊断（历史快照）才能评估，本次暂不计入",
    },
  ];

  const diagnoses: DiagnosisItem[] = [];

  // 针对性诊断：基于证据命中率生成，每条都带如何增强/加钩子
  if (agg.total > 0 && agg.ctaHitRate < 0.5) {
    diagnoses.push({
      id: "cta_low",
      title: `互动引导不足：${agg.total} 条里只有 ${agg.withCta} 条有明确 CTA`,
      severity: agg.ctaHitRate < 0.3 ? "high" : "medium",
      metricKey: "cta",
      detail: "视频结尾缺少「关注/点赞/评论/收藏」的明确指令，用户看完就走，没有行动触发，互动率自然低。",
      howToImprove: [
        "结尾加一句明确指令：如「这招你学会了吗？评论区告诉我」",
        "争议/选择题触发：如「如果是你，你会选 A 还是 B？」",
        "前 3 条视频里至少 2 条带互动提问，拉高评论率",
      ],
      evidence: [
        { type: "统计", detail: `无 CTA 视频 ${agg.total - agg.withCta}/${agg.total} 条`, count: agg.total - agg.withCta },
      ],
      confidence: 0.85,
    });
  }

  if (agg.total > 0 && agg.interactionHitRate < 0.4) {
    diagnoses.push({
      id: "interaction_trigger_low",
      title: "内容缺「评论触发机制」：多为单向输出",
      severity: agg.interactionHitRate < 0.2 ? "high" : "medium",
      metricKey: "interaction",
      detail: "视频以单向观点输出为主，少有提问、争议点或「让观众代入」的设计，观众懒得评论。",
      howToImprove: [
        "开场抛争议/反常识：如「90% 的人第一步就错了」",
        "中间设「身份认同」钩子：如「做餐饮的都懂，这有多难」",
        "结尾抛开放式问题，把评论变成内容的一部分",
      ],
      evidence: [
        { type: "统计", detail: `有互动触发视频 ${agg.withInteractionTrigger}/${agg.total} 条`, count: agg.withInteractionTrigger },
      ],
      confidence: 0.8,
    });
  }

  if (agg.avgHook != null && agg.avgHook < 60) {
    diagnoses.push({
      id: "hook_weak",
      title: "开头钩子偏弱，前 3 秒留人不足",
      severity: agg.avgHook < 50 ? "high" : "medium",
      metricKey: "hook",
      detail: "视频开头多为铺垫或自我介绍，错过黄金前 3 秒，观众划走率高。",
      howToImprove: [
        "结果前置：第 1 秒直接给结果/成果，再倒叙展开",
        "冲突/反常识开头：「你用错了 3 年，现在才知道」",
        "钩子类型参考：悬念、身份共鸣、利益承诺，挑一个强化",
      ],
      evidence: [
        { type: "指标", detail: `平均钩子分 ${agg.avgHook}/100` },
      ],
      confidence: 0.82,
    });
  }

  if (agg.avgOverall != null && agg.avgOverall < 60) {
    diagnoses.push({
      id: "quality_low",
      title: "视频整体质量偏弱",
      severity: agg.avgOverall < 50 ? "high" : "medium",
      metricKey: "content_quality",
      detail: "你上传的视频综合评分不高，内容价值/情绪感染力/结构完整度有可提升空间。",
      howToImprove: [
        "结构补全：钩子→痛点→论证→高潮→CTA 五段式",
        "增加画面信息密度，避免长时间静态镜头",
        "参考同赛道黑马对标的结构骨架，套自身素材",
      ],
      evidence: [{ type: "指标", detail: `平均综合分 ${agg.avgOverall}/100` }],
      confidence: 0.78,
    });
  }

  // 证据不足时明确告知，不编诊断
  const evidenceSufficient = agg.availableCount >= 1;
  if (!evidenceSufficient && agg.total > 0) {
    diagnoses.push({
      id: "no_real_video",
      title: "本次为演示/未真实看视频，结论仅供参考",
      severity: "low",
      metricKey: "content_quality",
      detail: "你上传的视频尚未被视觉模型真实分析（当前为演示模式或未配 QWEN_VL），所以内容类诊断是估算，不是证据。",
      howToImprove: ["在生产环境配置 QWEN_API_KEY 且关闭 AI_VISION_MOCK 后，重新上传视频即可得到真实内容诊断。"],
      evidence: [{ type: "诚实标注", detail: "available=false" }],
      confidence: 0.5,
    });
  }
  if (agg.total === 0) {
    diagnoses.push({
      id: "no_video",
      title: "还没有上传视频，无法做内容诊断",
      severity: "high",
      metricKey: "content_quality",
      detail: "请先上传至少 1 个视频，系统才能真实分析你的内容质量、钩子与结构。",
      howToImprove: ["点击上传视频（建议上传 3-10 个清有效果的视频）", "或补充后台数据截图/手填粉丝量、互动率、平均播放等"],
      evidence: [],
      confidence: 1,
    });
  }

  const overallScore = computeOverall(metrics, diagnoses);
  const summary = evidenceSufficient
    ? `基于你上传的 ${agg.availableCount} 个视频 + 数据信息，你的内容${diagnoses.length ? "有" + diagnoses.length + "个可改进点" : "整体不错"}。`
    : "当前证据不足（未真实看视频），先按下方引导补充视频/数据，再得到针对性诊断。";

  return {
    overallScore,
    metrics,
    diagnoses,
    summary,
    evidenceSufficient,
    availableCount: agg.availableCount,
    totalVideos: agg.total,
  };
}
