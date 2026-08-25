// 三段流水线：对标文案 → 爆款基因拆解 → 复刻成原创脚本（去 AI 味）→ 导演级分镜。
//
// 分层（按模型特性分工）：
//   - P1 拆解（理解/结构化）：千问 Qwen 优先（理解力强），DeepSeek 兜底；
//   - P2 复刻 / P3 分镜（生成/口语/结构）：DeepSeek 优先（生成强、便宜、口语好）。
//   全链路 JSON Mode（response_format json_object），无 key 时逐级回退本地模板，保证永远可生成。
//
// 仅服务端引用（/api/viral-engine），切勿在 'use client' 中 import。

import { chat, isConfigured, type LlmProvider } from "@/lib/llm";
import { allowMockFallback, aiFailure, AI_ANALYSIS_FAILED } from "@/lib/ai-fallback";

/* ─────────── 类型 ─────────── */

export interface Blueprint {
  hook_type: string;
  hook_analysis: string;
  core_pain_points: string[];
  narrative_structure: { stage: string; key_content: string; emotion: string }[];
  replaceable_slots: {
    product_slot: string;
    target_audience_slot: string;
    problem_slot: string;
  };
}

export interface ScriptLine {
  /** 口播文案（整句，含语气词） */
  text: string;
  /** 情绪 / 语气提示 */
  mood?: string;
}

export interface StoryboardRow {
  /** 镜号（01…） */
  no: string;
  /** 景别与镜头动作 */
  shot: string;
  /** 口播文案（含停顿与语气指导） */
  line: string;
  /** 画面 / 道具提示 */
  cue: string;
  /** 音效 / BGM 建议 */
  sfx: string;
}

export interface Storyboard {
  rows: StoryboardRow[];
  notes: string[];
  bgm: string;
}

export interface ViralEngineInput {
  /** 对标视频文案 / 字幕 */
  text: string;
  /** 我的产品 / 服务 */
  product: string;
  /** 我的人设 / 风格 */
  persona?: string;
  /** 发布平台 */
  platform?: string;
}

export interface ViralEngineResult {
  blueprint: Blueprint;
  /** 复刻出的原创口播脚本（含语气提示） */
  script: ScriptLine[];
  storyboard: Storyboard;
  source: "llm" | "template";
}

/* ─────────── 通用 LLM 调用：JSON Mode + 回退 ─────────── */

async function askJson<T>(
  providers: LlmProvider[],
  system: string,
  user: string,
  maxTokens = 1600
): Promise<T | null> {
  for (const p of providers) {
    if (!isConfigured(p)) continue;
    try {
      const raw = await chat(
        p,
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { json: true, temperature: 0.7, maxTokens }
      );
      return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
    } catch {
      // 失败则换下一个 provider / 回退模板
    }
  }
  return null;
}

/* ─────────── P1 拆解：爆款基因提取器 ─────────── */

function templateBlueprint(text: string): Blueprint {
  const t = text.trim().slice(0, 120);
  return {
    hook_type: "反常识 / 悬念前置",
    hook_analysis: "开头先抛一个让用户觉得「咦？跟我想的不一样」的点，制造好奇，把人留住。",
    core_pain_points: t
      ? [`从「${t}」看，核心是没把它讲透、也没给可操作步骤`, "用户看完不知道该怎么做"]
      : ["做这件事没有效果", "不知道怎么下手"],
    narrative_structure: [
      { stage: "前3秒吸引", key_content: "痛点 / 悬念", emotion: "好奇" },
      { stage: "中段信任搭建", key_content: "干货 / 真实案例", emotion: "认可" },
      { stage: "尾段转化引导", key_content: "行动号召 (CTA)", emotion: "紧迫感" },
    ],
    replaceable_slots: {
      product_slot: "你的产品 / 服务",
      target_audience_slot: "你的目标人群",
      problem_slot: "它解决的核心问题",
    },
  };
}

/** 用模板根据文案片段猜一个更贴近的钩子类型 */
function guessHookType(text: string): string {
  const t = text.slice(0, 60);
  if (/别|千万|警告|误区|错/.test(t)) return "反常识恐吓";
  if (/\?|竟然|没想到|原来|到底/.test(t)) return "悬念拉满";
  if (/免费|福利|优惠|送你|领/.test(t)) return "福利诱惑";
  if (/你|一样|同感|是不是|扎心/.test(t)) return "痛点共鸣";
  return "认知冲突";
}

