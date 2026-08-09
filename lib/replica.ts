import type { Category, FormulaTemplate, ReplicaResult, ReplicaShot } from "@/lib/types";
import { FORMULA_LIBRARY } from "@/lib/formula-library";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 各赛道默认主题词（用户没填时使用，保证免费档也能一键出东西） */
const DEFAULT_TOPIC: Record<Category, string> = {
  生活: "普通人的一天",
  旅游: "一个冷门目的地",
  美食: "一道家常菜",
  情感: "一个被忽略的瞬间",
  知识: "一个常见误区",
  商业: "一个实用方法论",
};

const PLATFORM_TIPS: Record<string, string> = {
  抖音: "抖音重前 3 秒，钩子要狠，节奏要快。",
  小红书: "小红书重封面与标题，开头就要给价值感。",
  视频号: "视频号重社交转发，结尾升华更容易被分享。",
  B站: "B站重干货密度，信息量要足。",
  快手: "快手重真实接地气，别端着。",
  YouTube: "YouTube 重留存，前 30 秒决定推荐。",
  TikTok: "TikTok 重节奏与 trend，卡点要准。",
};

const TITLE_TEMPLATES = [
  "如果你也{t}了，请看完这条",
  "关于{t}，我有些不一样的看法",
  "一条讲透{t}，建议收藏",
  "普通人做{t}，到底难在哪",
  "别再盲目{t}了，先看这个",
  "{t}的真相，可能和你想的不一样",
  "写给正在{t}的你",
  "为什么高手都在悄悄{t}",
];

export interface ReplicaInput {
  category: Category;
  platform?: string;
  style?: string;
  topic?: string;
  /** 是否付费档（决定输出量：精简 vs 全量） */
  isPro?: boolean;
}

/**
 * 爆款复刻助手：按赛道选公式库公式 → 生成钩子 / 标题 / 分镜 / 复刻路径。
 * 默认 Mock（无需 API Key）。真实模型接入可仿照 lib/ai/providers 的 analyzeWithProvider，
 * 在此追加 replicateWithProvider（构造 prompt + 解析），由 API 层按 AI_PROVIDER 切换并回退 Mock。
 */
export function generateReplica(input: ReplicaInput): ReplicaResult {
  const formula =
    pick(FORMULA_LIBRARY.filter((f) => f.category === input.category)) ?? FORMULA_LIBRARY[0];
  const topic = input.topic?.trim() || DEFAULT_TOPIC[input.category] || "这个选题";
  const isPro = !!input.isPro;

  const titleCount = isPro ? 5 : 1;
  const shotCount = isPro ? 6 : 3;

  return {
    basedOnFormula: formula,
    hook: buildHook(formula, topic),
    title: buildTitles(formula, topic, titleCount)[0],
    titles: buildTitles(formula, topic, titleCount),
    shots: buildShots(formula, topic, shotCount),
    copyPath: formula.copyPath,
    tips: buildTips(input.platform, input.style, isPro),
  };
}

function buildHook(f: FormulaTemplate, topic: string): string {
  const map: Record<string, string> = {
    身份共鸣: `（镜头特写）「说真的，${topic}这件事，我猜你也有同感……」——前 2 秒用身份共鸣把人留住。`,
    反常识: `（直球开场）「关于${topic}，你可能一直都搞错了。」——前 2 秒用反常识制造认知冲突。`,
    悬念前置: `（画面定格）「你绝对想不到，${topic}背后藏着这个。」——前 2 秒抛悬念。`,
    痛点前置: `（皱眉特写）「你是不是也卡在${topic}这一步？」——前 2 秒戳痛点。`,
    结果前置: `（甩结果）「靠${topic}，我做到了之前不敢想的事。」——前 2 秒亮结果。`,
    情绪钩子: `（情绪特写）「那天${topic}，我差点没绷住。」——前 2 秒用情绪勾人。`,
  };
  return map[f.hookType] ?? `（开场）「今天聊${topic}。」`;
}

function buildTitles(f: FormulaTemplate, topic: string, count: number): string[] {
  const lead = f.factors[0]?.name ?? "";
  return TITLE_TEMPLATES.map((t, i) => {
    const replaced = t.replace(/\{t\}/g, topic);
    // 第 1 条用主因子包一层钩子感，其余保持干净
    return i === 0 && lead ? `${lead}视角｜${replaced}` : replaced;
  }).slice(0, count);
}

function buildShots(f: FormulaTemplate, topic: string, count: number): ReplicaShot[] {
  const factors = f.factors;
  const full: Omit<ReplicaShot, "index">[] = [
    {
      phase: "钩子",
      visual: `特写开场，直接点题「${topic}」`,
      line: f.hookType === "身份共鸣" ? `说真的，${topic}，我猜你也有同感。` : `关于${topic}，先说结论。`,
      durationSec: 3,
      sfx: "环境音直接起，别用音乐抢戏",
    },
    {
      phase: "铺垫",
      visual: "中景建立场景 / 人物",
      line: "先交代背景，让大家知道这事跟自己有关。",
      durationSec: 8,
      sfx: "轻铺底 BGM",
    },
    {
      phase: "展开",
      visual: `展示「${factors[1]?.name ?? "核心内容"}」的具体细节`,
      line: `重点来了：${factors[1]?.tip ?? "给具体可操作的内容"}`,
      durationSec: 12,
      sfx: "关键信息处加强调音",
    },
    {
      phase: "展开",
      visual: "第二个支撑点 / 案例",
      line: "再补一个例子，信息密度拉满。",
      durationSec: 12,
      sfx: "卡点切",
    },
    {
      phase: "高潮",
      visual: `情绪 / 结果最高点（${factors[0]?.name ?? "升华"}）`,
      line: `${factors[0]?.tip ?? "把情绪推上去"}`,
      durationSec: 10,
      sfx: "高潮处切弦乐 / 人声",
    },
    {
      phase: "收尾",
      visual: "空镜 / 人物反应，留白",
      line: `结尾抛个问题：${factors[3]?.name ?? "互动"}——你呢？`,
      durationSec: 5,
      sfx: "收尾留白，淡出",
    },
  ];
  // free：钩子 + 第一个展开 + 收尾 = 3 镜（精简）；pro：完整 6 镜
  const chosen = count >= 6 ? full : [full[0], full[2], full[5]];
  return chosen.map((s, i) => ({ index: i + 1, ...s }));
}

function buildTips(platform?: string, style?: string, isPro?: boolean): string[] {
  const tips: string[] = [];
  if (platform && PLATFORM_TIPS[platform]) tips.push(PLATFORM_TIPS[platform]);
  if (style) tips.push(`全程保持「${style}」口吻，文案念给朋友听不拗口就行。`);
  tips.push("镜头压到 2-4 秒一个，前 3 秒必须抛钩子，没新东西就切。");
  if (!isPro) tips.push("升级进阶版可一次生成 5 个标题 + 完整 6 镜分镜。");
  return tips.slice(0, 4);
}
