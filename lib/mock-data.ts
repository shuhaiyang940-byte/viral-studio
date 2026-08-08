import type { AnalysisReport, Category, LibraryItem } from "@/lib/types";

export const CATEGORIES: Category[] = ["生活", "旅游", "美食", "情感", "知识", "商业"];

const GRADIENTS = [
  "linear-gradient(135deg,#7c3aed,#2563eb)",
  "linear-gradient(135deg,#f97316,#ef4444)",
  "linear-gradient(135deg,#10b981,#0ea5e9)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
  "linear-gradient(135deg,#f59e0b,#d946ef)",
  "linear-gradient(135deg,#14b8a6,#3b82f6)",
  "linear-gradient(135deg,#ef4444,#7c3aed)",
];

export function gradientFor(index: number): string {
  return GRADIENTS[index % GRADIENTS.length];
}

export const SAMPLE_REPORT: AnalysisReport = {
  id: "sample-001",
  meta: {
    title: "我在北京胡同住了三十年，今天终于要搬走了",
    type: "生活记录 / 情感向",
    publishedAt: "2026-03-18",
    duration: "1分12秒",
    platform: "抖音",
    views: 3860000,
  },
  score: {
    overall: 87,
    hook: 90,
    value: 85,
    emotion: 88,
    interaction: 82,
  },
  section: {
    whyHot: [
      "利用身份共鸣：三十年胡同住户的真实视角，唤起大量城市变迁的共同记忆。",
      "前 3 秒制造好奇：以「终于要搬走」制造悬念与情绪钩子，用户立刻想知道原因。",
      "持续提供信息价值：每个段落都有具体细节（老物件、邻居、味道），信息密度高。",
      "结尾情绪高潮：从个人故事升华到「时代里的普通人」，引发转发与评论。",
    ],
    structure: [
      { time: "0-3 秒", label: "吸引用户", detail: "开门见山抛出冲突：「住了三十年，今天要搬走」，用悬念抓住注意力。" },
      { time: "3-15 秒", label: "建立兴趣", detail: "展示胡同环境与第一人称视角，建立真实感与代入感。" },
      { time: "15-45 秒", label: "内容展开", detail: "穿插老物件、邻里故事、城市变化的具体细节，信息密度高。" },
      { time: "45 秒以后", label: "情绪高潮", detail: "回到个人情感，升华主题，引导点赞、评论与转发。" },
    ],
    replicableTemplate: {
      original: "北京老房子故事：三十年胡同生活",
      template: "我的城市十年变化：用「一个即将消失的地方 + 我的真实记忆」结构，替换城市与物件即可复制。",
    },
    titles: [
      "我在XX住了十年，今天才发现它要消失了",
      "一个普通人的十年，藏着一座城市的变迁",
      "舍不得拆的，不只是房子",
      "如果你也在这座城市漂过，请看完",
      "搬走那天，我拍下了最后的XX",
      "十年前我来到这里，今天我要离开",
      "这座城市的秘密，只有住过的人才懂",
      "一条老街的告别，看哭了多少人",
      "普通人的浪漫：把日子过成纪录片",
      "XX最后的样子，我想替你记住",
    ],
    shootingTips: {
      camera: [
        "开头用固定机位特写（钥匙/门牌），制造仪式感。",
        "中段多用第一人称手持跟拍，增强真实与沉浸。",
        "结尾用空镜慢镜头收尾，留白给情绪。",
      ],
      copy: [
        "文案口语化、第一人称，避免说教。",
        "每 15 秒设置一个具体细节锚点（物件/人名/味道）。",
        "结尾留一个开放式问题引导评论。",
      ],
      music: [
        "前 3 秒用安静环境音或人声直接开场，不抢戏。",
        "中段用舒缓钢琴铺垫情绪。",
        "高潮处切入弦乐或人声吟唱，推情绪上限。",
      ],
    },
  },
  golden3s: {
    hookType: "身份共鸣",
    transcript: "（镜头：斑驳门牌特写）「我在北京胡同住了三十年，今天终于要搬走了。」",
    why: "前 2 秒用「三十年 + 搬走」的强反差制造悬念，用户本能想知道为什么，划走成本立刻变高。",
    rebuild: [
      "把钩子提前到 1 秒内，别让 logo / 片头占前 3 秒。",
      "用「一个具体物件」（门牌 / 钥匙）当贯穿线索，比空泛关键词更抓人。",
      "钩子里先给冲突、再给答案，留一个「为什么」让用户继续看。",
    ],
  },
  emotionCurve: {
    points: [
      { tSec: 0, level: 30, label: "开场" },
      { tSec: 9, level: 54, label: "铺垫" },
      { tSec: 24, level: 47, label: "展开" },
      { tSec: 42, level: 70, label: "冲突" },
      { tSec: 60, level: 92, label: "高潮" },
      { tSec: 72, level: 78, label: "收尾" },
    ],
    note: "整体先平后扬，60 秒处情绪峰值（升华主题）拉满转发；24-42 秒「展开期」有小幅回落，靠老物件细节把人拉回，别让情绪空档超过 10 秒。",
  },
  formula: {
    formula: "身份共鸣 × 具体细节 × 情绪升华",
    factors: [
      { name: "身份共鸣", weight: 35, tip: "用真实普通人的视角切入，唤起集体记忆，降低距离感。" },
      { name: "具体细节", weight: 30, tip: "老门牌 / 邻居 / 味道，信息密度高不注水，让人信以为真。" },
      { name: "情绪升华", weight: 20, tip: "结尾从个人故事升华到城市变迁，给用户一个转发的理由。" },
      { name: "互动钩子", weight: 15, tip: "结尾抛一个开放式问题，自然盘活评论区。" },
    ],
  },
  effects: [
    { name: "转场特效", used: true, difficulty: "易", tip: "全片硬切为主，段落衔接处叠化一次，干净不抢戏。" },
    { name: "滤镜调色", used: true, difficulty: "中", tip: "整片统一偏暖旧胶片色，回忆感一下就有，跟主题贴。" },
    { name: "字幕花字", used: true, difficulty: "易", tip: "关键物件用人声花字点一下（比如「老门牌」），记忆点就出来了。" },
    { name: "贴纸 / 表情", used: false, difficulty: "易", tip: "纪实向克制用，别削弱真实感。" },
    { name: "关键帧运镜", used: true, difficulty: "中", tip: "结尾空镜缓慢推近，情绪收得更有分量。" },
    { name: "美颜 / 妆容", used: false, difficulty: "易", tip: "非颜值类保持原貌，更可信。" },
    { name: "BGM 卡点", used: true, difficulty: "中", tip: "钢琴铺底、弦乐高潮都对齐画面情绪切换，不硬卡鼓点。" },
    { name: "画中画 / 分屏", used: false, difficulty: "难", tip: "单线叙事不用分屏，保持沉浸。" },
  ],
  pacing: {
    hookSeconds: 2,
    avgShotSeconds: 4,
    climaxAtSec: 40,
    beatSync: true,
    segments: [
      { time: "0-3 秒", label: "钩子", durationSec: 3 },
      { time: "3-15 秒", label: "铺垫", durationSec: 12 },
      { time: "15-45 秒", label: "展开", durationSec: 30 },
      { time: "45 秒后", label: "高潮", durationSec: 15 },
    ],
    suggestion: "样本前 2 秒就甩出「住了三十年要搬走」的钩子，平均镜头约 4 秒偏稳，靠细节密度撑完播；情绪段用慢镜头拉长。你照着做：钩子再提前到 1 秒内，并留一个「具体物件」当贯穿线索。",
  },
  premium: {
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
  },
  repro: {
    path: "套模板",
    advice:
      "新手别硬凹原创，先用『可复制模板』把骨架搭起来——固定结构 + 固定节奏，把内容填进去就能发，先跑通一条再说。",
    shots: [
      "开场特写 / 钩子镜头 1 条（3 秒内抓住人）",
      "主体过程 / 核心内容镜头 3-5 条（每段有新信息）",
      "情绪高潮 / 收尾空镜 1-2 条（留白，别急着切）",
    ],
    sfx: ["转场 whoosh 音效", "重点强调音（叮 / 咚）"],
    music: [
      "前 3 秒：轻环境音或人声开场，别让音乐抢戏",
      "中段：舒缓铺底 BGM，情绪别太平",
      "高潮：切弦乐 / 人声吟唱推情绪",
      "全程：卡点剪切，跟鼓点走",
    ],
  },
  signal: {
    platform: "抖音",
    tags: ["治愈", "真实记录", "情绪价值", "第一视角", "共鸣"],
    comments: [
      { text: "看哭了，这就是普通人的浪漫", like: 12800 },
      { text: "真实得不像摆拍，收藏了", like: 8600 },
      { text: "隔着屏幕都觉得温暖", like: 5300 },
      { text: "求同款 BGM，太好听了", like: 3100 },
      { text: "已经推荐给三个朋友了", like: 1900 },
    ],
    note: "以上标签与评论来自该链接的公开信息，仅作为 AI 分析的「参考信号」——帮你理解这条视频受欢迎的侧面，但**不能当作结论或答案**。真正判断还是要靠你对内容的拆解。",
  },
  scoreTarget: {
    current: 87,
    target: 85,
    band: "良好 → 优秀 85+",
    gaps: [],
    advice:
      "你已经良好以上。维持稳定输出，往 85+ 精品线靠：节奏、音效、色彩的门槛（见下方精品化门槛）就是你的下一关。",
  },
  createdAt: "2026-03-18T10:00:00.000Z",
};

