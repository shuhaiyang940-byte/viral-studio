// 找对标：精选对标账号库（seed 示例数据）
// 说明：这是「在我们的库里自主找对标」的数据源，不依赖任何平台 API（无需公司资质）。
// 你或用户后续都能往这里补充账号。匹配排序用 followers / engagementRate 近似「流量大 / 效果好」。

export type IdeaType = "sell" | "talk" | "other";

export interface BenchmarkAccount {
  id: string;
  name: string;
  handle: string;
  platform: "抖音" | "小红书" | "视频号" | "快手";
  /** 想法类型：卖货 / 口播 / 其他 */
  ideaType: IdeaType;
  /** 风格标签 */
  styles: string[];
  /** 效果标签（近似「效果好」的维度） */
  effects: string[];
  /** 是否露脸 */
  face: boolean;
  /** 货品种类（仅卖货类需要） */
  productType?: string;
  /** 粉丝量（万） */
  followers: number;
  /** 互动率（%）—— 近似「效果好」 */
  engagementRate: number;
  /** 为什么值得对标 */
  reason: string;
  /** 代表作标题 */
  sampleTitle: string;
}

export const IDEA_OPTIONS: { id: IdeaType; label: string; desc: string }[] = [
  { id: "sell", label: "卖货", desc: "带货 / 种草 / 商品转化" },
  { id: "talk", label: "口播", desc: "知识 / 观点 / 情绪表达" },
  { id: "other", label: "其他", desc: "vlog / 剧情 / 测评 / 治愈等" },
];

export const STYLE_OPTIONS = [
  "种草",
  "测评",
  "剧情",
  "知识",
  "搞笑",
  "治愈",
  "测评",
  "干货",
  "高端",
  "接地气",
];

export const EFFECT_OPTIONS = [
  "涨粉快",
  "转化高",
  "互动强",
  "品牌感",
  "完播高",
  "评论多",
];

export const PRODUCT_OPTIONS = [
  "美妆",
  "食品",
  "服饰",
  "家居",
  "3C 数码",
  "母婴",
  "通用（不限品类）",
];

