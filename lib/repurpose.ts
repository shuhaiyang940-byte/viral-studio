// 爆款基因重组：把「选中的爆款套路」骨架，换成「我的产品 / 人设 / 主题」，
// 输出一份可直接开拍的口播脚本（含画面建议、语调、避坑），实现「看到爆款 → 变成我的版本」。
//
// 分层：有 DeepSeek key 走真实 LLM（质量更高）；无 key 回退本地模板，保证永远可生成。
// 注意：本文件仅服务端引用（/api/repurpose），切勿在 'use client' 中 import。

import type { Playbook } from "@/lib/benchmarks";
import { chat, isConfigured } from "@/lib/llm";
import { allowMockFallback, aiFailure, AI_ANALYSIS_FAILED } from "@/lib/ai-fallback";

export interface RepurposeShot {
  index: number;
  phase: string;
  /** 画面建议（拍什么 / 怎么运镜） */
  visual: string;
  /** 台词 / 旁白（脚本式，可照念） */
  line: string;
  /** 时长（秒） */
  durationSec: number;
  /** 音效 / BGM 提示 */
  sfx: string;
  /** 配乐 / BGM 建议（风格 / 节奏 / BPM） */
  bgm?: string;
  /** 语调提示 */
  tone: string;
  /** 避坑提示 */
  pitfall: string;
}

export interface RepurposeResult {
  /** 前 3 秒钩子（脚本式） */
  hook: string;
  /** 主标题 */
  title: string;
  /** 口播正文要点：正文第一句 / 二 / 三 */
  body: string[];
  /** 结尾行动号召 */
  cta: string;
  /** 分镜表（含画面 / 语调 / 避坑） */
  shots: RepurposeShot[];
  /** 落地提示（设备 / 时长 / 发布建议） */
  tips: string[];
  /** 来源：llm = 真模型生成；template = 本地模板兜底 */
  source: "llm" | "template";
  /** 声音设计（配乐 / 音效 cue 清单 + 说明，可直接交给后期） */
  soundDesign?: SoundDesign;
}

export interface SoundDesign {
  summary: string;
  cues: { shot: string; bgm: string; sfx: string; emotion: string }[];
}

const PHASE_BGM: Record<string, string> = {
  钩子: "紧张鼓点 120BPM + 悬疑铺底，前3秒给冲击",
  铺垫: "轻铺底弦乐，留呼吸感",
  展开: "节奏推进，加轻鼓点，信息处略微收紧",
  高潮: "鼓点加量 + 情绪堆叠，转场用 whoosh 衔接",
  收尾: "舒缓收尾 BGM，结尾留 0.5s 余韵",
};

/** 从每镜的配乐 / 音效生成「声音设计说明」（模板兜底，永不空） */
export function buildSoundDesign(shots: RepurposeShot[]): SoundDesign {
  const cues = shots.map((s) => ({
    shot: `第${s.index}镜 · ${s.phase}`,
    bgm: s.bgm || "轻铺底 BGM",
    sfx: s.sfx || "转场 whoosh / 重点词加重",
    emotion: s.tone || "自然",
  }));
  const bgms = Array.from(new Set(cues.map((c) => c.bgm)));
  const sfxs = Array.from(new Set(cues.map((c) => c.sfx)));
  const summary =
    `【声音设计】总基调：${bgms[0] || "轻铺底配乐"}。配乐节奏：${bgms.join("；")}。` +
    `音效要点：${sfxs.join("；")}。前3秒务必给冲击音，结尾收余韵，全程避免压过口播。`;
  return { summary, cues };
}

export interface RepurposeInput {
  /** 选中的爆款套路（find-peer 里的 playbook） */
  playbook: Pick<Playbook, "title" | "hook" | "structure" | "cameraTips" | "music" | "shots">;
  /** 我的主题 / 产品（必填，其他都围绕它生成） */
  myTopic: string;
  /** 我的人设 / 补一句（可选） */
  myPersona?: string;
  /** 发布平台（决定节奏与结尾策略） */
  platform?: string;
  /** 口语化程度 0~100（0=正统，100=极接地气） */
  casual?: number;
  /** 情绪强度 0~100（0=温和，100=强痛点/恐吓） */
  emotion?: number;
  /** 目标时长秒（30~60，用于控制内容量与节奏） */
  duration?: number;
  /** 团队 Creative Intent 的紧凑文本（可选，注入后指导脚本方向） */
  creativeIntent?: string;
}