export const LIBRARY: LibraryItem[] = [
  {
    id: "lib-1",
    title: "我在北京胡同住了三十年，今天终于要搬走了",
    category: "生活",
    cover: gradientFor(0),
    views: 3860000,
    score: 87,
    summary: "身份共鸣 + 城市变迁，真实第一视角引发集体记忆。",
    tags: ["情感共鸣", "第一视角", "城市记忆"],
  },
  {
    id: "lib-2",
    title: "一个人去冰岛，我才明白孤独也可以很美",
    category: "旅游",
    cover: gradientFor(2),
    views: 2120000,
    score: 84,
    summary: "孤独叙事 + 极致风光，情绪价值拉满的旅行 vlog。",
    tags: ["治愈", "独旅", "风光"],
  },
  {
    id: "lib-3",
    title: "10 块钱在菜市场能吃到什么？挑战全网最低预算",
    category: "美食",
    cover: gradientFor(1),
    views: 5310000,
    score: 89,
    summary: "强钩子标题 + 极限挑战结构，完播率极高。",
    tags: ["挑战", "平价", "街头美食"],
  },
  {
    id: "lib-4",
    title: "和异性聊天总冷场？这 3 个技巧真的有用",
    category: "情感",
    cover: gradientFor(3),
    views: 1740000,
    score: 81,
    summary: "痛点前置 + 清单式方法论，收藏率突出。",
    tags: ["干货", "恋爱", "清单"],
  },
  {
    id: "lib-5",
    title: "为什么你越努力越焦虑？一个被忽视的真相",
    category: "知识",
    cover: gradientFor(4),
    views: 2980000,
    score: 86,
    summary: "反常识观点开场，用认知框架留住用户。",
    tags: ["认知", "反常识", "心理学"],
  },
  {
    id: "lib-6",
    title: "从 0 到月入 10 万，我做对了哪 3 件事",
    category: "商业",
    cover: gradientFor(5),
    views: 2460000,
    score: 83,
    summary: "结果前置 + 可拆解路径，转化意向强。",
    tags: ["副业", "搞钱", "方法论"],
  },
  {
    id: "lib-7",
    title: "凌晨四点的菜市场，藏着最真实的人间烟火",
    category: "生活",
    cover: gradientFor(6),
    views: 1530000,
    score: 82,
    summary: "时间反差 + 烟火气特写，治愈系记录范本。",
    tags: ["烟火气", "纪实", "治愈"],
  },
  {
    id: "lib-8",
    title: "大理旅居一个月，我算了笔真实的账",
    category: "旅游",
    cover: gradientFor(2),
    views: 1290000,
    score: 80,
    summary: "真实账单 + 避坑提醒，信任感强。",
    tags: ["旅居", "避坑", "真实"],
  },
  {
    id: "lib-9",
    title: "一碗面里的江湖：走访城中村百年老店",
    category: "美食",
    cover: gradientFor(1),
    views: 1980000,
    score: 85,
    summary: "人物故事 + 食物特写，叙事型美食标杆。",
    tags: ["老店", "人物", "故事"],
  },
  {
    id: "lib-10",
    title: "异地恋怎样走到最后？我们用了 5 年证明",
    category: "情感",
    cover: gradientFor(3),
    views: 2210000,
    score: 84,
    summary: "真实时间线 + 具体动作，代入感极强。",
    tags: ["异地恋", "真实", "长情"],
  },
  {
    id: "lib-11",
    title: "普通人如何用 AI 每天省下 2 小时",
    category: "知识",
    cover: gradientFor(4),
    views: 3340000,
    score: 88,
    summary: "工具清单 + 场景演示，实用性与传播性兼具。",
    tags: ["AI", "效率", "工具"],
  },
  {
    id: "lib-12",
    title: "摆摊第一天，我赚到了人生第一笔钱",
    category: "商业",
    cover: gradientFor(7),
    views: 1870000,
    score: 82,
    summary: "过程记录 + 真实数据，创业内容信任锚点。",
    tags: ["摆摊", "创业", "真实记录"],
  },
];

