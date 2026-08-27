// 策略顾问 workflow（P1-②）：把「公式替换词」升级为「基于账号定位的原创生成」。
// 结构：StrategyConsultant → ScriptWriter → StoryboardDirector（派生）。
// 同一模型(DeepSeek)不同角色 system prompt + JSON 串联；只调用 2 次 LLM，控成本。
// 失败即抛出（绝不静默回退成洗稿模板）。

import { chat, isConfigured } from "./llm";
import { aiFailure, AI_ANALYSIS_FAILED } from "./ai-fallback";
import { buildSoundDesign, type RepurposeShot, type SoundDesign } from "./repurpose";
import type { PersonaCard } from "./persona";

export interface StrategyAdvisory {
  persona_analysis: string;
  overlap_pct: number;
  avoid_dirs: string[];
  advantage_used: string[];
  brief: string;
  strategy_note: string;
}

export interface WorkflowResult {
  strategy_note: string;
  overlap_pct: number;
  avoid_dirs: string[];
  advantage_used: string[];
  hook: string;
  title: string;
  body: string[];
  cta: string;
  shots: RepurposeShot[];
  soundDesign: SoundDesign;
  source: "workflow";
}

interface ScriptOut {
  hook: string;
  title: string;
  body: string[];
  cta: string;
  shots: Partial<RepurposeShot>[];
}

function personaBrief(card: PersonaCard | null): string {
  if (!card) return "未提供账号定位档案";
  return [
    card.personaTags.length ? `人设：${card.personaTags.join("、")}` : "",
    card.resources.length ? `资源：${card.resources.join("、")}` : "",
    card.timing ? `时机：${card.timing}` : "",
    card.platform ? `平台：${card.platform}` : "",
    card.audience ? `人群：${card.audience}` : "",
    card.learnings.length ? `以往复盘：${card.learnings.slice(-3).join("；")}` : "",
  ].filter(Boolean).join("；") || "未提供账号定位档案";
}

const clamp01 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function runStrategyWorkflow(input: {
  personaCard: PersonaCard | null;
  reference: string;
  product: string;
  platform?: string;
  duration?: number;
}): Promise<WorkflowResult> {
  const { personaCard, reference, product, platform, duration } = input;
  if (!isConfigured("deepseek")) throw aiFailure(AI_ANALYSIS_FAILED, "策略生成需要 DeepSeek 配置");

  // ── 角色①+②：策略顾问（分析人设 → 算重合度 → 给 brief）────
  const advRaw = await chat("deepseek", [
    {
      role: "system",
      content:
        "你是短视频「爆款策略顾问」。你会读用户的账号定位档案和对标内容，算重合度、给避开方向、找出用户优势，并给一个原创 brief。" +
        "只返回 JSON：{\"persona_analysis\":\"一句话人设优势分析\",\"overlap_pct\":0-100,\"avoid_dirs\":[\"避开方向1\",\"方向2\"],\"advantage_used\":[\"用到的优势1\",\"优势2\"],\"brief\":\"给编剧的创作brief\",\"strategy_note\":\"给用户看的一段话：重合度XX%、避开哪些、优势在人设/资源/时机、纯模仿不会爆因为…\"}",
    },
    {
      role: "user",
      content:
        `【账号定位档案】${personaBrief(personaCard)}\n【对标 / 参考】${reference}\n【我的内容方向】${product}\n【平台】${platform || "抖音"}`,
    },
  ], { json: true, temperature: 0.5, maxTokens: 900, task: "workflow:strategy" });
  const adv = JSON.parse(advRaw) as StrategyAdvisory;

  // ── 角色③：编剧（基于 brief 原创，不是替换词）────
  const script = await chat("deepseek", [
    {
      role: "system",
      content:
        "你是短视频「原创编剧」。基于策略 brief 和用户优势创作一条原创口播脚本，禁止直接复制对标文案、禁止套固定公式。只返回 JSON：" +
        "{\"hook\":\"前3秒钩子\",\"title\":\"标题\",\"body\":[\"要点1\",\"要点2\",\"要点3\"],\"cta\":\"结尾行动号召\"," +
        "\"shots\":[{\"phase\":\"钩子/铺垫/展开/收尾\",\"visual\":\"画面建议\",\"line\":\"台词\",\"durationSec\":数字," +
        "\"sfx\":\"音效\",\"bgm\":\"配乐(风格/BPM)\",\"tone\":\"语调\",\"pitfall\":\"避坑\"}]}",
    },
    {
      role: "user",
      content:
        `【策略 brief】${adv.brief}\n【我的优势】${(adv.advantage_used || []).join("；")}\n【我的产品/方向】${product}\n【平台】${platform || "抖音"}${duration ? `\n【目标时长】${duration}s` : ""}\n请写一条字数适中、每条台词简短口语、能体现上述优势的原创脚本。`,
    },
  ], { json: true, temperature: 0.85, maxTokens: 1500, task: "workflow:script" });
  const s = JSON.parse(script) as ScriptOut;
  const shots: RepurposeShot[] = (s.shots || []).map((x, i) => ({
    index: i + 1,
    phase: String(x.phase || "段落"),
    visual: String(x.visual || ""),
    line: String(x.line || ""),
    durationSec: Math.max(1, Number(x.durationSec) || 8),
    sfx: String(x.sfx || "转场 whoosh / 重点词加重"),
    bgm: String(x.bgm || "轻铺底 BGM"),
    tone: String(x.tone || "自然"),
    pitfall: String(x.pitfall || "别念稿"),
  }));

  // ── 角色④：分镜导演（派生分镜 + 声音设计说明）────
  const soundDesign = buildSoundDesign(shots);
  const overlap = clamp01(Number(adv.overlap_pct) || 0);
  const strategy_note = adv.strategy_note || `你与选定的对标重合度约 ${overlap}%，已避开${(adv.avoid_dirs || []).slice(0, 2).join("、") || "雷同方向"}；你的优势在${(adv.advantage_used || []).slice(0, 2).join("、") || "人设/资源/时机"}，脚本据此展开。纯模仿不会爆。`;

  return {
    strategy_note,
    overlap_pct: overlap,
    avoid_dirs: adv.avoid_dirs || [],
    advantage_used: adv.advantage_used || [],
    hook: s.hook || "",
    title: s.title || product,
    body: s.body || [],
    cta: s.cta || "",
    shots,
    soundDesign,
    source: "workflow",
  };
}