export const BENCHMARKS: BenchmarkAccount[] = [
  // ── 卖货 ──
  {
    id: "b-sell-1",
    name: "成分实验室",
    handle: "@chengfen_lab",
    platform: "抖音",
    ideaType: "sell",
    styles: ["种草", "测评", "干货"],
    effects: ["转化高", "评论多"],
    face: true,
    productType: "美妆",
    followers: 386,
    engagementRate: 8.2,
    reason: "成分党人设 + 实验室白板讲解，信任感极强，美妆带货转化标杆。",
    sampleTitle: "这瓶精华到底值不值得买？3 个成分一次讲清",
  },
  {
    id: "b-sell-2",
    name: "深夜零食铺",
    handle: "@midnight_snack",
    platform: "抖音",
    ideaType: "sell",
    styles: ["接地气", "种草"],
    effects: ["涨粉快", "转化高"],
    face: false,
    productType: "食品",
    followers: 512,
    engagementRate: 9.6,
    reason: "不露脸 + 特写食欲镜头 + 限时话术，食品带货完播与转化双高。",
    sampleTitle: "凌晨饿哭系列：9.9 三袋的追剧零食",
  },
  {
    id: "b-sell-3",
    name: "衣柜研究所",
    handle: "@wardrobe_lab",
    platform: "小红书",
    ideaType: "sell",
    styles: ["种草", "高端"],
    effects: ["品牌感", "转化高"],
    face: true,
    productType: "服饰",
    followers: 224,
    engagementRate: 7.1,
    reason: "通勤穿搭场景化种草，客单价高但复购稳，服饰赛道品牌感标杆。",
    sampleTitle: "一件白衬衫的 7 种通勤穿法",
  },
  {
    id: "b-sell-4",
    name: "好物收纳师",
    handle: "@storage_pro",
    platform: "抖音",
    ideaType: "sell",
    styles: ["干货", "种草"],
    effects: ["完播高", "转化高"],
    face: false,
    productType: "家居",
    followers: 178,
    engagementRate: 8.9,
    reason: "痛点前置 + before/after 对比，家居小物带货完播率极高。",
    sampleTitle: "租房党必入的 5 件收纳神器",
  },
  {
    id: "b-sell-5",
    name: "数码老炮儿",
    handle: "@digital_vet",
    platform: "抖音",
    ideaType: "sell",
    styles: ["测评", "干货"],
    effects: ["评论多", "转化高"],
    face: true,
    productType: "3C 数码",
    followers: 631,
    engagementRate: 6.4,
    reason: "硬核测评 + 参数可视化，3C 高客单转化信任锚点。",
    sampleTitle: "千元机和旗舰机，差距到底在哪？",
  },
  {
    id: "b-sell-6",
    name: "宝妈严选",
    handle: "@mom_pick",
    platform: "视频号",
    ideaType: "sell",
    styles: ["接地气", "种草"],
    effects: ["转化高", "评论多"],
    face: true,
    productType: "母婴",
    followers: 96,
    engagementRate: 10.3,
    reason: "视频号私域妈妈群，复购与信任极高，母婴带货转化标杆。",
    sampleTitle: "带娃出门必需：这 3 样我回购了 10 次",
  },
  {
    id: "b-sell-7",
    name: "工厂直供姐",
    handle: "@factory_sister",
    platform: "快手",
    ideaType: "sell",
    styles: ["接地气", "种草"],
    effects: ["涨粉快", "转化高"],
    face: true,
    productType: "通用（不限品类）",
    followers: 845,
    engagementRate: 7.8,
    reason: "源头工厂人设 + 喊麦式福利，快手高转化泛品类标杆。",
    sampleTitle: "今天不搞虚的，工厂价给你安排上",
  },
  // ── 口播 ──
  {
    id: "b-talk-1",
    name: "认知折叠",
    handle: "@cog_fold",
    platform: "抖音",
    ideaType: "talk",
    styles: ["知识", "干货"],
    effects: ["涨粉快", "评论多"],
    face: true,
    followers: 472,
    engagementRate: 9.1,
    reason: "反常识开场 + 认知框架，知识口播涨粉与收藏双高。",
    sampleTitle: "为什么你越努力越焦虑？一个被忽视的真相",
  },
  {
    id: "b-talk-2",
    name: "深夜电台",
    handle: "@night_fm",
    platform: "小红书",
    ideaType: "talk",
    styles: ["治愈", "情感"],
    effects: ["互动强", "评论多"],
    face: false,
    followers: 263,
    engagementRate: 11.2,
    reason: "不露脸 + 氛围配音 + 文字卡点，情绪价值拉满，评论区高互动。",
    sampleTitle: "今晚睡不着的人，听我说句话",
  },
  {
    id: "b-talk-3",
    name: "脱口秀阿强",
    handle: "@qiang_talk",
    platform: "抖音",
    ideaType: "talk",
    styles: ["搞笑", "接地气"],
    effects: ["涨粉快", "完播高"],
    face: true,
    followers: 698,
    engagementRate: 8.7,
    reason: "段子化观点输出，前 3 秒笑点密集，完播与涨粉标杆。",
    sampleTitle: "相亲时这 3 句话，直接劝退",
  },
  {
    id: "b-talk-4",
    name: "职场观察者",
    handle: "@work_watch",
    platform: "视频号",
    ideaType: "talk",
    styles: ["知识", "干货"],
    effects: ["品牌感", "评论多"],
    face: true,
    followers: 154,
    engagementRate: 7.5,
    reason: "职场痛点清单式口播，视频号商务人群信任度高。",
    sampleTitle: "汇报时领导最烦的 3 种表达",
  },
  // ── 其他 ──
  {
    id: "b-other-1",
    name: "一个人的冰岛",
    handle: "@iceland_solo",
    platform: "抖音",
    ideaType: "other",
    styles: ["治愈", "高端"],
    effects: ["完播高", "品牌感"],
    face: false,
    followers: 421,
    engagementRate: 9.8,
    reason: "极致风光 + 孤独叙事，旅行 vlog 治愈系范本，品牌合作多。",
    sampleTitle: "一个人去冰岛，我才明白孤独也可以很美",
  },
  {
    id: "b-other-2",
    name: "菜市场日记",
    handle: "@market_daily",
    platform: "小红书",
    ideaType: "other",
    styles: ["接地气", "治愈"],
    effects: ["互动强", "评论多"],
    face: true,
    followers: 187,
    engagementRate: 10.6,
    reason: "烟火气纪实 + 人物特写，记录类账号互动与信任标杆。",
    sampleTitle: "凌晨四点的菜市场，藏着最真实的人间烟火",
  },
  {
    id: "b-other-3",
    name: "老店寻味",
    handle: "@old_shop",
    platform: "抖音",
    ideaType: "other",
    styles: ["测评", "种草"],
    effects: ["完播高", "评论多"],
    face: true,
    followers: 309,
    engagementRate: 8.4,
    reason: "人物故事 + 食物特写，叙事型美食标杆，可借鉴到带货。",
    sampleTitle: "一碗面里的江湖：走访城中村百年老店",
  },
];