export type PlanTier = "free" | "creator" | "pro" | "studio";

export interface MembershipPlan {
  tier: PlanTier;
  name: string;
  price: string;
  period: string;
  /** 一句话定位，帮助用户快速判断哪一档适合自己 */
  tagline: string;
  /** 该档明确包含的核心能力（与价格强相关，差异化体现在这里） */
  highlights: string[];
  /** 按钮文案 */
  cta: string;
  /** 点击后去哪：免费直接体验，付费档先登录再进支付占位 */
  ctaHref: string;
  featured?: boolean;
  /** 功能完善中：暂未开放（如高级会员，因当前无公司资质无法开通收费） */
  comingSoon?: boolean;
}

export const MEMBERSHIP: MembershipPlan[] = [
  {
    tier: "free",
    name: "免费版",
    price: "0",
    period: "永久免费",
    tagline: "先体验，每天 1 次爆款拆解",
    highlights: [
      "每天 1 次视频分析",
      "基础版导演报告（爆款评分 + 核心亮点）",
      "浏览爆款公式库",
      "新手创作者档案（定制建议）",
    ],
    cta: "免费开始",
    ctaHref: "/analyze",
  },
  {
    tier: "creator",
    name: "创作者版",
    price: "39",
    period: "月",
    tagline: "进阶导演报告，认真做内容",
    highlights: [
      "每日 5 次视频分析",
      "完整版《爆款导演拆解报告》（五段拆解 + 情绪曲线）",
      "爆款公式库全量查阅",
      "AI 写文案（按风格生成标题与脚本）",
    ],
    cta: "升级创作者版",
    ctaHref: "/payment?tier=creator",
  },
  {
    tier: "pro",
    name: "进阶版",
    price: "99",
    period: "月",
    tagline: "无限分析 + 爆款复刻",
    highlights: [
      "无限次视频分析",
      "爆款复刻助手：一键生成你的行业版本（标题 / 脚本 / 分镜）",
      "行业模板库：按赛道匹配可复制公式",
      "我的 AI 导演：结合你的账号档案给建议",
      "历史报告云同步",
    ],
    cta: "升级进阶版",
    ctaHref: "/payment?tier=pro",
    featured: true,
  },
  {
    tier: "studio",
    name: "专业版",
    price: "299",
    period: "月",
    tagline: "个人 AI 导演 + 账号长期优化",
    highlights: [
      "包含进阶版全部功能",
      "账号长期优化：定期诊断定位与内容方向",
      "优先模型队列（分析更快）",
      "专属客服支持",
    ],
    cta: "升级专业版",
    ctaHref: "/payment?tier=studio",
  },
];

