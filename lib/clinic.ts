// 账号诊断与破局报告：商业化顾问级（MCN 操盘手视角）。
// 输入账号数据 → 结合对标黑马，输出「健康度 + 全局战略观 + 微观执行 + 下周行动清单」。
//
// 分层：有 DeepSeek key 走真实 LLM（毒辣专业）；无 key 回退本地规则模板，保证永远可生成。
// 注意：仅服务端引用（/api/clinic），切勿在 'use client' 中 import。

import { BENCHMARKS, blackHorseIndex, type IdeaType } from "@/lib/benchmarks";
import { chat, isConfigured } from "@/lib/llm";
import { allowMockFallback, aiFailure, AI_ANALYSIS_FAILED } from "@/lib/ai-fallback";
import type { AccountSnapshot, DataQuality, DataSourceId } from "@/lib/data-platform/types";
import { dataQualityLabel, dataQualityNote } from "@/lib/data-platform/types";
import { checkOrganic, type OrganicCheckInput } from "@/lib/organic-check";

export interface ClinicInput {
  /** 赛道：生活 / 旅游 / 美食 / 情感 / 知识 / 商业 */
  niche: string;
  /** 内容类型：sell=卖货，talk=口播 */
  contentType: "sell" | "talk";
  /** 发布平台（可选） */
  platform?: string;
  /** 账号名称 / 主页链接（极简入口，可选） */
  account?: string;
  /** 粉丝量（万，可选） */
  followers?: number;
  /** 互动率（%，可选） */
  engagementRate?: number;
  /** 近 20 条：平均播放（可选） */
  avgPlays?: number;
  /** 近 20 条：平均点赞（可选） */
  avgLikes?: number;
  /** 近 20 条：平均评论（可选） */
  avgComments?: number;
  /** 近 20 条：平均转发（可选） */
  avgShares?: number;
  /** 我的账号近况 / 选题描述（可选） */
  description?: string;
  /** 文案采样（近 1-3 条真实文案，可选） */
  sampleText?: string;
  /** 数据来源快照（含可信度；缺省视为 manual/none） */
  dataSource?: AccountSnapshot;
}

export interface ClinicDim {
  key: string;
  label: string;
  yourValue: string;
  benchValue: string;
  status: "ok" | "gap" | "danger";
  advice: string;
}

export interface ClinicGap {
  title: string;
  why: string;
  how: string;
}

export interface ClinicBench {
  name: string;
  handle: string;
  followers: number;
  engagementRate: number;
  blackHorseIndex: number;
  reason: string;
}

export interface ClinicResult {
  score: number;
  /** 一句话总结核心瓶颈 */
  summary: string;
  /** 诚实说明：诊断基于什么（真实数据 or 你填写的资料） */
  sourceNote: string;
  /** 数据可信度等级：platform=真实 / estimated=手填估算 / none=无数据 */
  dataQuality: DataQuality;
  /** 数据来源 id */
  dataSource: DataSourceId;
  /** 数据来源展示名 */
  dataSourceLabel: string;
  /** 内容真实性 / 疑似刷量检测 */
  organic: { score: number; signals: { key: string; label: string; redFlag: boolean; detail: string; level: string }[]; note: string };
  /** 全局战略观：赛道红海度 */
  redOcean: { level: string; detail: string };
  /** 同质化预警 + 后果 */
  homogen: { alert: string; consequence: string };
  /** 差异化破局出路（1-2 条） */
  differentiation: string[];
  /** 选题与热点诊断 */
  topics: string;
  /** 黄金 3 秒钩子诊断 */
  hookDiag: string;
  /** 更新频率与黄金时段建议 */
  schedule: string;
  /** 下周改版行动清单（3 件） */
  todoList: string[];
  /** 关键维度对比（你的表现 vs 对标） */
  dimensions: ClinicDim[];
  /** 差距清单 */
  gaps: ClinicGap[];
  /** 对标黑马 */
  benchmarks: ClinicBench[];
  /** 按优先级的动作 */
  actions: string[];
  source: "llm" | "template";
}

function ideaTypeOf(c: string): IdeaType {
  return c === "sell" ? "sell" : "talk";
}