export async function analyzeBlueprint(text: string): Promise<Blueprint> {
  const system =
    "你是精通抖音、小红书算法的资深内容总监。分析用户提供的对标文案，" +
    "提取底层「爆款基因」，只返回 JSON：{" +
    '"hook_type":"黄金3秒钩子类型(如反常识恐吓/认知冲突/悬念拉满/福利诱惑)",' +
    '"hook_analysis":"前3秒如何抓取注意力并提升留存率的剖析",' +
    '"core_pain_points":["痛点1","痛点2"],' +
    '"narrative_structure":[{"stage":"前3秒吸引","key_content":"痛点/悬念","emotion":"焦虑/好奇"},{"stage":"中段信任搭建","key_content":"干货/案例/反转","emotion":"认可/恍然大悟"},{"stage":"尾段转化引导","key_content":"行动号召(CTA)","emotion":"紧迫感"}],' +
    '"replaceable_slots":{"product_slot":"原视频产品/服务词","target_audience_slot":"原视频目标人群词","problem_slot":"原视频解决的核心问题"}}';

  const raw = await askJson<Blueprint>(
    ["qwen", "deepseek"],
    system,
    `请拆解以下对标视频文案：\n\n"""${text}"""`,
    1200
  );
  if (!raw) {
    if (!allowMockFallback()) throw aiFailure(AI_ANALYSIS_FAILED, "无法获得真实 AI 拆解结果");
    const bp = templateBlueprint(text);
    bp.hook_type = guessHookType(text);
    return bp;
  }
  // 规范化，防止缺字段
  return {
    hook_type: String(raw.hook_type || "认知冲突"),
    hook_analysis: String(raw.hook_analysis || "前 3 秒制造信息缺口，留住用户。"),
    core_pain_points: Array.isArray(raw.core_pain_points)
      ? raw.core_pain_points.map((x: any) => String(x)).filter(Boolean)
      : [],
    narrative_structure: Array.isArray(raw.narrative_structure)
      ? raw.narrative_structure.map((s: any) => ({
          stage: String(s.stage || "阶段"),
          key_content: String(s.key_content || ""),
          emotion: String(s.emotion || ""),
        }))
      : [],
    replaceable_slots: {
      product_slot: String(raw.replaceable_slots?.product_slot || "产品/服务"),
      target_audience_slot: String(raw.replaceable_slots?.target_audience_slot || "目标人群"),
      problem_slot: String(raw.replaceable_slots?.problem_slot || "核心问题"),
    },
  };
}

/* ─────────── P2 复刻：去 AI 味原创脚本 ─────────── */

function templateScript(bp: Blueprint, product: string, persona?: string): ScriptLine[] {
  const p = product.trim();
  return [
    { text: `听我的，${persona ? `做${persona}的` : "做"}"${p}"这件事，方向可能从一开始就错了。`, mood: "神秘低沉" },
    { text: "很多人一上来就研究怎么拍、怎么剪，结果没人看。", mood: "平静，说人话" },
    { text: "其实关键就三步：钩子、痛点、行动。", mood: "清点，稍快" },
    { text: `先说${bp.replaceable_slots.problem_slot || "这个坑"}，你大概率踩过。`, mood: "共鸣，放缓" },
    { text: `然后记住：${p}，别贪多，一招就够。`, mood: "笃定，加重" },
    { text: "看到这，说明你是真想做点什么。点个赞，评论区告诉我你卡在哪。", mood: "真诚，收束" },
  ];
}

