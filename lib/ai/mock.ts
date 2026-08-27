import type {
  AdaptedPlan,
  AdaptedShot,
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
  ShotBlueprint,
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

/* ════════ 手把手分镜：逐镜头拆解 + 换成你的主题怎么拍 ════════ */

interface ShotTemplate {
  phase: string;
  scene: string;
  visual: string;
  line: string;
  camera: string;
  sfx: string;
  why: string;
  difficulty: "易" | "中" | "难";
}

const SHOT_BLUEPRINTS: Record<string, ShotTemplate[]> = {
  "生活记录 / 情感向": [
    { phase: "钩子", scene: "熟悉的生活场景 · 日外/日内", visual: "一个具体物件特写（门牌 / 钥匙 / 旧照片）", line: "「我在 XX 住了十年，今天终于要离开了。」", camera: "固定机位特写，画面干净", sfx: "环境音开场，不加音乐", why: "前 3 秒用「具体物件 + 强冲突」制造悬念，让人本能想往下看", difficulty: "易" },
    { phase: "铺垫", scene: "老地方全景", visual: "第一视角环顾熟悉的环境，交代「这是哪里」", line: "「这里的一砖一瓦，都记得我。」", camera: "手持缓慢扫过，带真实晃动感", sfx: "环境音延续", why: "建立真实感与代入感，让观众觉得「这就是我生活的地方」", difficulty: "易" },
    { phase: "展开①", scene: "生活细节场景", visual: "三个具体细节依次出现（老物件 / 邻居 / 味道）", line: "「楼下大爷还记得我爱吃的早点。」", camera: "每个细节一个 2-3 秒特写，硬切", sfx: "轻钢琴铺底", why: "具体细节 = 信息密度，观众信以为真，情绪开始积累", difficulty: "中" },
    { phase: "展开②", scene: "变化中的场景", visual: "对比画面：旧样子 vs 现在的变化", line: "「可是这里，真的要拆了。」", camera: "前后对比各一个镜头，中间加叠化转场", sfx: "音乐音量微升", why: "对比制造冲突感，把「个人故事」推向「时代变化」", difficulty: "中" },
    { phase: "高潮", scene: "情绪最高点场景", visual: "主角背影 / 空镜，配合最强的一句台词", line: "「舍不得的不是房子，是这三十年。」", camera: "慢镜头 + 缓慢推近", sfx: "弦乐 / 人声吟唱推情绪", why: "情绪峰值点：给用户一个共鸣和转发的理由", difficulty: "中" },
    { phase: "收尾", scene: "结束场景", visual: "一个留白空镜，画面缓缓变暗", line: "「你会不会也想起，某个回不去的地方？」", camera: "固定机位，留 2 秒黑场", sfx: "音乐渐弱，环境音收尾", why: "开放式提问引导评论区，留白让情绪发酵", difficulty: "易" },
  ],
  "知识科普": [
    { phase: "钩子", scene: "书房 / 白板前 · 室内", visual: "反常识结论直接砸出来（大字幕 + 特写）", line: "「99% 的人都理解错了这件事。」", camera: "固定机位中景 + 花字放大", sfx: "强调音（叮）", why: "反常识开场制造认知缺口，让人必须听下去", difficulty: "易" },
    { phase: "铺垫", scene: "讲解场景", visual: "提出一个大家都会犯的错误 / 误区", line: "「你是不是也这么做过？」", camera: "中景，手指比划引导视线", sfx: "轻快 BGM", why: "用「你也有过」建立连接，降低理解门槛", difficulty: "易" },
    { phase: "展开①", scene: "讲解场景", visual: "第一层原理：用比喻讲清楚底层逻辑", line: "「它其实就像……一样简单。」", camera: "特写 + 关键帧放大关键词", sfx: "卡点音效", why: "比喻降低理解成本，观众觉得「学到了」", difficulty: "中" },
    { phase: "展开②", scene: "讲解场景", visual: "第二层：一个具体案例 / 数字验证", line: "「我举个例子，你马上明白。」", camera: "画面分屏：左边原理右边案例", sfx: "强调音", why: "案例 + 数字让结论可信，收藏欲上升", difficulty: "中" },
    { phase: "高潮", scene: "讲解场景", visual: "把前面所有点串成一张图 / 一条结论", line: "「所以记住一句话就够了。」", camera: "固定机位，手写板 / 屏幕录屏", sfx: "音乐到峰值", why: "收束成一句话，方便观众截图收藏", difficulty: "中" },
    { phase: "收尾", scene: "结束场景", visual: "抛一个延伸问题 + 下期预告", line: "「评论区告诉我你的看法，下期讲透它的兄弟概念。」", camera: "固定机位收尾", sfx: "片尾音效", why: "互动钩子 + 追更钩子，把单条流量导向账号", difficulty: "易" },
  ],
  "好物种草": [
    { phase: "钩子", scene: "产品使用场景 · 室内", visual: "痛点特写：产品解决前的问题画面", line: "「用了三个月，我才敢推荐它。」", camera: "固定机位特写", sfx: "环境音", why: "「用了三个月」降低广告感，「才敢推荐」制造信任钩子", difficulty: "易" },
    { phase: "铺垫", scene: "产品展示", visual: "产品全貌 + 价格 / 品牌信息", line: "「先说结论：它确实值得。」", camera: "360° 展示，转桌或手持环绕", sfx: "轻快 BGM", why: "开头给结论，符合种草类「先给答案再给理由」", difficulty: "易" },
    { phase: "展开①", scene: "使用过程", visual: "真实使用过程：开箱 / 上手 / 第一感受", line: "「第一感受是：比想象中轻。」", camera: "第一视角手持跟拍", sfx: "生活音效增强真实感", why: "过程真实感 = 种草可信度，比口播强十倍", difficulty: "中" },
    { phase: "展开②", scene: "对比场景", visual: "对比：和同类产品 / 使用前后的差别", line: "「和旧款放一起，差距一眼就看出来了。」", camera: "同机位左右对比", sfx: "强调音", why: "对比让「值不值」一目了然，减少决策成本", difficulty: "中" },
    { phase: "高潮", scene: "效果展示", visual: "最强使用效果 / 惊喜时刻", line: "「用完之后我只想说：值了。」", camera: "慢镜头 + 特写效果", sfx: "音乐峰值 + 哇音效", why: "效果峰值让观众产生「我也想要」的冲动", difficulty: "中" },
    { phase: "收尾", scene: "结束场景", visual: "价格信息 + 购买建议 + 互动问题", line: "「这个价位闭眼入，你还有什么想让我测的？」", camera: "固定机位收尾", sfx: "片尾音效", why: "明确行动号召 + 互动钩子，转化和评论一起抓", difficulty: "易" },
  ],
  "剧情短片": [
    { phase: "钩子", scene: "冲突发生地 · 室内/街头", visual: "冲突画面直接开场：争吵 / 摔倒 / 悬念动作", line: "「你再说一遍？」", camera: "手持近景，画面轻微晃动制造紧张", sfx: "紧张氛围音", why: "剧情类 3 秒必须有冲突或悬念，否则划走", difficulty: "中" },
    { phase: "铺垫", scene: "人物关系场景", visual: "交代人物关系与背景，节奏放缓", line: "「我们认识三年了，今天是第一次吵架。」", camera: "双人正反打", sfx: "环境音", why: "让观众先「站队」，后面反转才有冲击力", difficulty: "中" },
    { phase: "展开①", scene: "事件发展", visual: "误会 / 铺垫逐层展开，埋反转伏笔", line: "「其实那天，我看到的是……」", camera: "特写表情变化", sfx: "音乐渐起", why: "伏笔 + 信息差是反转的前提", difficulty: "中" },
    { phase: "展开②", scene: "转折点", visual: "关键道具 / 真相线索出现", line: "「直到我打开那个抽屉。」", camera: "道具特写 + 快切", sfx: "心跳 / 咚音效", why: "转折点制造「原来如此」，是完播率的核心", difficulty: "难" },
    { phase: "高潮", scene: "真相揭晓", visual: "反转揭晓：表情 / 台词 / 画面三者同步", line: "「对不起，是我错怪你了。」", camera: "慢镜头 + 推近面部", sfx: "音乐峰值", why: "反转 + 情绪爆发点，触发点赞和转发", difficulty: "难" },
    { phase: "收尾", scene: "结局场景", visual: "结局定格 + 悬念钩子（续集预告）", line: "「如果时间重来，我还会做同样的选择。」", camera: "固定机位定格", sfx: "音乐渐弱", why: "开放式结局 + 讨论钩子，评论区自然炸开", difficulty: "易" },
  ],
  "测评对比": [
    { phase: "钩子", scene: "测评台 · 室内", visual: "冲突结论开场：直接说谁赢谁输", line: "「测完这三款，我只推荐一个。」", camera: "固定机位 + 三产品同框", sfx: "强调音", why: "「只推荐一个」制造好奇 + 立场，观众想验证", difficulty: "易" },
    { phase: "铺垫", scene: "测评台", visual: "参测产品集体亮相 + 测评维度说明", line: "「从五个维度，全部实测。」", camera: "全景展示", sfx: "轻快 BGM", why: "先给框架，让观众知道测评「公平」", difficulty: "易" },
    { phase: "展开①", scene: "单项测试", visual: "第一项测试：画面 / 声音 / 手感逐项来", line: "「第一项，画质对比——注意看暗部。」", camera: "同机位 A/B 切换，画面尽量一致", sfx: "测试音效", why: "同机位对比才有说服力，观众自己就能看出差别", difficulty: "中" },
    { phase: "展开②", scene: "专项测试", visual: "第二项测试：极限场景（暗光 / 防抖 / 续航）", line: "「这个场景，只有它能扛住。」", camera: "特写 + 慢镜头", sfx: "强调音", why: "极限场景拉高「专业感」，是测评的信任分水岭", difficulty: "中" },
    { phase: "高潮", scene: "总结台", visual: "打分汇总：五维雷达 / 得分表", line: "「综合下来，第一名是它，没有悬念。」", camera: "固定机位 + 大字幕", sfx: "音乐峰值", why: "结论明确 = 收藏理由，观众拿去当选购依据", difficulty: "中" },
    { phase: "收尾", scene: "结束场景", visual: "购买建议 + 人群匹配建议", line: "「预算有限选它，要极致选它。评论区告诉我你选哪个。」", camera: "固定机位收尾", sfx: "片尾音效", why: "按人群给建议，评论区互动 + 收藏双拉满", difficulty: "易" },
  ],
};

const DEFAULT_BLUEPRINT = SHOT_BLUEPRINTS["生活记录 / 情感向"];

function generateShotBlueprint(refType: string | undefined, title: string): ShotBlueprint[] {
  const tpls = SHOT_BLUEPRINTS[refType || "生活记录 / 情感向"] || DEFAULT_BLUEPRINT;
  const head = title.slice(0, 16) || "这个选题";
  return tpls.map((t, i) => ({
    index: i + 1,
    time: ["0-3 秒", "3-10 秒", "10-25 秒", "25-40 秒", "40-55 秒", "55 秒以后"][i],
    phase: t.phase,
    scene: t.scene,
    visual: t.visual,
    line: t.line.includes("XX") ? t.line.replace("XX", head) : t.line,
    camera: t.camera,
    sfx: t.sfx,
    why: t.why,
    difficulty: t.difficulty,
  }));
}

/** 每个段落的「换成你的主题」改造句式 */
const ADAPT_PHASE_POOL: Record<string, { version: (topic: string) => string; steps: string[] }> = {
  钩子: {
    version: (t) => `换成「${t}」：找你的场景里最有冲突的一个瞬间，做成 3 秒特写开场。`,
    steps: ["选一个具体物件当钩子（产品 / 招牌 / 道具），别用空泛开头。", "第一句台词先给冲突或悬念，再给答案。", "固定机位拍 3 秒特写，画面只放一件事。"],
  },
  铺垫: {
    version: (t) => `换成「${t}」：用第一视角带观众进入你的场景，交代「这是哪、我是谁」。`,
    steps: ["手持手机缓慢扫过场景，带一点真实晃动。", "补一句身份信息：你是谁、为什么在这里。", "环境音录进去，别急着上音乐。"],
  },
  "展开①": {
    version: (t) => `换成「${t}」：准备 3 个具体细节（物件 / 数字 / 过程），每 10 秒丢一个。`,
    steps: ["列出和主题相关的 3 个细节，按「惊喜感」排序。", "每个细节单独拍一个 2-3 秒特写。", "硬切就行，别加花哨转场。"],
  },
  "展开②": {
    version: (t) => `换成「${t}」：放一个对比或转折，让内容产生「变化感」。`,
    steps: ["找一个前后对比（旧 vs 新 / 用前 vs 用后 / 误解 vs 真相）。", "同机位各拍一条，剪辑时叠化切换。", "转折处音乐音量微微升一点。"],
  },
  高潮: {
    version: (t) => `换成「${t}」：把你最想表达的一句话放在这里，情绪推到最高。`,
    steps: ["把全片核心观点浓缩成一句话。", "这句话单独拍一条特写 / 空镜。", "剪辑时加慢动作或缓慢推近，配合音乐峰值。"],
  },
  收尾: {
    version: (t) => `换成「${t}」：留一个开放式提问收尾，引导评论。`,
    steps: ["问一个和主题相关、观众想回答的问题。", "结尾留 1-2 秒空镜 / 黑场，别急着切。", "把提问做成字幕花字，放大记忆点。"],
  },
};

function generateAdaptedPlan(
  profile: OnboardingProfile | undefined,
  refType: string | undefined,
  shots: ShotBlueprint[]
): AdaptedPlan {
  const userTopic =
    profile?.contentTypes[0]?.replace(/ /g, "") ||
    profile?.audience ||
    "你的主题";
  const adapted: AdaptedShot[] = shots.map((s) => {
    const pool = ADAPT_PHASE_POOL[s.phase] || ADAPT_PHASE_POOL["展开①"];
    return {
      index: s.index,
      phase: s.phase,
      reference: s.visual + "｜" + s.line,
      yourVersion: pool.version(userTopic),
      howToFilm: pool.steps.slice(),
      difficulty: s.difficulty,
    };
  });
  const note =
    profile?.level === "novice"
      ? "你是新手，先把「钩子 → 收尾」这 6 个镜头照抄下来拍，别追求原创；每个镜头按步骤执行，先跑通一条 60 秒的视频再说。"
      : "这 6 个镜头是参考视频的骨架。你不需要逐帧复刻，按「你的版本」替换内容，保留节奏和运镜，就能做出结构相似但属于你的视频。";
  return { userTopic, note, shots: adapted };
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
  const storyboard = generateShotBlueprint(meta.type, userTitle);

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
    storyboard,
    adaptedPlan: generateAdaptedPlan(input.profile, meta.type, storyboard),
    createdAt: new Date().toISOString(),
  };
}

