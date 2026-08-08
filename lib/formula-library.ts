import type { Category, FormulaTemplate, ViralFormula } from "@/lib/types";

/**
 * 爆款公式库：从真实案例沉淀的可复用公式模板。
 *
 * 设计：纯静态资产（无 DB），作为「报告」的对端参考库——
 * 报告负责「检测」单条视频命中了哪条公式，公式库负责「沉淀」可复用的方法。
 * 因子权重之和固定为 100（35/30/20/15），与报告 ViralFormula 结构对齐。
 */
export const FORMULA_LIBRARY: FormulaTemplate[] = [
  {
    id: "identity-resonance",
    name: "身份共鸣 × 细节 × 升华",
    category: "生活",
    hookType: "身份共鸣",
    formula: "身份共鸣 × 具体细节 × 情绪升华",
    factors: [
      { name: "身份共鸣", weight: 35, tip: "用真实普通人的视角切入，唤起集体记忆，降低距离感。" },
      { name: "具体细节", weight: 30, tip: "老物件 / 人名 / 数字，信息密度高不注水，让人信以为真。" },
      { name: "情绪升华", weight: 20, tip: "结尾从个人故事升华到时代 / 群体，给用户一个转发的理由。" },
      { name: "互动钩子", weight: 15, tip: "结尾抛一个开放式问题，自然盘活评论区。" },
    ],
    whenToUse: "城市变迁、代际差异、普通人生活记录等强情感题材。",
    example: "「我在胡同住了三十年，今天终于要搬走了」——门牌特写 + 老物件 + 结尾升华。",
    copyPath: "找一个你最有体感的生活场景，用一件具体物件当贯穿线索，结尾落到'我们这代人都懂'的情绪上。",
    tags: ["情感", "城市变迁", "第一人称", "纪实"],
  },
  {
    id: "food-contrast",
    name: "反差人设 × 步骤爽感 × 治愈收尾",
    category: "美食",
    hookType: "反常识",
    formula: "反差人设 × 步骤爽感 × 治愈收尾",
    factors: [
      { name: "反差人设", weight: 35, tip: "硬核大叔做甜点 / 程序员煮泡面，反差本身就是钩子。" },
      { name: "步骤爽感", weight: 30, tip: "切配、下锅、出锅的干脆镜头，看完像自己做了一遍。" },
      { name: "治愈收尾", weight: 20, tip: "热气、咬一口的特写 + 一句'好好吃饭'，情绪落点。" },
      { name: "互动钩子", weight: 15, tip: "结尾问'你们那儿管这叫啥'，引地域梗评论。" },
    ],
    whenToUse: "家常菜、街头小吃、沉浸式做饭等美食内容。",
    example: "「一个程序员，用代码思维煮了一碗完美的泡面」——反差开场 + 干净步骤。",
    copyPath: "先立一个和你外表/身份反差的人设，中段只拍'做'不拍'说'，结尾用一口吃的收情绪。",
    tags: ["美食", "沉浸式", "治愈", "反差"],
  },
  {
    id: "knowledge-pain",
    name: "痛点前置 × 干货密度 × 权威背书",
    category: "知识",
    hookType: "痛点前置",
    formula: "痛点前置 × 干货密度 × 权威背书",
    factors: [
      { name: "痛点前置", weight: 35, tip: "第一句就把观众最烦的问题甩出来，'你是不是也…'。" },
      { name: "干货密度", weight: 30, tip: "每 15 秒一个可操作结论，别铺垫，直接给方法。" },
      { name: "权威背书", weight: 20, tip: "数据 / 论文 / 亲身踩坑，建立'这人说得对'的信任。" },
      { name: "互动钩子", weight: 15, tip: "结尾留'你踩过哪个坑'，评论区变成经验交换。" },
    ],
    whenToUse: "科普、职场、学习方法等'教人避坑/变好'的内容。",
    example: "「你背了十年单词还是不会说，问题根本不在记忆力」——痛点开场 + 干货拆解。",
    copyPath: "把你领域里最普遍的误区当标题，正文只给解决方法 + 一个可信来源，少讲故事多给结论。",
    tags: ["知识", "干货", "避坑", "方法论"],
  },
  {
    id: "travel-suspense",
    name: "悬念前置 × 视觉奇观 × 在地文化",
    category: "旅游",
    hookType: "悬念前置",
    formula: "悬念前置 × 视觉奇观 × 在地文化",
    factors: [
      { name: "悬念前置", weight: 35, tip: "开头丢一个'这个地方居然…'的悬念，逼人看完。" },
      { name: "视觉奇观", weight: 30, tip: "航拍、延时、极致风光，画面本身就要'哇'。" },
      { name: "在地文化", weight: 20, tip: "当地人才知道的小店 / 习俗，给观光客找不到的细节。" },
      { name: "互动钩子", weight: 15, tip: "结尾问'你去过几个'，引打卡欲评论。" },
    ],
    whenToUse: "小众目的地、City Walk、冷门玩法等旅游内容。",
    example: "「离北京两小时，藏着一个没人知道的彩色村子」——悬念 + 航拍奇观。",
    copyPath: "选一个反常识的目的地，前 3 秒用'居然'设悬念，中段用大景别砸视觉，结尾塞一个在地冷知识。",
    tags: ["旅游", "小众", "风光", "在地"],
  },
  {
    id: "commerce-result",
    name: "结果前置 × 信任证据 × 限时紧迫",
    category: "商业",
    hookType: "结果前置",
    formula: "结果前置 × 信任证据 × 限时紧迫",
    factors: [
      { name: "结果前置", weight: 35, tip: "开头直接亮战绩 / 效果，'30 天瘦了 8 斤'比过程更抓人。" },
      { name: "信任证据", weight: 30, tip: "截图、订单、前后对比，把'你说真的'坐实。" },
      { name: "限时紧迫", weight: 20, tip: "活动 / 库存的稀缺感，把犹豫变成下单。" },
      { name: "互动钩子", weight: 15, tip: "结尾'评论区扣 1 领攻略'，沉淀私域线索。" },
    ],
    whenToUse: "带货、种草、课程 / 服务推广等转化型内容。",
    example: "「靠这一招，我把客单价翻了三倍」——结果开场 + 后台截图佐证。",
    copyPath: "先抛一个亮眼结果当钩子，立刻跟上可信证据，最后用稀缺感收口引导行动。",
    tags: ["带货", "种草", "转化", "信任"],
  },
  {
    id: "emotion-arc",
    name: "情绪钩子 × 故事弧线 × 价值升华",
    category: "情感",
    hookType: "情绪钩子",
    formula: "情绪钩子 × 故事弧线 × 价值升华",
    factors: [
      { name: "情绪钩子", weight: 35, tip: "开头一个扎心的瞬间 / 画面，先让人心里一紧。" },
      { name: "故事弧线", weight: 30, tip: "困境→转折→和解，有起承转合的弧线才站得住。" },
      { name: "价值升华", weight: 20, tip: "结尾提炼一个普世价值（陪伴 / 勇气 / 接纳），便于转发。" },
      { name: "互动钩子", weight: 15, tip: "结尾'你身边也有这样的人吗'，引共鸣评论。" },
    ],
    whenToUse: "亲情、友情、成长、治愈系等强情绪叙事。",
    example: "「我爸偷偷学了一年智能手机，就为了给我发语音」——情绪开场 + 弧线收尾。",
    copyPath: "从一个真实扎心的瞬间切入，讲一个有转折的小故事，结尾点一个大家都认同的道理。",
    tags: ["情感", "叙事", "治愈", "共鸣"],
  },
  {
    id: "anti-common-sense",
    name: "反常识 × 拆解逻辑 × 行动清单",
    category: "知识",
    hookType: "反常识",
    formula: "反常识 × 拆解逻辑 × 行动清单",
    factors: [
      { name: "反常识", weight: 35, tip: "抛一个和大众认知相反的论点，'其实你一直做错了'。" },
      { name: "拆解逻辑", weight: 30, tip: "用因果链把'为什么错'讲透，让人服气。" },
      { name: "行动清单", weight: 20, tip: "给 3 条马上能做的改法，把认同变成行动。" },
      { name: "互动钩子", weight: 15, tip: "结尾'你中了几条'，引自测式评论。" },
    ],
    whenToUse: "思维模型、效率、认知提升等'颠覆常识'的内容。",
    example: "「多任务不是效率高，是让你每件都做烂」——反常识开场 + 拆解。",
    copyPath: "挑一个被广泛相信其实是错的认知，用逻辑拆穿它，最后给观众一份可立即执行的清单。",
    tags: ["认知", "反常识", "思维", "清单"],
  },
  {
    id: "local-food",
    name: "在地身份 × 真实体验 × 避坑指南",
    category: "美食",
    hookType: "身份共鸣",
    formula: "在地身份 × 真实体验 × 避坑指南",
    factors: [
      { name: "在地身份", weight: 35, tip: "以'本地人 / 老饕'身份带逛，天然可信。" },
      { name: "真实体验", weight: 30, tip: "现吃现拍、不摆拍，真实感比精致更重要。" },
      { name: "避坑指南", weight: 20, tip: "顺手点出'别去那家网红店'，价值感拉满。" },
      { name: "互动钩子", weight: 15, tip: "结尾'你们本地还有啥好吃的'，引补充评论。" },
    ],
    whenToUse: "探店、本地生活、城市美食地图等内容。",
    example: "「作为在这住了二十年的本地人，带你去吃真正好吃的」——身份开场 + 避坑。",
    copyPath: "用本地人视角带观众逛，只拍真吃的画面，结尾顺手给一条避坑建议立人设。",
    tags: ["探店", "本地生活", "避坑", "真实"],
  },
  {
    id: "comedy-reversal",
    name: "预期违背 × 节奏密集 × 反转收尾",
    category: "生活",
    hookType: "悬念前置",
    formula: "预期违背 × 节奏密集 × 反转收尾",
    factors: [
      { name: "预期违背", weight: 35, tip: "开头给一个看似正常的设定，马上拐弯打破预期。" },
      { name: "节奏密集", weight: 30, tip: "每 2-3 秒一个笑点 / 包袱，完播率靠密度。" },
      { name: "反转收尾", weight: 20, tip: "结尾再来一次大反转，让人想二刷找细节。" },
      { name: "互动钩子", weight: 15, tip: "结尾'你猜到最后了吗'，引讨论评论。" },
    ],
    whenToUse: "短剧、段子、生活搞笑等轻娱乐内容。",
    example: "「我室友说要早睡，结果凌晨三点在客厅跳健身操」——预期违背 + 反转。",
    copyPath: "先立一个正常预期，前 3 秒内打破它，中段密集丢包袱，结尾用反转把梗收圆。",
    tags: ["搞笑", "短剧", "反转", "节奏"],
  },
  {
    id: "startup-method",
    name: "痛点前置 × 方法论 × 案例佐证",
    category: "商业",
    hookType: "痛点前置",
    formula: "痛点前置 × 方法论 × 案例佐证",
    factors: [
      { name: "痛点前置", weight: 35, tip: "先戳创业者最痛的点，'你的项目死在这三步'。" },
      { name: "方法论", weight: 30, tip: "给一套可复用的框架 / 步骤，显得专业可落地。" },
      { name: "案例佐证", weight: 20, tip: "用一个真实成败案例验证方法，增强说服力。" },
      { name: "互动钩子", weight: 15, tip: "结尾'你的项目卡在哪一步'，引诊断式评论。" },
    ],
    whenToUse: "创业、商业分析、行业洞察等 B 端 / 老板向内容。",
    example: "「90% 的初创死在没验证需求，不是没技术」——痛点开场 + 方法论。",
    copyPath: "把目标人群最痛的问题放开头，给出一套通用方法论，再用一个案例证明它真的有效。",
    tags: ["创业", "商业", "方法论", "案例"],
  },
];

/** 按分类筛选（"全部" 返回全部） */
export function getFormulasByCategory(cat: "全部" | Category): FormulaTemplate[] {
  if (cat === "全部") return FORMULA_LIBRARY;
  return FORMULA_LIBRARY.filter((f) => f.category === cat);
}

/** 按 id 取单条 */
export function getFormulaById(id: string): FormulaTemplate | undefined {
  return FORMULA_LIBRARY.find((f) => f.id === id);
}

/**
 * 报告第五段 → 命中公式库中的模板（按主钩子类型关联）。
 * 无命中返回 undefined，调用方据此决定是否显示联动链接，避免空链接。
 */
export function matchFormulaForReport(opts: {
  hookType?: string;
  formula?: ViralFormula;
}): FormulaTemplate | undefined {
  const ht = opts.hookType?.trim();
  if (!ht) return undefined;
  return FORMULA_LIBRARY.find((f) => f.hookType === ht);
}