/** 年付价（展示用，含立省说明）。免费档永远 0。 */
export const ANNUAL: Record<PlanTier, { price: string; save?: string }> = {
  free: { price: "0" },
  creator: { price: "390", save: "约 ¥32/月，立省 ¥78" },
  pro: { price: "990", save: "约 ¥82/月，立省 ¥198" },
  studio: { price: "2990", save: "约 ¥249/月，立省 ¥598" },
};

/** 功能对比矩阵：不同档位下能力差异一目了然 */
export type PricingCell = boolean | string;

export interface PricingRow {
  /** 分组（对比表按组渲染小标题） */
  group: string;
  label: string;
  free: PricingCell;
  creator: PricingCell;
  pro: PricingCell;
  studio: PricingCell;
}

export const PRICING_GROUPS = ["分析能力", "爆款导演报告", "爆款复刻与公式", "我的 AI 导演", "服务"] as const;

export const PRICING_MATRIX: PricingRow[] = [
  // 分析能力
  { group: "分析能力", label: "每日分析次数", free: "1 次 / 天", creator: "5 次 / 天", pro: "无限", studio: "无限" },
  { group: "分析能力", label: "报告完整度", free: "基础版", creator: "完整版", pro: "完整版 + 复刻", studio: "完整版 + 复刻 + 诊断" },
  // 爆款导演报告
  { group: "爆款导演报告", label: "爆款评分体系（传播 / 完播 / 互动 / 商业）", free: true, creator: true, pro: true, studio: true },
  { group: "爆款导演报告", label: "五段拆解（黄金3秒 / 结构 / 情绪曲线 / 公式 / 可复制）", free: false, creator: true, pro: true, studio: true },
  { group: "爆款导演报告", label: "行业模板与可复制公式", free: false, creator: false, pro: true, studio: true },
  // 爆款复刻与公式
  { group: "爆款复刻与公式", label: "一键生成我的版本（标题 / 脚本 / 分镜）", free: false, creator: false, pro: true, studio: true },
  { group: "爆款复刻与公式", label: "爆款公式库查阅", free: "部分", creator: "全量", pro: "全量", studio: "全量" },
  // 我的 AI 导演
  { group: "我的 AI 导演", label: "创作者档案定制建议", free: "基础", creator: "进阶", pro: "专属", studio: "长期优化" },
  { group: "我的 AI 导演", label: "账号定位诊断（定期）", free: false, creator: false, pro: false, studio: true },
  // 服务
  { group: "服务", label: "历史报告云同步", free: "仅本地", creator: "云同步", pro: "云同步", studio: "云同步" },
  { group: "服务", label: "专属客服", free: false, creator: false, pro: false, studio: true },
];