export function pickBenchmarks(input: ClinicInput): ClinicBench[] {
  const type = ideaTypeOf(input.contentType);
  const list = BENCHMARKS.filter((a) => a.ideaType === type);
  return [...list]
    .sort((x, y) => blackHorseIndex(y) - blackHorseIndex(x))
    .slice(0, 3)
    .map((a) => ({
      name: a.name,
      handle: a.handle,
      followers: a.followers,
      engagementRate: a.engagementRate,
      blackHorseIndex: blackHorseIndex(a),
      reason: a.reason,
    }));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 无 LLM 时的规则模板：顾问级报告兜底（保证永远可生成且结构完整） */
function buildTemplateResult(input: ClinicInput, benchmarks: ClinicBench[]): ClinicResult {
  const hasEng = Number.isFinite(input.engagementRate);
  const benchAvgEng = benchmarks.length
    ? benchmarks.reduce((s, b) => s + b.engagementRate, 0) / benchmarks.length
    : 8;
  let score = 55;
  if (hasEng && input.engagementRate! < benchAvgEng) score -= 15;
  score = clamp(score, 0, 100);
  const dims: ClinicDim[] = [];
  if (hasEng) {
    const gap = input.engagementRate! - benchAvgEng;
    dims.push({
      key: "interaction",
      label: "互动率",
      yourValue: `${input.engagementRate}%`,
      benchValue: `${benchAvgEng.toFixed(1)}%（对标均值）`,
      status: gap < -3 ? "danger" : gap < -1 ? "gap" : "ok",
      advice: gap < -1 ? "钩子不够狠，前 3 秒没把人留住。" : "互动在健康区间，重点拉内容结构。",
    });
  }
  const dq = input.dataSource?.quality ?? "none";
  const organic = checkOrganic({
    plays: input.avgPlays,
    likes: input.avgLikes,
    comments: input.avgComments,
    shares: input.avgShares,
    followers: input.followers,
  } as OrganicCheckInput);
  return {
    score,
    summary: hasEng
      ? `你的账号卡在「能发但没破圈」：数据不差，但离黑马对标还差一口气的「差异化」。`
      : "补上近 20 条互动数据与文案采样，我能给你更精准的破局方案；当前先按通用的三条动作走。",
    sourceNote: dataQualityNote(dq),
    dataQuality: dq,
    dataSource: input.dataSource?.source ?? "manual",
    dataSourceLabel: dataQualityLabel(dq),
    organic,
    redOcean: {
      level: "红海蓝海交界",
      detail: `${input.niche}赛道竞争者众多，但同质化严重；真正稀缺的是「有辨识度的人设 + 能落地的干货」。`,
    },
    homogen: {
      alert: "你现在的内容，和市面上 70% 的账号长得一样：一样的开头、一样的配乐、一样的语气。",
      consequence: "继续这样，用户永远记不住你，只能靠算法随机推流，播放量长期在低位徘徊，越做越挫败。",
    },
    differentiation: [
      `切入细分人群：把「${input.niche}」再切开，只服务一个具体人群（如刚入行的新手 / 预算有限的小店）。`,
      "换表达形式：从「平铺直叙讲干货」改成「强剧情 / 强反差 / 真人出镜」中的一种，先做一版不同的。",
    ],
    topics: "选题偏大路货，建议盯最近 7 天爆点，别碰去年就炒冷饭的话题。",
    hookDiag: "前 3 秒大概率还在自我介绍，浪费了黄金窗口；换成「反常识 / 痛点直击」开头。",
    schedule: "先固定每周 2~3 条，选 18:00-21:00 发布；数据稳定后再加更。",
    todoList: [
      "砍掉开场白废话，前 1 秒直接抛冲突或结果。",
      "统一封面与标题风格，让主页像同一个账号。",
      "挑一条黑马对标，用「爆款搬运」套它的骨架做一版。",
    ],
    dimensions: dims,
    gaps: [],
    benchmarks,
    actions: ["先改前 3 秒钩子", "固定更新节奏", "做出一个区别于同质化的差异化人设"],
    source: "template",
  };
}

function str(v: unknown, fb: string): string {
  return typeof v === "string" && v.trim() ? v : fb;
}

function strArr(v: unknown, fb: string[]): string[] {
  if (Array.isArray(v)) {
    const a = v.map((x: any) => String(x)).filter(Boolean);
    return a.length ? a : fb;
  }
  return fb;
}

function normalize(raw: any, input: ClinicInput, benchmarks: ClinicBench[]): ClinicResult {
  const score = clamp(Math.round(Number(raw?.score ?? 55)), 0, 100);
  const dq = input.dataSource?.quality ?? "none";
  const organic = checkOrganic({
    plays: input.avgPlays,
    likes: input.avgLikes,
    comments: input.avgComments,
    shares: input.avgShares,
    followers: input.followers,
  } as OrganicCheckInput);
  const dims = (Array.isArray(raw?.dimensions) ? raw.dimensions : []).map((d: any) => ({
    key: String(d.key || "x"),
    label: String(d.label || ""),
    yourValue: String(d.yourValue || ""),
    benchValue: String(d.benchValue || ""),
    status: ["ok", "gap", "danger"].includes(d.status) ? d.status : "gap",
    advice: String(d.advice || ""),
  }));
  return {
    score,
    summary: str(raw?.summary, "数据还不够全，先给出可执行的粗诊断。"),
    sourceNote: str(raw?.sourceNote, dataQualityNote(dq)),
    dataQuality: dq,
    dataSource: input.dataSource?.source ?? "manual",
    dataSourceLabel: dataQualityLabel(dq),
    organic,
    redOcean: { level: str(raw?.redOcean?.level, "红海蓝海交界"), detail: str(raw?.redOcean?.detail, "赛道饱和，需要差异化。") },
    homogen: { alert: str(raw?.homogen?.alert, "内容同质化明显。"), consequence: str(raw?.homogen?.consequence, "长期难以破圈。") },
    differentiation: strArr(raw?.differentiation, ["切入细分人群", "换表达形式做差异化"]),
    topics: str(raw?.topics, "选题偏保守，盯近期热点。"),
    hookDiag: str(raw?.hookDiag, "前 3 秒需要更强的钩子。"),
    schedule: str(raw?.schedule, "固定每周 2~3 条，晚间发布。"),
    todoList: strArr(raw?.todoList, ["砍掉开场废话", "统一封面风格", "套一条黑马对标"]),
    dimensions: dims,
    gaps: (Array.isArray(raw?.gaps) ? raw.gaps : []).map((g: any) => ({
      title: String(g.title || ""),
      why: String(g.why || ""),
      how: String(g.how || ""),
    })),
    benchmarks,
    actions: strArr(raw?.actions, ["先改前 3 秒钩子", "固定更新节奏", "做差异化人设"]),
    source: "llm",
  };
}

export async function generateClinic(input: ClinicInput): Promise<ClinicResult> {
  const benchmarks = pickBenchmarks(input);
  // 只有用户提供了真实数据（数值型指标 / 描述 / 文案采样）才走 LLM 精确诊断；
  // 否则走规则模板做诚实的"方向参考"，避免 LLM 在无数据时编造分数/断言未提供的字段对比
  const hasData =
    Number.isFinite(input.engagementRate) || Number.isFinite(input.followers) ||
    Number.isFinite(input.avgPlays) || Number.isFinite(input.avgLikes) ||
    Number.isFinite(input.avgComments) || !!input.description?.trim() || !!input.sampleText?.trim();
  if (hasData && isConfigured("deepseek")) {
    try {
      const benchText = benchmarks
        .map(
          (b) =>
            `${b.name}(${b.handle}) 粉丝${b.followers}万 互动${b.engagementRate}% 黑马指数${b.blackHorseIndex}\n  「${b.reason}」`
        )
        .join("\n");
      const system =
        "你是一位资深短视频商业化顾问兼 MCN 操盘手，眼光毒辣，善于从「商业全局观」与「内容微观执行」两个维度为创作者诊断账号病灶。\n" +
        "根据输入的账号数据（平台、赛道、近20条视频互动数据、文案采样）与从对标库挑出的黑马对标，输出一份极具商业指导价值的《账号诊断与破局报告》。\n" +
        "语气：客观、专业、毒辣，既指出问题也给出强烈可行性的落地建议。\n" +
        "只返回 JSON：{\"score\":1到100整数,\"summary\":\"一句话核心瓶颈\"," +
        "\"redOcean\":{\"level\":\"赛道红海度(极度饱和/红海蓝海交界/极具潜力)\",\"detail\":\"分析\"}," +
        "\"homogen\":{\"alert\":\"同质化直言\",\"consequence\":\"继续这么做的下场\"}," +
        "\"differentiation\":[\"降维/差异化破局方向1\",\"方向2\"],\"topics\":\"选题与热点诊断\"," +
        "\"hookDiag\":\"黄金3秒钩子诊断\",\"schedule\":\"更新频率与黄金时段建议\"," +
        "\"todoList\":[\"下周第1件事\",\"第2件事\",\"第3件事\"],\"actions\":[\"按优先级的动作\"]," +
        "\"dimensions\":[{\"key\":\"interaction\",\"label\":\"互动率\",\"yourValue\":\"你的值\",\"benchValue\":\"对标值\",\"status\":\"ok|gap|danger\",\"advice\":\"建议\"}],\"gaps\":[{\"title\":\"差距\",\"why\":\"为什么\",\"how\":\"怎么改\"}]}。" +
        "硬规则：①summary 必须针对本条账号的具体情况给判断，禁止\"内容同质化严重、缺乏差异化\"这类空泛模板句；②只断言用户实际提供的字段，某字段未填（如互动率未填）就说\"未提供\"，不要编造数值对比；③若用户提供了文案采样（sampleText），请在诊断中点名引用采样中的具体句子，给出针对性意见。";
      const user =
        `【我的账号】\n赛道：${input.niche}，类型：${input.contentType === "sell" ? "卖货" : "口播"}，平台：${input.platform || "未填"}\n账号名/链接：${input.account || "未填"}\n粉丝：${input.followers ?? "未填"}万，互动率：${input.engagementRate ?? "未填"}%\n近20条：平均播放 ${input.avgPlays ?? "未填"}，平均点赞 ${input.avgLikes ?? "未填"}，平均评论 ${input.avgComments ?? "未填"}\n近况：${input.description || "未填"}\n文案采样：${input.sampleText || "未填"}\n\n【对标黑马】\n${benchText}`;
      const raw = await chat("deepseek", [
        { role: "system", content: system },
        { role: "user", content: user },
      ], { json: true, temperature: 0.75, maxTokens: 2000 });
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return normalize(parsed, input, benchmarks);
    } catch (err) {
      if (!allowMockFallback()) {
        console.error("[clinic] 真实诊断失败（生产，不回退模板）：", err);
        throw aiFailure(AI_ANALYSIS_FAILED, err instanceof Error ? err.message : undefined);
      }
      // 开发/测试：回落模板，保证可演示
    }
  }
  return buildTemplateResult(input, benchmarks);
}