/** 给真实模型使用的提示词：要求返回结构化 JSON */
export function buildPrompt(input: {
  source?: string;
  title?: string;
  profile?: OnboardingProfile;
  refType?: string;
  visualSummary?: string;
  transcript?: string;
  timelineText?: string;
}): string {
  const title = input.title?.trim() || "（未提供标题，请根据内容推断）";
  const userTopic =
    input.profile?.contentTypes?.slice(0, 2).join("、") ||
    input.profile?.audience ||
    "用户未填写主题";
  const refType = input.refType?.trim() || "（未指定，请按视频内容判断）";
  const visual = input.visualSummary?.trim();
  const transcript = input.transcript?.trim();
  const timelineText = input.timelineText?.trim();
  return `请分析以下短视频并生成「爆款拆解报告」。
视频来源：${input.source || "（用户上传的视频文件）"}
视频标题：${title}
参考视频类型：${refType}
用户想做的内容方向：${userTopic}
${
  visual
    ? `真实画面理解（由视觉模型逐帧提取，是你判断「画面」的唯一依据，务必结合它分析镜头、运镜、视觉节奏）：
${visual}`
    : "（本次没有画面理解数据：画面相关分析请基于类型与常识合理推断，并诚实标注不确定性）"
}
${
  transcript
    ? `真实语音转写（由 Qwen-Audio 提取，是你判断「文案/台词/口播」的唯一依据，务必引用其中的关键台词）：
${transcript}`
    : "（本次没有语音转写数据：文案相关分析请基于类型与常识合理推断）"
}
${
  timelineText
    ? `${timelineText}`
    : "（没有可用的时间轴事实层：请勿臆造具体时间段的具体内容）"
}

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
  },
  "storyboard": [ { "index": number, "time": string, "phase": "钩子"|"铺垫"|"展开"|"高潮"|"收尾", "scene": string, "visual": string, "line": string, "camera": string, "sfx": string, "why": string, "difficulty": "易"|"中"|"难" } ]（6-8 个镜头：把这条视频拆成一镜一镜怎么拍，line 为可直接照念的台词，why 说明这一镜的目的）,
  "adaptedPlan": {
    "userTopic": string（用户想做的内容方向）,
    "note": string（整体改造说明，40-80 字）,
    "shots": [ { "index": number, "phase": string, "reference": string, "yourVersion": string（换成用户主题后这一镜拍什么）, "howToFilm": string[2-3]（手把手步骤：具体到机位/动作/文案）, "difficulty": "易"|"中"|"难" } ]
  }
}
评分均为 0-100 的整数，overall 为其余四项的平均值（四舍五入）。golden3s / emotionCurve / formula 为《爆款导演拆解报告》的核心三段（黄金3秒 / 情绪曲线 / 爆款公式提炼）。`;
}