export interface PeerQuery {
  ideaType: IdeaType;
  styles: string[];
  effects: string[];
  /** "face" | "noface" | "any" */
  face: "face" | "noface" | "any";
  productType?: string;
  /** 需求类目（用于更细的对标与套路匹配） */
  category?: string;
  /** 需求目标（用于更细的对标与套路匹配） */
  goal?: string;
}

/* ════════ 需求类目 / 目标（需求入口维度） ════════ */
export const CATEGORY_OPTIONS = [
  "美妆",
  "食品",
  "服饰",
  "家居",
  "3C 数码",
  "母婴",
  "知识",
  "情感",
  "旅行",
  "本地生活",
  "通用",
] as const;

export const GOAL_OPTIONS = [
  "带货转化",
  "涨粉",
  "品牌曝光",
  "引流到店",
  "私域沉淀",
] as const;

/* ════════ 爆款套路库（按类目细分的「可复制模板」） ════════ */
/**
 * 套路比账号更可操作：给的是「开头钩子 + 段落结构 + 镜头/素材清单」，
 * 想复刻爆款的人能直接照着拍，也能一键生成 AI 分镜。
 */
export interface PlaybookSegment {
  /** 段落名（同时作为分镜 phase） */
  phase: string;
  /** 该段时长（秒） */
  secs: number;
  /** 这段拍什么 */
  detail: string;
}