/** 纯函数：把「爆款套路 + 我的素材 + 团队 intent」构造成发给 LLM 的 user 提示。 */
export function buildRepurposeUserPrompt(input: {
  playbook: RepurposeInput["playbook"];
  myTopic: string;
  myPersona?: string;
  platform?: string;
  casual?: number;
  emotion?: number;
  duration?: number;
  creativeIntent?: string;
}): string {
  const { playbook, myTopic, myPersona, platform } = input;
  const structText = playbook.structure
    .map((s, i) => `${i + 1}. ${s.secs}s「${s.phase}」：${s.detail}`)
    .join("\n");
  const intentBlock = input.creativeIntent
    ? `【团队创作方案（务必遵循，不要改变核心方向）】\n${input.creativeIntent}\n\n`
    : "";
  return `${intentBlock}【爆款套路】${playbook.title}\n钩子示例：${playbook.hook}\n结构：\n${structText}\n\n【我的素材】\n主题/产品：${myTopic}${myPersona ? `\n我的人设：${myPersona}` : ""}${platform ? `\n平台：${platform}` : ""}${input.casual !== undefined ? `\n口语化程度：${input.casual}/100` : ""}${input.emotion !== undefined ? `\n情绪强度：${input.emotion}/100` : ""}${input.duration !== undefined ? `\n目标时长：约${input.duration}秒` : ""}`;
}

const PLATFORM_TIPS: Record<string, string> = {
  抖音: "前 3 秒必须狠，节奏快，结尾引导一键三连。",
  小红书: "封面和标题给足价值感，开头 1 句点明「普通人能用」。",
  视频号: "偏向熟人转发，结尾升华更易被分享。",
  B站: "干货密度要高，信息量要足，别注水。",
  快手: "真实接地气，别端着，口语化。",
  YouTube: "前 30 秒决定推荐，留梗要早。",
  TikTok: "卡点要准，紧跟热门潮流音。",
};

/** 每段缺省语调（按 phase 命名给新手可照做的提示） */
const PHASE_TONE: Record<string, string> = {
  钩子: "开门见山，语速稍快，制造信息缺口",
  铺垫: "放慢，像聊天，建立「跟我有关」",
  展开: "清晰收紧，重点处放慢加重",
  高潮: "情绪顶上，语速加快，配强音效",
  收尾: "回落，真诚，给明确的行动号召",
};

const PHASE_PITFALL: Record<string, string> = {
  钩子: "别铺垫背景，前 3 秒没钩子就划走了",
  铺垫: "别堆术语，说大白话",
  展开: "别只讲道理，给一个具体画面或数字",
  高潮: "别拖，情绪到了就收",
  收尾: "别只说「点赞」，说清「为什么值得点」",
};

function clampNum(n: unknown, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
}

/** 无 LLM 时的模板兜底：把套路骨架逐段换成「我的主题」文案 */
function buildTemplateResult(input: RepurposeInput): RepurposeResult {
  const { playbook, myTopic, myPersona, platform } = input;
  const t = myTopic.trim() || "这个主题";
  const persona = myPersona?.trim();
  const hook =
    playbook.hook?.replace(/\{.*?\}/g, "") || `（开场特写）「说真的，${t}这件事，我猜你也有同感。」`;

  const body = [
    persona ? `很多像你一样做${persona}的人，都卡在「${t}」这一步。` : `很多人一提到「${t}」，第一反应是「这跟我无关」。`,
    `但我想告诉你，${t}真正的关键是——把它变得具体、可操作。`,
    `今天就把我的完整套路拆给你，照着做就行，不用自己瞎试。`,
  ];

  const shots: RepurposeShot[] = playbook.structure.map((seg, i) => ({
    index: i + 1,
    phase: seg.phase || `第${i + 1}段`,
    visual: playbook.cameraTips?.[i] || seg.detail || "中景，人物对着镜头讲",
    line:
      seg.phase === "钩子"
        ? hook
        : `${seg.detail}。…就拿「${t}」来说，重点是这个。`,
    durationSec: clampNum(seg.secs, 8),
    sfx: playbook.music?.[0] || "轻铺底 BGM，关键信息处加强调音",
    bgm: PHASE_BGM[seg.phase] || playbook.music?.[i] || "轻铺底 BGM",
    tone: PHASE_TONE[seg.phase] || "自然，像聊天",
    pitfall: PHASE_PITFALL[seg.phase] || "别念稿，语气放松",
  }));

  const tips = [
    `设备：手机横屏 / 竖屏均可，光线充足，${shots[0]?.visual || "开场用特写"}。`,
    `时长：约 ${shots.reduce((s, x) => s + x.durationSec, 0)} 秒，控制在 60~90 秒完播率更高。`,
    platform ? `平台：${platform}——${PLATFORM_TIPS[platform] || "开场即钩子，结尾促互动"}` : "",
  ].filter(Boolean);

  return {
    hook: `（前 3 秒）${hook}`,
    title: t,
    body,
    cta: "如果你也认同，点个赞，评论区聊聊你会怎么用这招。",
    shots,
    tips,
    source: "template",
    soundDesign: buildSoundDesign(shots),
  };
}

