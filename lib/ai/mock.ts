import type {
  AnalysisReport,
  Category,
  EffectDifficulty,
  EffectItem,
  EmotionCurve,
  EmotionPoint,
  Golden3s,
  OnboardingProfile,
  PacingInfo,
  PremiumInfo,
  ReportSection,
  ReproPlan,
  ScoreBreakdown,
  ScoreTarget,
  VideoMeta,
  ViralFormula,
} from "@/lib/types";
import { REFERENCE_TYPES } from "@/lib/types";
import { detectMismatch } from "@/lib/mismatch";
import { mockReferenceSignal } from "@/lib/reference-signal";

export function randomId(): string {
  return "r-" + Math.random().toString(36).slice(2, 10);
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function avg(nums: number[]): number {
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const PLATFORMS = ["抖音", "小红书", "视频号", "B站"];

const WHY_HOT_POOL = [
  "利用身份共鸣：以真实普通人的视角切入，唤起大量用户的共同记忆。",
  "前 3 秒制造好奇：用一句反常识或悬念直接抓住注意力。",
  "持续提供信息价值：每个段落都有具体细节，信息密度高、不注水。",
  "情绪曲线设计：从平静铺垫到结尾高潮，给用户一个转发的理由。",
  "强互动钩子：结尾抛出一个开放式问题，自然引导评论区讨论。",
  "视觉反差：开头与结尾形成强烈对比，制造记忆点。",
  "节奏紧凑：每 8-12 秒一个信息点，完播率显著高于同类型。",
];

const STRUCTURE_BASE = [
  { time: "0-3 秒", label: "吸引用户" },
  { time: "3-15 秒", label: "建立兴趣" },
  { time: "15-45 秒", label: "内容展开" },
  { time: "45 秒以后", label: "情绪高潮" },
];

const TITLE_TEMPLATES = [
  "如果你也{topic}，请看完这条",
  "关于{topic}，我有些不一样的看法",
  "一条讲透{topic}，建议收藏",
  "普通人做{topic}，到底难在哪",
  "我把{topic}踩的坑都写下来了",
  "别再盲目{topic}了，先看这个",
  "{topic}的真相，可能和你想的不一样",
  "用 1 分钟讲清楚{topic}",
  "为什么高手都在悄悄{topic}",
  "写给正在{topic}的你",
];

const SHOOTING = {
  camera: [
    "开头固定机位给个特写，3 秒内把视觉钩子甩出来。",
    "中段多用第一视角手持跟拍，真实感一下就上来了。",
    "结尾来个空镜慢镜头，情绪留白，别急着切。",
  ],
  copy: [
    "文案说人话、用「我」，别端着说教。",
    "每 15 秒丢一个具体细节（物件 / 人名 / 数字），别空谈。",
    "结尾抛个开放式问题，评论区自然就聊起来了。",
  ],
  music: [
    "前 3 秒用环境音或人声直接开场，别让音乐抢戏。",
    "中段舒缓铺着，情绪曲线别太平。",
    "高潮处切弦乐或人声吟唱，把情绪往上推一把。",
  ],
};

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function topicFromTitle(title: string): string {
  return title.replace(/^(我|一个|今天|昨天|终于|竟然|偷偷)/g, "").slice(0, 12) || "这个选题";
}

/** 把「0分45秒」之类时长解析成秒，失败回退默认 60 */
function parseDurationToSec(d: string): number {
  const m = d.match(/(\d+)\s*分?/);
  const s = d.match(/(\d+)\s*秒/);
  const mins = m ? parseInt(m[1], 10) : 0;
  const secs = s ? parseInt(s[1], 10) : 0;
  return Math.max(20, mins * 60 + secs);
}

const HOOK_TYPES = ["身份共鸣", "反常识", "悬念前置", "痛点前置", "结果前置", "情绪钩子"];

function generateGolden3s(title: string): Golden3s {
  const hookType = pick(HOOK_TYPES, 1)[0];
  const head = title.slice(0, 16) || "这个选题";
  return {
    hookType,
    transcript: `（镜头特写）「${head}……」——前 2 秒直接把冲突甩出来，不铺垫、不自我介绍。`,
    why: "前 3 秒用强反差 / 悬念抓住注意力，用户本能想知道答案，划走成本立刻变高。",
    rebuild: [
      "把钩子提前到 1 秒内，别让 logo / 片头占前 3 秒。",
      "用「一个具体物件」当贯穿线索（门牌 / 钥匙 / 食物），比空泛关键词更抓人。",
      "钩子里先给冲突或悬念、再给答案，留一个「为什么」让用户继续看。",
    ],
  };
}

function generateEmotionCurve(durationSec: number): EmotionCurve {
  const total = durationSec || 60;
  const at = (ratio: number) => Math.round(total * ratio);
  const points: EmotionPoint[] = [
    { tSec: 0, level: 28, label: "开场" },
    { tSec: at(0.12), level: 52, label: "铺垫" },
    { tSec: at(0.32), level: 47, label: "展开" },
    { tSec: at(0.55), level: 68, label: "冲突" },
    { tSec: at(0.82), level: 92, label: "高潮" },
    { tSec: total, level: 76, label: "收尾" },
  ];
  return {
    points,
    note: "整体先平后扬，结尾高潮（升华主题）拉满转发；中段「展开期」有小幅回落，建议插一个具体细节把人拉回，别让情绪空档超过 10 秒。",
  };
}

function generateFormula(): ViralFormula {
  return {
    formula: "身份共鸣 × 具体细节 × 情绪升华",
    factors: [
      { name: "身份共鸣", weight: 35, tip: "用真实普通人的视角切入，唤起集体记忆，降低距离感。" },
      { name: "具体细节", weight: 30, tip: "老物件 / 人名 / 数字，信息密度高不注水，让人信以为真。" },
      { name: "情绪升华", weight: 20, tip: "结尾从个人故事升华到时代 / 群体，给用户一个转发的理由。" },
      { name: "互动钩子", weight: 15, tip: "结尾抛一个开放式问题，自然盘活评论区。" },
    ],
  };
}

interface EffectDef {
  name: string;
  difficulty: EffectDifficulty;
  tip: string;
  tipNovice: string;
}

const EFFECTS_BASE: EffectDef[] = [
  { name: "转场特效", difficulty: "易", tip: "硬切或基础叠化就够，花哨转场纯属喧宾夺主。", tipNovice: "新手就「叠化」+「硬切」两种轮换，别堆特效。" },
  { name: "滤镜调色", difficulty: "中", tip: "整片一个色调（日系 / 胶片都行），质感立马统一。", tipNovice: "剪映「滤镜」挑一个全片套上，别每帧换。" },
  { name: "字幕花字", difficulty: "易", tip: "关键句加花字放大，记忆点一下就出来。", tipNovice: "开自动字幕，重点句加花字，省事又清楚。" },
  { name: "贴纸 / 表情", difficulty: "易", tip: "情绪高点丢一两个贴纸，轻松感就来了。", tipNovice: "就高潮处放 1-2 个，别满屏飞。" },
  { name: "关键帧运镜", difficulty: "中", tip: "关键帧推拉 / 放大，视觉张力一下有了。", tipNovice: "学会「双指放大 + 关键帧」，画面立刻电影感。" },
  { name: "美颜 / 妆容", difficulty: "易", tip: "磨皮瘦脸适度，自然不假面最耐看。", tipNovice: "磨皮开三五十%，别拉满，自然最耐看。" },
  { name: "BGM 卡点", difficulty: "中", tip: "画面切在鼓点上，节奏感立现。", tipNovice: "导入音乐点「自动踩点」，跟着黄点切就完事。" },
  { name: "画中画 / 分屏", difficulty: "难", tip: "对比 / 教程类才用分屏，信息密度更高。", tipNovice: "进阶再搞，先把单画面讲清楚。" },
];

function generateEffects(profile?: OnboardingProfile): EffectItem[] {
  const isNovice = profile?.level === "novice";
  const wantsEffect = profile?.painPoints?.includes("不会做特效");
  return EFFECTS_BASE.map((e) => {
    // 基础转场几乎必有；想学特效时倾向标记更多手法为「已使用」做示范
    const base = e.name === "转场特效" ? 1 : wantsEffect ? 0.8 : 0.65;
    const used = Math.random() < base;
    return {
      name: e.name,
      used,
      difficulty: e.difficulty,
      tip: isNovice ? e.tipNovice : e.tip,
    };
  });
}

function generatePacing(profile?: OnboardingProfile): PacingInfo {
  const drag = profile?.painPoints?.includes("节奏太拖");
  const hookSeconds = pick([1, 2, 3], 1)[0];
  const avgShotSeconds = drag ? rand(2, 3) : rand(3, 6);
  const climaxAtSec = rand(20, 45);
  const beatSync = Math.random() > 0.4;
  const segments = [
    { time: "0-3 秒", label: "钩子", durationSec: 3 },
    { time: "3-15 秒", label: "铺垫", durationSec: 12 },
    { time: "15-45 秒", label: "展开", durationSec: 30 },
    { time: "45 秒后", label: "高潮", durationSec: 15 },
  ];
  const suggestion = drag
    ? "你痛点就是拖，镜头压到 2-3 秒，每 5 秒得有新东西，删废话比加内容管用。"
    : `前 ${hookSeconds} 秒必须甩钩子，中段每 10-15 秒塞一个信息高峰，结尾用情绪或互动收口；参考样本平均镜头 ${avgShotSeconds} 秒，你对着调。`;
  return { hookSeconds, avgShotSeconds, climaxAtSec, beatSync, segments, suggestion };
}

function generatePremium(): PremiumInfo {
  // 小红书 / 抖音精品化路线的必过关卡——点名节奏、音效、色彩，给普通人明确门槛
  return {
    rhythm: [
      "镜头压到 2-4 秒一个，前 3 秒必须抛钩子，没新东西就切，别让画面空着。",
      "关键转折点卡 BGM 鼓点，卡上了节奏感直接拉满——这是精品和业余的分水岭。",
      "黄金 15 秒信息密度要够，一句废话都嫌多，宁删勿凑。",
    ],
    audio: [
      "转场别干切，加个 whoosh『嗖』音效，瞬间高级感就来了。",
      "重点句配强调音（叮 / 咚），记忆点一下就出来。",
      "人声和 BGM 分层，人声永远压过音乐，别让背景盖了你的台词。",
    ],
    color: [
      "整片一个滤镜色调统一，别东一块冷西一块暖，杂乱 = 廉价。",
      "高光压一点、阴影提一点，立刻有电影质感。",
      "同赛道爆款什么色调你就跟什么，前期别自创风格。",
    ],
  };
}

function generateRepro(profile?: OnboardingProfile): ReproPlan {
  const level = profile?.level ?? "novice";
  const wantsEffect = profile?.painPoints?.includes("不会做特效");
  const drag = profile?.painPoints?.includes("节奏太拖");

  const path: ReproPlan["path"] =
    level === "intermediate" ? "照抄" : level === "beginner" ? "需补素材" : "套模板";

  const adviceByPath: Record<ReproPlan["path"], string> = {
    照抄: "你基础够，可以直接照着这条参考逐镜复刻：分镜、节奏、转场一一对齐，先做到『像』再求『变』。",
    套模板:
      "新手别硬凹原创，先用『可复制模板』把骨架搭起来——固定结构 + 固定节奏，把内容填进去就能发，先跑通一条再说。",
    需补素材:
      "你卡在素材和手法上，别急着拍新东西，先把缺的素材包和音效音乐备齐，再照模板组装，事半功倍。",
  };

  let advice = adviceByPath[path];
  if (drag) advice += "你痛点就是节奏拖，所有镜头先压到 3 秒内，这是第一要务。";
  if (wantsEffect)
    advice += "特效这块你薄弱，先用剪映自动功能（踩点、自动字幕、滤镜）顶上，别手写关键帧。";

  const shots = [
    "开场特写 / 钩子镜头 1 条（3 秒内抓住人）",
    "主体过程 / 核心内容镜头 3-5 条（每段有新信息）",
    "情绪高潮 / 收尾空镜 1-2 条（留白，别急着切）",
  ];
  const sfx = wantsEffect
    ? ["转场 whoosh 音效", "重点强调音（叮 / 咚）", "点赞 / 收藏提示音", "开头环境音"]
    : ["转场 whoosh 音效", "重点强调音（叮 / 咚）"];
  const music = [
    "前 3 秒：轻环境音或人声开场，别让音乐抢戏",
    "中段：舒缓铺底 BGM，情绪别太平",
    "高潮：切弦乐 / 人声吟唱推情绪",
    "全程：卡点剪切，跟鼓点走",
  ];

  return { path, advice, shots, sfx, music };
}

function generateScoreTarget(score: ScoreBreakdown): ScoreTarget {
  // 网站的核心目的：帮普通人把不及格→70、及格→80。按当前分定档位与目标。
  const overall = score.overall;
  const target = overall < 70 ? 70 : overall < 80 ? 80 : 85;
  const band =
    overall < 70
      ? "不及格 → 及格线 70"
      : overall < 80
        ? "及格 → 良好 80"
        : "良好 → 优秀 85+";

  const DIM_LABELS: Record<string, string> = {
    hook: "开头吸引力",
    value: "内容价值",
    emotion: "情绪感染",
    interaction: "互动能力",
  };
  const TARGET_TIPS: Record<string, string> = {
    hook: "前 3 秒再加一个反常识钩子，把人先留住——完播率的根在这。",
    value: "每 15 秒塞一个具体细节（物件 / 数字 / 人名），信息密度还不够。",
    emotion: "结尾加一句情绪升华，给用户一个转发的理由。",
    interaction: "结尾抛个开放式问题，把评论区盘活，互动分能拉一截。",
  };

  const gaps = (["hook", "value", "emotion", "interaction"] as const)
    .filter((k) => score[k] < target)
    .map((k) => ({ dimension: DIM_LABELS[k], tip: TARGET_TIPS[k] }));

  const advice =
    overall < 70
      ? "你这条目前还在及格线以下。先把下面几个短板补到 70 分这条线——重点砸开头钩子和信息密度，别急着玩花活，先把『像样』做出来。"
      : overall < 80
        ? "你已经在及格线之上了。想冲 80『良好』，把情绪和互动这两块拉满，精品感就出来了——参考下方『精品化门槛』逐个过。"
        : "你已经良好以上。维持稳定输出，往 85+ 精品线靠：节奏、音效、色彩的门槛（见下方精品化门槛）就是你的下一关。";

  return { current: overall, target, band, gaps, advice };
}

export function generateMockReport(input: {
  source?: string;
  title?: string;
  profile?: OnboardingProfile;
  refType?: string;
}): AnalysisReport {
  const userTitle =
    input.title?.trim() || "普通人的一天，藏着不被看见的努力";
  const topic = topicFromTitle(userTitle);

  const score: ScoreBreakdown = {
    hook: rand(82, 94),
    value: rand(80, 92),
    emotion: rand(81, 93),
    interaction: rand(78, 90),
    overall: 0,
  };
  score.overall = avg([score.hook, score.value, score.emotion, score.interaction]);

  const section: ReportSection = {
    whyHot: pick(WHY_HOT_POOL, 4),
    structure: STRUCTURE_BASE.map((s, i) => ({
      ...s,
      detail: [
        "开门见山抛出冲突或悬念，用强钩子抓住注意力。",
        "建立真实感与代入感，让用户愿意继续看。",
        "穿插具体细节与方法论，保持高信息密度。",
        "回到个人情感并升华主题，引导点赞、评论与转发。",
      ][i],
    })),
    replicableTemplate: {
      original: userTitle,
      template: `用「一个具体场景 + 我的真实经历 + 一句升华」的结构替换主题即可复制，核心是把${topic}拍成「有情绪的纪实」。`,
    },
    titles: TITLE_TEMPLATES.map((t) => t.replace("{topic}", topic)),
    shootingTips: SHOOTING,
  };

  const meta: VideoMeta = {
    title: userTitle,
    type: input.refType?.trim() || REFERENCE_TYPES[rand(0, REFERENCE_TYPES.length - 1)],
    publishedAt: new Date().toISOString().slice(0, 10),
    duration: `0分${rand(35, 90)}秒`,
    platform: PLATFORMS[rand(0, PLATFORMS.length - 1)],
    views: rand(80, 520) * 10000,
  };
  const durationSec = parseDurationToSec(meta.duration);

  return {
    id: randomId(),
    meta,
    score,
    section,
    golden3s: generateGolden3s(userTitle),
    emotionCurve: generateEmotionCurve(durationSec),
    formula: generateFormula(),
    effects: generateEffects(input.profile),
    pacing: generatePacing(input.profile),
    profile: input.profile,
    mismatch: detectMismatch(input.profile, meta),
    premium: generatePremium(),
    repro: generateRepro(input.profile),
    signal: mockReferenceSignal(input.source, meta.type),
    scoreTarget: generateScoreTarget(score),
    createdAt: new Date().toISOString(),
  };
}

/** 给真实模型使用的提示词：要求返回结构化 JSON */
export function buildPrompt(input: { source?: string; title?: string }): string {
  const title = input.title?.trim() || "（未提供标题，请根据内容推断）";
  return `请分析以下短视频并生成「爆款拆解报告」。
视频来源：${input.source || "（用户上传的视频文件）"}
视频标题：${title}

请严格只返回一个 JSON 对象，结构如下（不要包含任何解释文字）：
{
  "meta": { "title": string, "type": string, "publishedAt": string, "duration": string, "platform": string, "views": number },
  "score": { "overall": number, "hook": number, "value": number, "emotion": number, "interaction": number },
  "section": {
    "whyHot": string[4],
    "structure": [ { "time": string, "label": string, "detail": string } ],
    "replicableTemplate": { "original": string, "template": string },
    "titles": string[10]（10 个可直接使用的完整爆款标题，禁止含 {topic} 等占位符/模板变量，禁止直接套用原视频标题，每条 6-40 字、彼此不重复）,
    "shootingTips": { "camera": string[3], "copy": string[3], "music": string[3] }
  },
  "golden3s": {
    "hookType": string（如「身份共鸣」「反常识」「悬念前置」之一）,
    "transcript": string（前 3 秒台词 / 画面脚本，脚本式、可照抄，30 字内）,
    "why": string（为什么这 3 秒能留人，40 字内）,
    "rebuild": string[3]（给普通人的可落地改造建议，每条 20-40 字）
  },
  "emotionCurve": {
    "points": [ { "tSec": number, "level": number(0-100), "label": string } ]（6 个时间点，覆盖 0 秒到视频结尾，level 随情绪起伏）,
    "note": string（整体情绪走向说明：哪段回落、哪段峰值、为什么，40-80 字）
  },
  "formula": {
    "formula": string（一句话公式，如「身份共鸣 × 具体细节 × 情绪升华」）,
    "factors": [ { "name": string, "weight": number(0-100 整数且四项之和=100), "tip": string } ]（4 个因子，weight 为权重）
  },
  "effects": [ { "name": string, "used": boolean, "difficulty": "易"|"中"|"难", "tip": string } ],
  "pacing": {
    "hookSeconds": number,
    "avgShotSeconds": number,
    "climaxAtSec": number,
    "beatSync": boolean,
    "segments": [ { "time": string, "label": string, "durationSec": number } ],
    "suggestion": string
  }
}
评分均为 0-100 的整数，overall 为其余四项的平均值（四舍五入）。golden3s / emotionCurve / formula 为《爆款导演拆解报告》的核心三段（黄金3秒 / 情绪曲线 / 爆款公式提炼）。`;
}
