// 账号诊所：输入「我的账号」→ 从对标库里挑 2~3 个最接近的黑马，AI 对比
// 「为什么你的播放没对标高」，输出差距诊断 + 可执行动作。
//
// 分层：有 DeepSeek key 走真实 LLM；无 key 回退本地规则模板，保证永远可生成。
// 注意：仅服务端引用（/api/clinic），切勿在 'use client' 中 import。

import { BENCHMARKS, blackHorseIndex, type IdeaType } from "@/lib/benchmarks";
import { chat, isConfigured } from "@/lib/llm";

export interface ClinicInput {
  /** 赛道：生活 / 旅游 / 美食 / 情感 / 知识 / 商业 */
  niche: string;
  /** 内容类型：sell=卖货，talk=口播 */
  contentType: "sell" | "talk";
  /** 发布平台（可选） */
  platform?: string;
  /** 粉丝量（万，可选） */
  followers?: number;
  /** 互动率（%，可选） */
  engagementRate?: number;
  /** 我的账号近况 / 选题描述（可选） */
  description?: string;
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
  /** 为什么对标能爆、你没爆 */
  why: string;
  /** 具体怎么改 */
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
  /** 账号健康度 0~100 */
  score: number;
  /** 一句话诊断 */
  summary: string;
  /** 关键维度对比（你的表现 vs 对标） */
  dimensions: ClinicDim[];
  /** 差距清单（为什么 + 怎么改） */
  gaps: ClinicGap[];
  /** 选中的对标 */
  benchmarks: ClinicBench[];
  /** 按优先级的具体动作 */
  actions: string[];
  /** 来源 */
  source: "llm" | "template";
}

function ideaTypeOf(c: string): IdeaType {
  return c === "sell" ? "sell" : "talk";
}

/** 从对标库选 2~3 个最贴合的黑马对标（同内容类型，黑马指数优先） */
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