export interface Playbook {
  id: string;
  ideaType: IdeaType;
  /** 适用类目（命中类目时优先推荐） */
  categories: string[];
  /** 适用目标（命中目标时加分） */
  goals: string[];
  /** 套路名 */
  title: string;
  /** 开头钩子示例 */
  hook: string;
  /** 段落结构 */
  structure: PlaybookSegment[];
  /** 运镜 / 镜头建议（逐段，长度对齐 structure 或留空） */
  cameraTips: string[];
  /** 需要的素材清单 */
  shots: string[];
  /** 配乐方向 */
  music: string[];
  /** 为什么这套路能打 */
  note: string;
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: "pb-meihzhuang",
    ideaType: "sell",
    categories: ["美妆"],
    goals: ["带货转化", "品牌曝光"],
    title: "美妆带货 · 成分实测型",
    hook: "上脸 3 秒告诉你，这瓶到底行不行",
    structure: [
      { phase: "钩子", secs: 3, detail: "功效前置：直接抛「烂脸救星 / 换季必入」，3 秒内给出利益点。" },
      { phase: "痛点", secs: 9, detail: "戳误区：你以为贵才有效？错。用一句反常识拉情绪。" },
      { phase: "实测", secs: 23, detail: "上脸实测 + 使用前后对比，质地/上脸效果怼脸拍。" },
      { phase: "信任", secs: 15, detail: "成分表解读，点出 1-2 个关键成分为什么安全有效。" },
      { phase: "转化", secs: 10, detail: "限时机制 + 下单指引，给明确行动指令。" },
    ],
    cameraTips: [
      "开头特写瓶身 / 质地，制造仪式感。",
      "中段怼脸前后对比，同机位同光比。",
      "结尾手持优惠码口播，引导点击。" ,
    ],
    shots: ["质地特写", "上脸前后对比", "成分表截图", "优惠码口播"],
    music: ["前段轻快种草 BGM", "高潮处人声吟唱推情绪"],
    note: "美妆带货 = 信任先行，成分 + 实测 + 对比三件套，别硬凹剧情。",
  },
  {
    id: "pb-shipin",
    ideaType: "sell",
    categories: ["食品"],
    goals: ["带货转化", "引流到店"],
    title: "食品带货 · 食欲特写型",
    hook: "凌晨饿哭系列：9.9 三袋的追剧零食",
    structure: [
      { phase: "钩子", secs: 3, detail: "食欲特写开场：热气 / 脆感 / 酱汁拉丝，先馋后说。" },
      { phase: "开箱", secs: 8, detail: "展示包装与分量，强化性价比。" },
      { phase: "试吃", secs: 20, detail: "不露脸手持试吃，形容口感与场景（追剧 / 夜宵）。" },
      { phase: "种草", secs: 12, detail: "口感关键词 + 适用人群，建立想买冲动。" },
      { phase: "逼单", secs: 7, detail: "限时低价话术，给下单理由。" },
    ],
    cameraTips: [
      "特写食物热气 / 脆感，慢动作更馋。",
      "不露脸，手部入镜试吃即可。",
      "价格标签怼近，强调便宜。" ,
    ],
    shots: ["食物特写", "试吃反应", "价格标签", "分量展示"],
    music: ["轻快吃播 BGM", "咬下脆响音效增强食欲"],
    note: "食品 = 食欲镜头 + 低价话术，画面比台词更重要。",
  },
  {
    id: "pb-fushi",
    ideaType: "sell",
    categories: ["服饰"],
    goals: ["带货转化", "品牌曝光"],
    title: "服饰种草 · 多场景穿搭型",
    hook: "一件白衬衫的 7 种通勤穿法",
    structure: [
      { phase: "钩子", secs: 3, detail: "单品亮相：把主角单品怼到镜头前，抛「一衣多穿」。" },
      { phase: "场景 1", secs: 10, detail: "第一套穿搭 + 场景说明（通勤）。" },
      { phase: "场景 2", secs: 10, detail: "快速转场切第二套（约会）。" },
      { phase: "场景 3", secs: 10, detail: "第三套（周末），保持节奏不拖。" },
      { phase: "总结", secs: 7, detail: "回顾三套 + 购买指引，引导点击。" },
    ],
    cameraTips: [
      "全身镜全景展示穿搭。",
      "换装处用相似动作转场，干净利落。",
      "结尾拿出购买链接口播。" ,
    ],
    shots: ["全身穿搭", "面料细节", "购买链接口播", "转场换装"],
    music: ["轻快时尚 BGM", "转场 whoosh 音效"],
    note: "服饰 = 多场景 + 快速切换，特效克制，让衣服当主角。",
  },
  {
    id: "pb-jiaju",
    ideaType: "sell",
    categories: ["家居"],
    goals: ["带货转化"],
    title: "家居好物 · 痛点对比型",
    hook: "租房党必入的 5 件收纳神器",
    structure: [
      { phase: "钩子", secs: 3, detail: "痛点前置：桌面乱 / 没地方放，直接戳同居痛点。" },
      { phase: "对比", secs: 12, detail: "before / after 同框，收纳前 vs 收纳后。" },
      { phase: "清单", secs: 20, detail: "逐件展示神器 + 用法，信息密度高。" },
      { phase: "收尾", secs: 5, detail: "汇总清单 + 下单指引。" },
    ],
    cameraTips: [
      "before / after 同框对比最直观。",
      "桌面俯拍展示收纳效果。",
      "单品特写标价格。" ,
    ],
    shots: ["杂乱 before", "收纳 after", "单品特写", "价格标签"],
    music: ["轻松居家 BGM", "翻盖 / 放置音效"],
    note: "家居 = 痛点 + 对比 + 清单，越具体越好卖。",
  },
  {
    id: "pb-3c",
    ideaType: "sell",
    categories: ["3C 数码"],
    goals: ["带货转化", "品牌曝光"],
    title: "3C 测评 · 硬核参数型",
    hook: "千元机和旗舰机，差距到底在哪？",
    structure: [
      { phase: "钩子", secs: 3, detail: "悬念开场：抛一个反常识问题，留住人。" },
      { phase: "拆解", secs: 18, detail: "关键参数可视化（图表 / 对比），逐条说清。" },
      { phase: "实测", secs: 18, detail: "实机对比，跑分 / 样张 / 手感。" },
      { phase: "结论", secs: 11, detail: "给明确购买建议（谁该买 / 谁别买）。" },
    ],
    cameraTips: [
      "参数图表用特效字幕呈现。",
      "实机同框对比，统一光比。",
      "结论处定格字幕强调。" ,
    ],
    shots: ["参数图表", "实机对比", "样张特写", "结论字幕"],
    music: ["科技感 BGM", "数据弹出音效"],
    note: "3C = 硬核参数 + 信任，别堆术语，给结论。",
  },
  {
    id: "pb-muying",
    ideaType: "sell",
    categories: ["母婴"],
    goals: ["带货转化", "私域沉淀"],
    title: "母婴种草 · 真实回购型",
    hook: "带娃出门必需：这 3 样我回购了 10 次",
    structure: [
      { phase: "钩子", secs: 3, detail: "身份共鸣：妈妈视角，抛「回购 N 次」建立信任。" },
      { phase: "好物 1", secs: 12, detail: "第一样 + 使用场景（出门）。" },
      { phase: "好物 2", secs: 12, detail: "第二样 + 为什么离不开。" },
      { phase: "好物 3", secs: 10, detail: "第三样 + 避坑提醒。" },
      { phase: "收尾", secs: 5, detail: "汇总 + 引导私域 / 下单。" },
    ],
    cameraTips: [
      "第一人称手持展示，真实感强。",
      "宝宝局部入镜（不露正脸更稳妥）。",
      "结尾口播引导加群 / 下单。" ,
    ],
    shots: ["好物特写", "使用场景", "宝宝局部", "汇总口播"],
    music: ["温暖治愈 BGM", "轻提示音"],
    note: "母婴 = 真实回购 + 信任，视频号私域转化尤其高。",
  },
  {
    id: "pb-zhishi",
    ideaType: "talk",
    categories: ["知识"],
    goals: ["涨粉", "品牌曝光"],
    title: "知识口播 · 反常识框架型",
    hook: "为什么你越努力越焦虑？一个被忽视的真相",
    structure: [
      { phase: "钩子", secs: 3, detail: "反常识开场，直接挑战共识，留住人。" },
      { phase: "框架", secs: 15, detail: "给出认知框架，分点拆解。" },
      { phase: "案例", secs: 18, detail: "用一个具体案例把框架落地。" },
      { phase: "行动", secs: 9, detail: "给可执行的下一步，引导收藏。" },
    ],
    cameraTips: [
      "固定机位口播，背景干净。",
      "关键论点用字幕强调。",
      "结尾定格金句。" ,
    ],
    shots: ["口播固定机位", "论点字幕", "案例图示", "金句定格"],
    music: ["轻铺底 BGM，不抢人声", "重点处强调音"],
    note: "知识 = 反常识 + 框架 + 收藏欲，结构比表演重要。",
  },
  {
    id: "pb-qinggan",
    ideaType: "talk",
    categories: ["情感"],
    goals: ["涨粉", "私域沉淀"],
    title: "情感治愈 · 共情氛围型",
    hook: "今晚睡不着的人，听我说句话",
    structure: [
      { phase: "钩子", secs: 4, detail: "共情开场：点名一种情绪状态（失眠 / 孤独）。" },
      { phase: "故事", secs: 22, detail: "讲一个具体小故事，不露脸，靠声音与文字。" },
      { phase: "留白", secs: 12, detail: "情绪收束，给一句温柔的话，留评论空间。" },
    ],
    cameraTips: [
      "不露脸 + 氛围配音，降低制作门槛。",
      "文字卡点配合情绪。",
      "结尾慢镜头空镜。" ,
    ],
    shots: ["氛围空镜", "文字卡点", "慢镜头收尾"],
    music: ["舒缓钢琴 / 氛围音", "轻柔呼吸感音效"],
    note: "情感 = 共情 + 氛围，不露脸也能做，评论区互动极高。",
  },
  {
    id: "pb-lvyou",
    ideaType: "other",
    categories: ["旅行"],
    goals: ["涨粉", "品牌曝光"],
    title: "旅行 vlog · 孤独叙事型",
    hook: "一个人去冰岛，我才明白孤独也可以很美",
    structure: [
      { phase: "钩子", secs: 4, detail: "极致风光 + 一句情绪钩子，先美住人。" },
      { phase: "过程", secs: 26, detail: "路线 + 风光 + 第一视角体验，信息价值高。" },
      { phase: "升华", secs: 10, detail: "回到情绪，点题，引导转发。" },
    ],
    cameraTips: [
      "广角风光空镜开场。",
      "第一人称手持跟拍增强沉浸。",
      "结尾慢镜头留白。" ,
    ],
    shots: ["风光空镜", "第一视角", "人物剪影", "收尾留白"],
    music: ["氛围感 BGM", "环境音保留"],
    note: "旅行 = 风光 + 孤独叙事，情绪价值拉满，品牌合作多。",
  },
  {
    id: "pb-bendishenghuo",
    ideaType: "other",
    categories: ["本地生活"],
    goals: ["引流到店", "带货转化"],
    title: "本地生活 · 到店引流型",
    hook: "这家店本地人排队 30 年",
    structure: [
      { phase: "钩子", secs: 3, detail: "招牌亮相 + 排队/人气，制造「必去」感。" },
      { phase: "环境", secs: 10, detail: "门头 / 店内环境广角，建立真实感。" },
      { phase: "招牌", secs: 18, detail: "招牌菜特写 + 试吃形容，馋住人。" },
      { phase: "引流", secs: 9, detail: "地址 + 营业时间 + 到店理由，明确引流。" },
    ],
    cameraTips: [
      "门头广角展示人气。",
      "菜品特写怼近，强调诱人。",
      "结尾贴定位 / 地址贴纸。" ,
    ],
    shots: ["门头人气", "店内环境", "招牌菜特写", "地址贴纸"],
    music: ["轻快探店 BGM", "翻动 / 出锅音效"],
    note: "本地生活 = 招牌 + 地址 + 到店理由，引流比涨粉更关键。",
  },
];