export async function rewriteFromBlueprint(
  bp: Blueprint,
  input: ViralEngineInput
): Promise<ScriptLine[]> {
  const system =
    "你是顶尖口播编剧，擅长写「平实、有劲、像朋友聊天」的短视频文案。\n" +
    "严格要求：\n" +
    "1. 严禁 AI 常用套话（总而言之、首先其次、绝佳选择、不容错过、今天就带大家）。\n" +
    "2. 全文短句、口语断句，每句尽量不超过 15 字。\n" +
    "3. 保留原爆款的黄金 3 秒钩子心理逻辑，但内容 100% 换成用户的产品与人设。\n" +
    "4. 适当加口语语气词（听我的、看这里、千万别、记住了）。\n" +
    "只返回 JSON：{" +
    '"lines":[{"text":"一句口播(含语气词)","mood":"情绪/语气提示(如 神秘低沉/语速加快/真诚}"],"cta":"结尾行动号召"}' +
    "}";

  const structureText = bp.narrative_structure
    .map((s) => `${s.stage}：${s.key_content}（情绪：${s.emotion}）`)
    .join("\n");
  const user =
    `【对标结构】\n钩子类型：${bp.hook_type}\n钩子剖析：${bp.hook_analysis}\n痛点：${bp.core_pain_points.join("、")}\n叙事结构：\n${structureText}\n\n` +
    `【我的素材】\n产品：${input.product}\n人设：${input.persona || "普通创作者"}\n平台：${input.platform || "抖音"}`;

  const raw = await askJson<{ lines?: any[]; cta?: string }>(
    ["deepseek", "qwen"],
    system,
    user,
    1400
  );
  if (!raw || !Array.isArray(raw.lines)) {
    if (!allowMockFallback()) throw aiFailure(AI_ANALYSIS_FAILED, "无法获得真实 AI 复刻结果");
    return templateScript(bp, input.product, input.persona);
  }
  const lines: ScriptLine[] = raw.lines.map((l: any) => ({
    text: String(l.text || ""),
    mood: l.mood ? String(l.mood) : undefined,
  }));
  if (raw.cta) lines.push({ text: String(raw.cta), mood: "真诚" });
  return lines.filter((l) => l.text.trim());
}

/* ─────────── P3 导演分镜 ─────────── */

function templateStoryboard(script: ScriptLine[], product: string): Storyboard {
  const rows: StoryboardRow[] = script.map((l, i) => ({
    no: String(i + 1).padStart(2, "0"),
    shot: i === 0 ? "手持近景（快速推镜头）" : i % 3 === 0 ? "特写（展示产品细节）" : "中景（真人出镜）",
    line: `${l.mood ? `*（${l.mood}）*` : ""}“${l.text}”`,
    cue: i === 0 ? "眼神注视镜头，表情要稳" : `配合讲到的「${product}」做动作`,
    sfx: i === 0 ? "断音音效 + 快速鼓点" : "轻铺底 BGM",
  }));
  return {
    rows,
    notes: [
      "第 02 镜语速别慢下来，否则完播率会往下掉。",
      "手机横屏或竖屏都行，但背景要干净，光线要足。",
    ],
    bgm: "轻松欢快卡点（能带动节奏的类型即可）",
  };
}

export async function buildStoryboard(
  script: ScriptLine[],
  input: ViralEngineInput,
  sc: ScriptLine[]
): Promise<Storyboard> {
  const scriptText = script.map((l) => (l.mood ? `[${l.mood}] ${l.text}` : l.text)).join("\n");
  const system =
    "你是短视频现场导演，辅导零基础小白用手机拍口播。把口播脚本转成分镜表。" +
    "只返回 JSON：{" +
    '"rows":[{"no":"01","shot":"景别与镜头动作","line":"口播文案(含停顿与语气指导)","cue":"画面/道具提示","sfx":"音效/BGM建议"}],' +
    '"notes":["导演避坑提示1","导演避坑提示2"],"bgm":"推荐BGM风格"}';
  const raw = await askJson<{ rows?: any[]; notes?: any[]; bgm?: string }>(
    ["deepseek", "qwen"],
    system,
    `请把下面口播脚本转成小白能看懂的分镜表：\n\n${scriptText}`,
    1500
  );
  if (!raw || !Array.isArray(raw.rows)) {
    if (!allowMockFallback()) throw aiFailure(AI_ANALYSIS_FAILED, "无法获得真实 AI 分镜结果");
    return templateStoryboard(sc, input.product);
  }
  const rows: StoryboardRow[] = raw.rows.map((r: any) => ({
    no: String(r.no || ""),
    shot: String(r.shot || ""),
    line: String(r.line || ""),
    cue: String(r.cue || ""),
    sfx: String(r.sfx || ""),
  }));
  return {
    rows,
    notes: Array.isArray(raw.notes) ? raw.notes.map((x: any) => String(x)) : [],
    bgm: String(raw.bgm || "轻快卡点"),
  };
}

/* ─────────── 主入口：三段联动 ─────────── */

export async function runViralEngine(input: ViralEngineInput): Promise<ViralEngineResult> {
  const text = String(input.text || "").trim();
  if (!text) throw new Error("没有对标文案");
  const blueprint = await analyzeBlueprint(text);
  const script = await rewriteFromBlueprint(blueprint, input);
  const storyboard = await buildStoryboard(script, input, script);
  const source: "llm" | "template" = script.length ? "llm" : "template";
  return { blueprint, script, storyboard, source };
}
