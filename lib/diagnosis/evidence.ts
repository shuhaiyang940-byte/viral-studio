// 内容证据提取（PHASE 1）：从单条视频的 AnalysisReport 中提取"可被诊断引用的结构化证据"。
// 设计原则：证据不是自然语言，而是可统计、可比对的离散信号（钩子类型/是否有CTA/结构是否完整等）。
// 真实视频（Qwen-VL 真正看过）与 mock 共用同一结构，mock 会有 available:false 并诚实标注。

import type { AnalysisReport } from "@/lib/types";

export interface ContentEvidence {
  videoId: string;
  title: string;
  /** 是否拿到真实内容分析（Qwen-VL 真正看过） */
  available: boolean;
  reason?: string;
  /** 视频画面描述（真实看过时，来自视觉模型对关键帧的分析） */
  visualSummary?: string;
  /** 语音转写（若有） */
  transcript?: string;
  /** 钩子类型（如 身份共鸣/反常识/悬念），来自 golden3s.hookType */
  hookType?: string;
  /** 前 3 秒是否能留人（score.hook 归一化） */
  hookScore: number | null;
  /** 开头吸引力 0-100 */
  hookRating: number | null;
  /** 互动能力 0-100 */
  interactionRating: number | null;
  /** 内容价值 0-100 */
  valueRating: number | null;
  /** 情绪感染力 0-100 */
  emotionRating: number | null;
  /** 综合评分 */
  overall: number | null;
  /** 结构是否完整（含钩子/铺垫/高潮/CTA） */
  structureComplete: boolean;
  /** 结尾是否有 CTA / 互动引导 */
  hasCta: boolean;
  /** 是否包含"提问/观点冲突"等互动触发 */
  hasInteractionTrigger: boolean;
  /** 结构片段数 */
  segmentCount: number;
}

const CTA_HINTS = ["关注", "点赞", "评论", "收藏", "转发", "想看", "评论区", "留言", "告诉我", "你怎么看", "选a", "选b", "选 a", "去主页", "进群"];
const INTERACTION_HINTS = ["你怎么看", "你会选", "如果是你", "评论区", "告诉我", "投票", "选a", "选b", "选 a", "你怎么选", "大家觉得"];

function containsAny(text: string, hints: string[]): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return hints.some((h) => t.includes(h.toLowerCase()));
}

/** 从 AnalysisReport 提取单条内容证据 */
export function extractContentEvidence(report: AnalysisReport): ContentEvidence {
  const golden3s = report.golden3s;
  const structure = report.section?.structure ?? [];
  const structureText = structure
    .map((s) => `${s.label} ${s.detail}`)
    .join(" ");
  const transcript = report.visual?.transcript || report.section?.structure?.map((s) => s.detail).join(" ") || "";
  const whyHot = report.section?.whyHot?.join(" ") || "";

  const available = report.visual?.mode === "real";
  const hookRating = typeof report.score?.hook === "number" ? report.score.hook : null;
  return {
    videoId: report.id,
    title: report.meta?.title || "",
    available,
    reason: available ? undefined : report.visual?.note || "演示/未真实分析",
    visualSummary: available ? (report.visual as any)?.summary || undefined : undefined,
    transcript: report.visual?.transcript || undefined,
    hookType: golden3s?.hookType,
    hookScore: hookRating != null ? hookRating / 100 : null,
    hookRating,
    interactionRating: typeof report.score?.interaction === "number" ? report.score.interaction : null,
    valueRating: typeof report.score?.value === "number" ? report.score.value : null,
    emotionRating: typeof report.score?.emotion === "number" ? report.score.emotion : null,
    overall: typeof report.score?.overall === "number" ? report.score.overall : null,
    structureComplete: structure.length >= 3,
    hasCta: containsAny(`${structureText} ${transcript} ${whyHot}`, CTA_HINTS),
    hasInteractionTrigger: containsAny(`${structureText} ${transcript} ${whyHot}`, INTERACTION_HINTS),
    segmentCount: structure.length,
  };
}

/** 聚合多条视频证据 → 便于诊断引擎统计命中率 */
export function aggregateEvidence(evidences: ContentEvidence[]): {
  total: number;
  availableCount: number;
  withCta: number;
  withInteractionTrigger: number;
  avgHook: number | null;
  avgInteraction: number | null;
  avgValue: number | null;
  avgEmotion: number | null;
  avgOverall: number | null;
  ctaHitRate: number;
  interactionHitRate: number;
} {
  const total = evidences.length;
  const available = evidences.filter((e) => e.available);
  const withCta = evidences.filter((e) => e.hasCta).length;
  const withInteractionTrigger = evidences.filter((e) => e.hasInteractionTrigger).length;
  const avgOf = (fn: (e: ContentEvidence) => number | null): number | null => {
    const vs = available.map(fn).filter((v): v is number => v != null);
    return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
  };
  return {
    total,
    availableCount: available.length,
    withCta,
    withInteractionTrigger,
    avgHook: avgOf((e) => e.hookRating),
    avgInteraction: avgOf((e) => e.interactionRating),
    avgValue: avgOf((e) => e.valueRating),
    avgEmotion: avgOf((e) => e.emotionRating),
    avgOverall: avgOf((e) => e.overall),
    ctaHitRate: total ? withCta / total : 0,
    interactionHitRate: total ? withInteractionTrigger / total : 0,
  };
}
