// 第 5 环《数据复盘飞轮》：拍照/发布后的作品数据回传 → AI 诊断 → 复盘结论写回人设档案，
// 让下次策略生成更懂"这个账号"。仅服务端引用。

import { chat, isConfigured } from "./llm";
import { aiFailure, AI_ANALYSIS_FAILED } from "./ai-fallback";
import type { PersonaCard } from "./persona";
import type { DataQuality, DataSourceId } from "@/lib/data-platform/types";
import { dataQualityLabel, dataQualityNote } from "@/lib/data-platform/types";

export interface ReviewMetrics {
  plays?: number;
  likes?: number;
  comments?: number;
  completionRate?: number;
  follows?: number;
  conversions?: number;
}

export interface ReviewResult {
  summary: string;
  diagnosis: string[];
  why: string;
  nextSteps: string[];
  learning: string;
  dataQuality: DataQuality;
  dataSource: DataSourceId;
  dataSourceLabel: string;
}

function s(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => s(x)).filter(Boolean) : [];
}

export async function runReview(input: {
  personaCard: PersonaCard | null;
  script?: { hook?: string; cta?: string; body?: string[]; title?: string } | null;
  metrics: ReviewMetrics;
  note?: string;
  platform?: string;
  dataSource?: DataSourceId;
}): Promise<ReviewResult> {
  if (!isConfigured("deepseek")) {
    throw aiFailure(AI_ANALYSIS_FAILED, "数据复盘需要 DeepSeek 配置");
  }

  const sys =
    "你是「爆款研究所」的资深数据复盘官。用户发布了一条作品，你拿到它的真实拍后数据，结合账号人设与原脚本，诊断" +
    "这条为什么爆/没爆，并给出下次改进。要求：判断要基于数据与账号的差异化优势，给具体可执行建议；" +
    "不套模板、不说空话；输出的 learning 要精炼成一句能写回人设档案的复盘结论。输出 JSON，字段：summary(一句话结论)、" +
    "diagnosis(string[]，数据解读，哪做对了/哪拉胯)、why(string，为什么爆或没爆)、nextSteps(string[]，下次具体怎么改，3-5条)、" +
    "learning(string，写回人设的一句话复盘结论)。";

  const p = input.personaCard;
  const personaTxt =
    p && p.personaTags.length
      ? `人设标签：${p.personaTags.join("、")}；现有资源：${(p.resources || []).join("、") || "未填"}；平台：${p.platform || "未填"}；目标人群：${p.audience || "未填"}；已有复盘：${(p.learnings || []).join("；") || "无"}`
      : "未建立账号定位档案（本次复盘仅供参考，建议先填账号定位更准）。";

  const sc = input.script;
  const scriptTxt = sc
    ? `标题：${sc.title || "未填"}；钩子：${sc.hook || "未填"}；CTA：${sc.cta || "未填"}；正文：${((sc.body || []).join(" / ") || "未填")}`
    : "无关联脚本（仅凭数据与账号诊断）。";

  const m = input.metrics;
  const hasMetrics =
    [m.plays, m.likes, m.comments, m.completionRate, m.follows, m.conversions]
      .some((v) => v !== undefined && v !== null && Number.isFinite(v));
  const dq: DataQuality = input.dataSource && input.dataSource !== "manual" ? "platform" : hasMetrics ? "estimated" : "none";
  const metricsTxt = [
    `播放${m.plays ?? "未填"}`,
    `点赞${m.likes ?? "未填"}`,
    `评论${m.comments ?? "未填"}`,
    `完播率${m.completionRate ?? "未填"}%`,
    `涨粉${m.follows ?? "未填"}`,
    `转化${m.conversions ?? "未填"}`,
  ].join("，");

  const user = `【账号人设】${personaTxt}\n【原脚本】${scriptTxt}\n【拍后数据】${metricsTxt}${input.note ? `\n【备注】${input.note}` : ""}`;

  let parsed: any = null;
  try {
    parsed = await chat("deepseek", [
      { role: "system", content: sys },
      { role: "user", content: user },
    ], { json: true });
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
  } catch (e) {
    throw aiFailure(AI_ANALYSIS_FAILED, "数据复盘生成失败，请稍后重试");
  }

  return {
    summary: s(parsed?.summary, "本次复盘没有给出明确结论，请结合数据再试一次。"),
    diagnosis: arr(parsed?.diagnosis),
    why: s(parsed?.why, "暂未给出原因分析。"),
    nextSteps: arr(parsed?.nextSteps),
    learning: s(parsed?.learning, ""),
    dataQuality: dq,
    dataSource: input.dataSource ?? "manual",
    dataSourceLabel: dataQualityLabel(dq),
  };
}