/** 把 LLM 返回的 JSON 规范化成 RepurposeResult（对缺字段做兜底） */
function normalize(raw: any, input: RepurposeInput): RepurposeResult {
  const shotsRaw = Array.isArray(raw?.shots) ? raw.shots : [];
  const shots: RepurposeShot[] = shotsRaw.map((s: any, i: number) => ({
    index: i + 1,
    phase: String(s.phase || input.playbook.structure[i]?.phase || `第${i + 1}段`),
    visual: String(s.visual || input.playbook.cameraTips?.[i] || "中景讲内容"),
    line: String(s.line || ""),
    durationSec: clampNum(s.durationSec, input.playbook.structure[i]?.secs ?? 8),
    sfx: String(s.sfx || input.playbook.music?.[0] || "轻铺底 BGM"),
    bgm: String(s.bgm || PHASE_BGM[s.phase] || input.playbook.music?.[0] || "轻铺底 BGM"),
    tone: String(s.tone || PHASE_TONE[s.phase] || "自然"),
    pitfall: String(s.pitfall || PHASE_PITFALL[s.phase] || "别念稿"),
  }));

  const body = Array.isArray(raw?.body) ? raw.body.map((x: any) => String(x)) : [];
  return {
    hook: String(raw?.hook || ""),
    title: String(raw?.title || input.myTopic.trim()),
    body: body.length ? body : ["先把结论抛出来。", "再给一个具体方法。", "最后落到你能马上做的动作。"],
    cta: String(raw?.cta || "点个赞，评论区聊聊你的想法。"),
    shots: shots.length ? shots : [], // 空时由前端兜底提示
    tips: Array.isArray(raw?.tips) ? raw.tips.map((x: any) => String(x)) : [],
    source: "llm",
    soundDesign: buildSoundDesign(shots.length ? shots : [],
    ),
  };
}

/**
 * 爆款基因重组入口：有 DeepSeek key → LLM 让骨架换成我的素材；否则模板兜底。
 * callers 无需关心来源，返回结构一致。
 */
export async function generateRepurpose(input: RepurposeInput): Promise<RepurposeResult> {
  const { playbook, myTopic, myPersona, platform } = input;

  if (isConfigured("deepseek")) {
    try {
      const system =
        "你是短视频爆款导演。用户给了一条爆款套路的骨架，你要把它的结构原样保留，" +
        "但把内容全部替换成用户自己的主题 / 产品 / 人设，产出一份" +
        "「照念就能拍」的口播脚本。只返回 JSON，不要解释。" +
        `${input.casual !== undefined ? `口语化要求：${input.casual}/100（0=书面正统，100=极其口语接地气，多用短句与语气词）。` : ""}` +
        `${input.emotion !== undefined ? `情绪强度：${input.emotion}/100（0=温和，100=强痛点/恐吓），请据此调节钩子与语气的力度。` : ""}` +
        `${input.duration !== undefined ? `目标时长：约 ${input.duration} 秒，控制句子数量与分镜节奏。` : ""}` +
        "结构：{\"hook\":\"前3秒钩子(脚本式,可照念)\",\"title\":\"主标题\",\"body\":[\"第1要点\",\"第2要点\",\"第3要点\"]," +
        "\"cta\":\"结尾行动号召\",\"shots\":[{\"phase\":\"钩子\",\"visual\":\"画面建议\",\"line\":\"台词\",\"durationSec\":3," +
        "\"sfx\":\"音效\",\"bgm\":\"配乐(风格/节奏/BPM)\",\"tone\":\"语调提示\",\"pitfall\":\"避坑提示\"}]," +
        "\"tips\":[\"落地建议\"]}";
      const user = buildRepurposeUserPrompt(input);

      const raw = await chat("deepseek", [
        { role: "system", content: system },
        { role: "user", content: user },
      ], { json: true, temperature: 0.8, maxTokens: 1600 });
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return normalize(parsed, input);
    } catch (err) {
      if (!allowMockFallback()) {
        console.error("[repurpose] 真实生成失败（生产，不回退模板）：", err);
        throw aiFailure(AI_ANALYSIS_FAILED, err instanceof Error ? err.message : undefined);
      }
      // 开发/测试：回退本地模板，保证可演示
    }
  }

  return buildTemplateResult(input);
}
