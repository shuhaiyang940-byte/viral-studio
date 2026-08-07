import type { OnboardingProfile } from "@/lib/types";
import { CREATOR_STYLES, AUDIENCE_OPTIONS } from "@/lib/types";

export const LEVEL_LABELS: Record<OnboardingProfile["level"], string> = {
  novice: "完全新手",
  beginner: "做过几个视频",
  intermediate: "有一定经验",
};

export interface QuizOption {
  value: string;
  label: string;
  /** 标记为「其他」选项，选中后显示文本输入框 */
  isOther?: boolean;
}

export interface QuizQuestion {
  id: keyof OnboardingProfile;
  title: string;
  help?: string;
  multi: boolean;
  options: QuizOption[];
}

export const QUIZ: QuizQuestion[] = [
  {
    id: "level",
    title: "你的剪辑基础大概是？",
    help: "这决定了我们给你的建议从哪里起步",
    multi: false,
    options: [
      { value: "novice", label: "完全新手，没怎么剪过" },
      { value: "beginner", label: "做过几个视频，还在摸索" },
      { value: "intermediate", label: "有一定经验，想更专业" },
    ],
  },
  {
    id: "tools",
    title: "平时用什么工具剪视频？（可多选）",
    multi: true,
    options: [
      { value: "剪映", label: "剪映（手机/电脑）" },
      { value: "手机自带", label: "手机自带剪辑" },
      { value: "CapCut", label: "CapCut" },
      { value: "Premiere Pro", label: "Premiere Pro" },
      { value: "Final Cut", label: "Final Cut Pro" },
      { value: "DaVinci", label: "达芬奇 DaVinci" },
      { value: "必剪", label: "必剪（B站）" },
      { value: "快影", label: "快影（快手）" },
      { value: "还没用过", label: "还没用过工具" },
    ],
  },
  {
    id: "contentTypes",
    title: "你想做哪类内容？（可多选）",
    help: "选得越具体，后续拆解报告越对口你的赛道",
    multi: true,
    options: [
      { value: "口播", label: "口播 / 知识分享" },
      { value: "探店", label: "探店 / 实地体验" },
      { value: "好物种草", label: "好物种草 / 推荐" },
      { value: "知识科普", label: "知识科普 / 干货" },
      { value: "Vlog", label: "Vlog / 生活记录" },
      { value: "剧情", label: "剧情 / 短剧" },
      { value: "电影解说", label: "影视解说 / 混剪" },
      { value: "颜值才艺", label: "颜值 / 才艺展示" },
      { value: "美食制作", label: "美食 / 做菜教程" },
      { value: "旅行记录", label: "旅行 / 风光" },
      { value: "健身运动", label: "健身 / 运动" },
      { value: "游戏", label: "游戏 / 电竞" },
      { value: "__other__", label: "其他（手填）", isOther: true },
    ],
  },
  {
    id: "platforms",
    title: "主要在哪个平台发？（可多选）",
    help: "不同平台的调性和算法差异很大，我们会针对性调整建议",
    multi: true,
    options: [
      { value: "小红书", label: "📕 小红书" },
      { value: "抖音", label: "🎵 抖音" },
      { value: "视频号", label: "💬 视频号" },
      { value: "B站", label: "📺 B站" },
      { value: "快手", label: "⚡ 快手" },
      { value: "YouTube", label: "▶️ YouTube" },
      { value: "TikTok", label: "🌍 TikTok" },
      { value: "西瓜视频", label: "🍉 西瓜视频" },
      { value: "还没发过", label: "还没发过" },
    ],
  },
  {
    id: "weeklyHours",
    title: "每周能投入多少时间做视频？",
    help: "时间有限的话，我们会优先推荐「投入产出比最高」的改进方向",
    multi: false,
    options: [
      { value: "1小时以内", label: "1 小时以内（碎片时间）" },
      { value: "2-5小时", label: "2-5 小时（业余爱好）" },
      { value: "5-10小时", label: "5-10 小时（认真在做）" },
      { value: "10-20小时", label: "10-20 小时（半职业）" },
      { value: "20小时以上", label: "20 小时以上（全职）" },
    ],
  },
  {
    id: "painPoints",
    title: "你现在最头疼的是？（可多选）",
    help: "选得越准，给的建议越对症。可以多选，我们全都会照顾到。",
    multi: true,
    options: [
      { value: "不知道拍什么", label: "不知道拍什么 / 没选题" },
      { value: "剪出来没人看", label: "剪出来没人看 / 数据差" },
      { value: "不会找爆款", label: "不会找爆款 / 不知道什么火" },
      { value: "不会做特效", label: "不会做特效 / 画面单调" },
      { value: "节奏太拖", label: "节奏太拖 / 完播率低" },
      { value: "不会写文案", label: "不会写文案 / 台词尴尬" },
      { value: "不会配音", label: "不会配音 / 声音不好听" },
      { value: "封面不行", label: "封面 / 标题不吸引人" },
      { value: "设备不够", label: "设备 / 场景受限" },
      { value: "坚持不下来", label: "坚持不下来 / 三分钟热度" },
    ],
  },
  {
    id: "style",
    title: "你希望自己的内容是什么调性？（决定 AI 写稿的文风）",
    help: "选最贴近你人设的，写文案时会自动套用，也能临时改",
    multi: false,
    options: CREATOR_STYLES.map((s) => ({ value: s, label: s })),
  },
  {
    id: "audience",
    title: "你的主要内容受众是谁？",
    help: "不同受众关心的事不同，会影响选题角度与措辞",
    multi: false,
    options: AUDIENCE_OPTIONS.map((a) => ({ value: a, label: a })),
  },
];