/**
 * 从需求（类目 / 目标 / 想法类型）匹配最贴合的爆款套路。
 * 排序：想法类型一致 (+3) > 类目命中 (+2) > 目标命中 (+1)，取前若干。
 */
export function findPlaybooks(q: {
  ideaType: IdeaType;
  category?: string;
  goal?: string;
  limit?: number;
}): Playbook[] {
  const limit = q.limit ?? 3;
  return PLAYBOOKS.map((p) => {
    let score = 0;
    if (p.ideaType === q.ideaType) score += 3;
    if (q.category && p.categories.includes(q.category)) score += 2;
    if (q.goal && p.goals.includes(q.goal)) score += 1;
    return { p, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * 在我们的库里自主匹配并排序对标账号。
 * 排序依据：风格/效果命中数 + 露脸匹配 + 货品匹配 + 互动率/粉丝量（近似「流量大 / 效果好」）。
 */
export function findPeers(q: PeerQuery, limit = 6): BenchmarkAccount[] {
  const scored = BENCHMARKS.map((a) => {
    let score = 0;
    if (a.ideaType !== q.ideaType) score -= 100; // 想法类型必须一致
    const styleHit = a.styles.filter((s) => q.styles.includes(s)).length;
    const effectHit = a.effects.filter((e) => q.effects.includes(e)).length;
    score += styleHit * 2 + effectHit * 2;
    if (q.face !== "any") {
      if (q.face === "face" && a.face) score += 1;
      if (q.face === "noface" && !a.face) score += 1;
      if ((q.face === "face" && !a.face) || (q.face === "noface" && a.face)) score -= 5;
    }
    if (q.ideaType === "sell" && q.productType) {
      if (a.productType === q.productType || a.productType === "通用（不限品类）") score += 3;
      else score -= 4;
    }
    // 近似「流量大 / 效果好」：互动率权重更高（效果好），粉丝量做次级排序
    score += a.engagementRate / 10;
    return { a, score, styleHit, effectHit };
  })
    .filter((x) => x.score > -50)
    .sort((x, y) => y.score - x.score || y.a.followers - x.a.followers);

  return scored.slice(0, limit).map((x) => x.a);
}