const STAT_TIPS: Record<string, string> = {
  hook: "前 3 秒再加一个反常识 / 身份共鸣钩子，把人留住再谈内容。",
  value: "每 15 秒给一个具体细节（物件、数字、人名），让信息看得见。",
  emotion: "结尾情绪升华一句，给用户一个转发的理由。",
  interaction: "结尾抛开放式问题，评论区盘活，互动分会拉起来。",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 无 LLM 时的规则模板：用你填的数据对比对标，给出确定性诊断 */
function buildTemplateResult(input: ClinicInput, benchmarks: ClinicBench[]): ClinicResult {
  const yourEng = input.engagementRate;
  const yourFol = input.followers;
  const benchAvgEng = benchmarks.length
    ? benchmarks.reduce((s, b) => s + b.engagementRate, 0) / benchmarks.length
    : 8;
  const hasEng = Number.isFinite(yourEng);
  const hasFol = Number.isFinite(yourFol);

  const dimensions: ClinicDim[] = [];
  let score = 60;

  if (hasEng) {
    const gap = yourEng! - benchAvgEng;
    if (gap < -3) score -= 18;
    else if (gap < -1) score -= 8;
    else score += 8;
    dimensions.push({
      key: "interaction",
      label: "互动率",
      yourValue: `${yourEng}%`,
      benchValue: `${benchAvgEng.toFixed(1)}%（对标均值）`,
      status: gap < -3 ? "danger" : gap < -1 ? "gap" : "ok",
      advice:
        gap < -1
          ? "你的互动率明显低于对标，说明「勾起反应」的钩子不够狠。"
          : "互动率在健康区间，保持，重点放到内容结构。",
    });
  } else {
    dimensions.push({
      key: "interaction",
      label: "互动率",
      yourValue: "未填写",
      benchValue: `${benchAvgEng.toFixed(1)}%（对标均值）`,
      status: "gap",
      advice: "填一下你的互动率，我才能精准对比；先按「钩子要狠」补起来。",
    });
  }

  if (hasFol) {
    const folAvg = benchmarks.length
      ? benchmarks.reduce((s, b) => s + b.followers, 0) / benchmarks.length
      : 300;
    const gap = yourFol! - folAvg;
    if (gap < -folAvg * 0.4) score -= 10;
    else if (gap > folAvg * 0.5) score += 6;
    dimensions.push({
      key: "account",
      label: "粉丝量",
      yourValue: `${yourFol}万`,
      benchValue: `${Math.round(folAvg)}万（对标均值）`,
      status: gap < -folAvg * 0.4 ? "gap" : "ok",
      advice:
        gap < -folAvg * 0.4
          ? "粉丝盘子还不够大，但黑马对标证明了「小号也能爆」，先用内容质量换破圈。"
          : "粉丝量不输对标，问题多半在选题与钩子的重复度。",
    });
  } else {
    dimensions.push({
      key: "account",
      label: "粉丝量",
      yourValue: "未填写",
      benchValue: `${Math.round(benchmarks.reduce((s, b) => s + b.followers, 0) / benchmarks.length)}万（对标均值）`,
      status: "gap",
      advice: "填写粉丝量可对比体量；小号别学大号的稳，要挑「高黑马」的对标抄。",
    });
  }

  const gaps: ClinicGap[] = [];
  if (hasEng && yourEng! < benchAvgEng) {
    gaps.push({
      title: "开头钩子不够狠",
      why: `你的互动率 ${yourEng}% 低于对标 ${benchAvgEng.toFixed(1)}%，用户滑到一半就走了，自然没互动。`,
      how: "把开头改成「反常识」或「身份共鸣」，前 3 秒给个信息缺口，别先自我介绍。",
    });
  }
  gaps.push({
    title: "缺少可复制的爆款结构",
    why: "对标账号能稳定输出，是因为背后有固定套路；你可能每条都在随机发挥。",
    how: `挑「${benchmarks[0]?.name || "对标"}」这条黑马，用「爆款套路 → 一键变成我的视频」套它的结构。`,
  });
  if (input.description && input.description.length > 20) {
    gaps.push({
      title: "选题/表达偏向自己，缺少用户视角",
      why: "你更想讲自己想讲的，而爆款都在讲「用户想要的」或「用户担心的」。",
      how: "下次先写「用户痛点」，再补你的解决方案，顺序别反过来。",
    });
  }

  const actions = [
    hasEng && yourEng! < benchAvgEng
      ? "本周先改开头：每一条都先用「反常识/身份共鸣」钩子顶 3 秒。"
      : "保持现有互动水平，把力气放到内容结构和选题重复度上。",
    `对标「${benchmarks[0]?.name || "黑马"}」：它的黑马指数 ${benchmarks[0]?.blackHorseIndex ?? "-"}，说明小号也有强爆点，值得抄结构。`,
    "固定每周更新节奏（先 2 条），跑通再增量，别靠灵光一闪。",
  ];

  score = clamp(Math.round(score), 0, 100);
  return {
    score,
    summary: hasEng
      ? `你已经有一定基础，但在「勾住人」上差了${benchAvgEng > (yourEng ?? 0) ? "一口气" : "一步之遥"}，抓好开头就能追上黑马对标。`
      : "补上你的互动率 / 粉丝量，我能给出更准的差距诊断；目前先按「钩子要狠 + 套爆款结构」动起来。",
    dimensions,
    gaps,
    benchmarks,
    actions,
    source: "template",
  };
}

function normalize(raw: any, input: ClinicInput, benchmarks: ClinicBench[]): ClinicResult {
  const dimsRaw = Array.isArray(raw?.dimensions) ? raw.dimensions : [];
  const dims: ClinicDim[] = dimsRaw.map((d: any) => ({
    key: String(d.key || "x"),
    label: String(d.label || ""),
    yourValue: String(d.yourValue || ""),
    benchValue: String(d.benchValue || ""),
    status: ["ok", "gap", "danger"].includes(d.status) ? d.status : "gap",
    advice: String(d.advice || ""),
  }));
  const gapsRaw = Array.isArray(raw?.gaps) ? raw.gaps : [];
  const gaps: ClinicGap[] = gapsRaw.map((g: any) => ({
    title: String(g.title || ""),
    why: String(g.why || ""),
    how: String(g.how || ""),
  }));
  const score = clamp(Math.round(Number(raw?.score ?? 60)), 0, 100);
  return {
    score,
    summary: String(raw?.summary || ""),
    dimensions: dims,
    gaps,
    benchmarks: benchmarks,
    actions: Array.isArray(raw?.actions) ? raw.actions.map((x: any) => String(x)) : [],
    source: "llm",
  };
}

/** 账号诊所入口：有 DeepSeek key → LLM 精细诊断；否则规则模板兜底 */
export async function generateClinic(input: ClinicInput): Promise<ClinicResult> {
  const benchmarks = pickBenchmarks(input);

  if (isConfigured("deepseek")) {
    try {
      const benchText = benchmarks
        .map(
          (b) =>
            `${b.name}(${b.handle}) 粉丝${b.followers}万 互动${b.engagementRate}% 黑马指数${b.blackHorseIndex}\n  「${b.reason}」`
        )
        .join("\n");
      const system =
        "你是资深短视频账号诊断教练。用户给出自己的账号数据（赛道/平台/粉丝/互动率/近况），" +
        "以及从对标库挑出的几个「黑马对标」。你要对比：为什么对标数据好、用户为何没起来，" +
        "给出一份「既扎心又马上能做」的诊断。只返回 JSON，不要解释。" +
        "结构：{\"score\":0到100整数,\"summary\":\"一句话诊断\",\"dimensions\":[{\"key\":\"interaction\"|\"account\"|\"hook\"|\"content\"," +
        "\"label\":\"维度名\",\"yourValue\":\"你的值\",\"benchValue\":\"对标值\",\"status\":\"ok\"|\"gap\"|\"danger\",\"advice\":\"建议\"}]," +
        "\"gaps\":[{\"title\":\"差距名\",\"why\":\"为什么\",\"how\":\"怎么改\"}],\"actions\":[\"按优先级的动作\"]}";
      const user = `【我的账号】\n赛道：${input.niche}，类型：${input.contentType === "sell" ? "卖货" : "口播"}，平台：${input.platform || "未填"}\n粉丝：${input.followers ?? "未填"}万，互动率：${input.engagementRate ?? "未填"}%\n近况：${input.description || "未填"}\n\n【对标黑马】\n${benchText}`;

      const raw = await chat("deepseek", [
        { role: "system", content: system },
        { role: "user", content: user },
      ], { json: true, temperature: 0.7, maxTokens: 1600 });
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return normalize(parsed, input, benchmarks);
    } catch {
      // LLM 失败回落模板
    }
  }

  return buildTemplateResult(input, benchmarks);
}