export interface AdviceResult {
  levelLabel: string;
  summary: string;
  tips: string[];
}

/** 根据新手档案生成个性化建议（规则驱动，无需 AI） */
export function generateAdvice(profile: OnboardingProfile): AdviceResult {
  const levelLabel = LEVEL_LABELS[profile.level];
  const ct = profile.contentTypes[0];
  const platform = profile.platforms.find((p) => p !== "还没发过");

  const baseSummary: Record<OnboardingProfile["level"], string> = {
    novice: "你刚起步，别整虚的，先把「能发出一条完整视频」跑通，比啥都强。",
    beginner: "你手感有了，下一步就建个「拆—抄—改」的闭环，用套路稳定出片。",
    intermediate: "你底子够，重点在系列化和数据复盘，把单条爆款变成能持续更新的号。",
  };

  const summary =
    `${baseSummary[profile.level]}` +
    (ct ? `你做「${ct}」、` : "") +
    (platform ? `发「${platform}」，` : "") +
    "咱就盯着最影响完播的两件事——特效和节奏——给你拆明白。";

  const tips: string[] = [];

  const levelTips: Record<OnboardingProfile["level"], string[]> = {
    novice: [
      "别追求完美，先用剪映「一键成片」跑出第一条，发出去最重要。",
      "前 3 秒直接甩最抓人的画面或一句话，铺垫越长人掉得越多。",
      "跟着热门 BGM 的鼓点剪，节奏感立马有，不用懂乐理。",
    ],
    beginner: [
      "建个「爆款拆解」收藏夹，每周扒 3 条同品类高赞，照着抄结构。",
      "每条都套「钩子 + 价值 + 互动」三段，素材往里填，别临场发挥。",
      "标题先憋 10 个再挑最好的，别拍完才想文案。",
    ],
    intermediate: [
      "做系列，别条条单打独斗，粉丝才粘得住。",
      "完播掉哪段就重剪哪段，拿数据说话，别凭感觉。",
      "一条内容多平台改着发：小红书重封面、抖音重前 3 秒。",
    ],
  };
  tips.push(...levelTips[profile.level]);

  const painTips: Record<string, string> = {
    不知道拍什么: "从你最熟的日常下手，普通人视角 + 具体细节最稳，别等灵感砸头上。",
    剪出来没人看: "先抄结构再抄内容：把爆款的前 3 秒和结尾互动扒出来，换成你的料。",
    不会找爆款: "案例库按你品类筛，看高赞视频的共同钩子，那就是能抄的爆点公式。",
    不会做特效: "特效别贪多，先把「转场 + 字幕花字 + 关键帧放大」玩顺，够出彩了。",
    节奏太拖: "镜头压到 2-3 秒，5 秒没新东西就剪，删废话比加内容管用。",
    不会写文案: "文案说人话：念给朋友听，哪拗口改哪。",
  };
  for (const p of profile.painPoints) {
    if (painTips[p]) tips.push(painTips[p]);
  }

  return { levelLabel, summary, tips: tips.slice(0, 6) };
}

const KEY = "viralstudio:profile";

export function saveProfile(profile: OnboardingProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(profile));
}

export function getProfile(): OnboardingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
