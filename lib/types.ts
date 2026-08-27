export type MembershipTier = "free" | "creator" | "pro" | "studio";

export type Category = "生活" | "旅游" | "美食" | "情感" | "知识" | "商业";

export interface ScoreBreakdown {
  /** 综合评分 */
  overall: number;
  /** 开头吸引力 */
  hook: number;
  /** 内容价值 */
  value: number;
  /** 情绪感染 */
  emotion: number;
  /** 互动能力 */
  interaction: number;
}

export interface VideoMeta {
  title: string;
  type: string;
  publishedAt: string;
  duration: string;
  platform?: string;
  views?: number;
}

export interface StructureSegment {
  time: string;
  label: string;
  detail: string;
}

export interface ReportSection {
  /** 为什么这个视频火 */
  whyHot: string[];
  /** 视频结构拆解 */
  structure: StructureSegment[];
  /** 可复制模板 */
  replicableTemplate: {
    original: string;
    template: string;
  };
  /** 标题优化：10 个标题 */
  titles: string[];
  /** 拍摄建议 */
  shootingTips: {
    camera: string[];
    copy: string[];
    music: string[];
  };
}

/** 黄金 3 秒拆解：逐帧诊断开场钩子 */
export interface Golden3s {
  /** 钩子类型，如「身份共鸣」「反常识」「悬念」 */
  hookType: string;
  /** 前 3 秒的台词 / 画面脚本（脚本式，方便照抄） */
  transcript: string;
  /** 为什么这 3 秒能留人 */
  why: string;
  /** 给你的可落地改造建议 */
  rebuild: string[];
}

/** 情绪曲线上的一个点 */
export interface EmotionPoint {
  /** 时间（秒） */
  tSec: number;
  /** 该时间点的情绪强度 0-100 */
  level: number;
  /** 该段标签，如「铺垫」「冲突」「高潮」 */
  label: string;
}

/** 情绪曲线：随时间的情绪强度走向 */
export interface EmotionCurve {
  points: EmotionPoint[];
  /** 整体情绪走向说明（哪段回落、哪段峰值、为什么） */
  note: string;
}

/** 爆款公式提炼：从这条视频抽象出的可复制公式 */
export interface ViralFormula {
  /** 一句话公式，如「身份共鸣 × 具体细节 × 情绪升华」 */
  formula: string;
  /** 公式拆解的因子与权重 */
  factors: { name: string; weight: number; tip: string }[];
}

/** 爆款公式库：从真实案例沉淀、可跨视频复用的公式模板 */
export interface FormulaTemplate {
  id: string;
  name: string;
  category: Category;
  /** 主钩子类型，与 Golden3s.hookType 对齐，用于报告命中关联 */
  hookType: string;
  /** 一句话公式，如「身份共鸣 × 具体细节 × 情绪升华」 */
  formula: string;
  /** 公式拆解的因子与权重（weight 之和应为 100） */
  factors: { name: string; weight: number; tip: string }[];
  /** 适用场景 */
  whenToUse: string;
  /** 套用示例（一句话） */
  example: string;
  /** 复刻路径提示 */
  copyPath: string;
  tags: string[];
}

/** 剪辑特效难度 */
export type EffectDifficulty = "易" | "中" | "难";

/** 单条特效拆解：参考视频是否用到、难度、给普通人的建议 */
export interface EffectItem {
  name: string;
  used: boolean;
  difficulty: EffectDifficulty;
  tip: string;
}

/** 节奏分析的单个段落 */
export interface PacingSegment {
  time: string;
  label: string;
  durationSec: number;
}

/** 节奏分析：钩子时长、平均镜头、高潮点、卡点、段落、建议 */
export interface PacingInfo {
  hookSeconds: number;
  avgShotSeconds: number;
  climaxAtSec: number;
  beatSync: boolean;
  segments: PacingSegment[];
  suggestion: string;
}

/** 新手摸底档案：分析前收集，用于给出对口建议 */
export interface OnboardingProfile {
  /** 剪辑基础 */
  level: "novice" | "beginner" | "intermediate";
  /** 常用工具 */
  tools: string[];
  /** 内容方向 */
  contentTypes: string[];
  /** 主要平台 */
  platforms: string[];
  /** 每周投入时间 */
  weeklyHours: string;
  /** 最想解决的痛点 */
  painPoints: string[];
  /** 创作风格 / 人设 —— 决定写文案时的文风（严谨客观 / 轻松幽默 ...） */
  style: string;
  /** 目标受众 / 领域 */
  audience: string;
}

/** 创作风格（写文案时的文风基调） */
export const CREATOR_STYLES = [
  "严谨客观",
  "轻松幽默",
  "犀利毒舌",
  "温柔治愈",
  "热血励志",
  "专业深度",
] as const;

/** 受众 / 领域选项 */
export const AUDIENCE_OPTIONS = [
  "泛大众",
  "职场人群",
  "学生党",
  "宝妈家庭",
  "业内人士",
  "银发族",
] as const;

/** 参考视频可选类型（演示模式下由用户指定，接真 AI 后由视频识别覆盖） */
export const REFERENCE_TYPES = [
  "生活记录 / 情感向",
  "知识科普",
  "好物种草",
  "剧情短片",
  "测评对比",
] as const;

/** 目标与参考不匹配的明确警告 */
export interface MismatchInfo {
  /** 用户想做的内容，如「电影解说」 */
  userGoal: string;
  /** 参考视频实际类型，如「生活记录 / 情感向」 */
  refType: string;
  /** 直给的 blunt 警告语 */
  message: string;
  /** 解释为什么两个方向手法不同（军师式，点明 craft 差异） */
  reason?: string;
}

import type { VideoUnderstanding } from "./video-fact";

export interface AnalysisReport {
  id: string;
  meta: VideoMeta;
  score: ScoreBreakdown;
  section: ReportSection;
  /** 黄金 3 秒拆解（Mock 必填；真实模型按返回情况可选） */
  golden3s?: Golden3s;
  /** 情绪曲线（Mock 必填；真实模型按返回情况可选） */
  emotionCurve?: EmotionCurve;
  /** 爆款公式提炼（Mock 必填；真实模型按返回情况可选） */
  formula?: ViralFormula;
  /** 特效拆解（Mock 必填；真实模型按返回情况可选） */
  effects?: EffectItem[];
  /** 节奏分析（Mock 必填；真实模型按返回情况可选） */
  pacing?: PacingInfo;
  /** 生成该报告时用户的新手档案（用于个性化建议） */
  profile?: OnboardingProfile;
  /** 当用户目标与参考视频明显不符时的 blunt 警告 */
  mismatch?: MismatchInfo;
  /** 精品化手法门槛：小红书/抖音精品路线必须过的关卡（节奏/音效音乐/色彩） */
  premium?: PremiumInfo;
  /** 按用户画像生成的复现路径：照抄 / 套模板 / 需补素材 + 素材音效音乐清单 */
  repro?: ReproPlan;
  /** 链接模式抓取的参考信号（评论 + 标签），仅作参考、不当答案 */
  signal?: ReferenceSignal;
  /** 提分目标：帮普通人从不及格到 70、及格到 80 */
  scoreTarget?: ScoreTarget;
  /** 分镜蓝图：参考视频逐镜头怎么拍（手把手教拍第一层） */
  storyboard?: ShotBlueprint[];
  /** 主题适配：换成你的主题，每一镜怎么拍（手把手教拍第二层） */
  adaptedPlan?: AdaptedPlan;
  /** 真实视频理解信息（上传分析时返回，用于诚实展示分析依据） */
  visual?: {
    mode: "real" | "mock" | "none";
    frameCount: number;
    note: string;
    /** 语音转写文本（真实 ASR 成功时返回） */
    transcript?: string;
  };
  /** 视频理解完整性/覆盖度（Phase 16.10：诚实展示系统是否真正读到视频） */
  understanding?: VideoUnderstanding;
  createdAt: string;
}

/** 精品化手法门槛 */
export interface PremiumInfo {
  /** 节奏门槛 */
  rhythm: string[];
  /** 音效 / 音乐门槛 */
  audio: string[];
  /** 色彩门槛 */
  color: string[];
}

/** 复现路径：根据新手画像给出的落地方案 */
export interface ReproPlan {
  /** 照抄 / 套模板 / 需补素材 */
  path: "照抄" | "套模板" | "需补素材";
  /** 为什么是这个路径（军师式） */
  advice: string;
  /** 需要的素材类型 */
  shots: string[];
  /** 需要的音效 */
  sfx: string[];
  /** 需要的音乐方向 */
  music: string[];
}

/** 链接模式抓取的参考信号（公开标签 / 话题 + 高赞评论），只作参考、不当答案 */
export interface ReferenceSignal {
  /** 来源平台，由链接识别（抖音 / 小红书 / B站 / 视频号） */
  platform: string;
  /** 从公开标签 / 话题提取的内容标签 */
  tags: string[];
  /** 高赞样本评论（仅采样，不代表全量） */
  comments: { text: string; like?: number }[];
  /** 说明：这些信号仅供参考，不是结论 */
  note: string;
  /** 数据可信度标记：DEMO 表示演示数据，禁止作为真实学习样本进入知识库 */
  sourceStatus?: "DEMO" | "OK" | "PARTIAL" | "SOURCE_UNAVAILABLE" | "NO_DATA";
}

/** 提分目标：帮普通人从不及格→70、及格→80 的补齐清单 */
export interface ScoreTarget {
  /** 当前综合分 */
  current: number;
  /** 目标分（70 / 80 / 85） */
  target: number;
  /** 目标档位描述（不及格→70 / 及格→80 / 良好→85+） */
  band: string;
  /** 还差的维度 + 补齐建议 */
  gaps: { dimension: string; tip: string }[];
  /** 给用户的整体提分路径 */
  advice: string;
}

/** 分镜蓝图：参考视频的逐镜头拆解（手把手教拍的第一层：「他这条是怎么拍的」） */
export interface ShotBlueprint {
  /** 镜头序号（从 1 开始） */
  index: number;
  /** 时间点，如「0-3 秒」 */
  time: string;
  /** 所属段落：钩子 / 铺垫 / 展开 / 高潮 / 收尾 */
  phase: string;
  /** 场景，如「胡同入口 · 日外」 */
  scene: string;
  /** 画面拍什么 */
  visual: string;
  /** 台词 / 旁白（脚本式，可照念） */
  line: string;
  /** 运镜 / 机位，如「固定机位特写」 */
  camera: string;
  /** 音效 / BGM 提示 */
  sfx: string;
  /** 为什么这样拍（这一镜的目的） */
  why: string;
  difficulty: "易" | "中" | "难";
}

/** 主题适配的单个镜头：参考镜头 → 换成你的主题怎么拍 */
export interface AdaptedShot {
  index: number;
  phase: string;
  /** 参考镜头在做什么 */
  reference: string;
  /** 换成你的主题后拍什么 */
  yourVersion: string;
  /** 手把手拍摄步骤（照着做就能拍） */
  howToFilm: string[];
  difficulty: "易" | "中" | "难";
}

/** 主题适配计划：把参考视频逐镜头翻译成「你的版本」 */
export interface AdaptedPlan {
  /** 你的主题（来自档案 / 输入） */
  userTopic: string;
  /** 整体说明（为什么这样改） */
  note: string;
  shots: AdaptedShot[];
}

export interface LibraryItem {
  id: string;
  title: string;
  category: Category;
  cover: string;
  views: number;
  score: number;
  summary: string;
  tags: string[];
}

export interface HistoryItem {
  id: string;
  title: string;
  createdAt: string;
  score: number;
  status: "done" | "processing";
}

/** 分镜示意图的人数布局（前端据此画简易 SVG） */
export type ShotLayout = "single" | "duo" | "group";
/** 分镜视角 / 运镜方向（用于画运镜箭头） */
export type ShotAngle = "eye" | "high" | "low" | "close" | "pan" | "wide";

/** 导演分镜：单个镜头 */
export interface StoryboardShot {
  /** 镜头序号（从 1 开始） */
  index: number;
  /** 所属段落（钩子 / 铺垫 / 展开 / 高潮） */
  phase: string;
  /** 场景，如「胡同入口 · 日外」 */
  scene: string;
  /** 人物 / 角色，如「主角（第一人称）」「邻居」 */
  characters: string[];
  /** 时长（秒） */
  durationSec: number;
  /** 运镜说明，如「固定机位特写」 */
  camera: string;
  /** 视角，用于示意图箭头 */
  angle: ShotAngle;
  /** 人数布局，用于示意图人物站位 */
  layout: ShotLayout;
  /** 注意事项 */
  note: string;
}

/** 一套导演分镜（由某次分析报告派生，或是由「需求入口」直接生成） */
export interface Storyboard {
  id: string;
  reportId: string;
  title: string;
  createdAt: string;
  shots: StoryboardShot[];
  totalDurationSec: number;
  /** 来源：分析报告派生 / 需求入口直接生成（影响分镜页的按钮展示） */
  source?: "analysis" | "brief";
}

/** 需求入口收集的最小信息（用于从需求直接生成 AI 分镜） */
export interface BriefInput {
  /** 想法类型：卖货 / 口播 / 其他 —— 与 benchmarks.IdeaType 对齐 */
  ideaType: "sell" | "talk" | "other";
  /** 类目，如「美妆」「食品」「本地生活」 */
  category: string;
  /** 目标，如「带货转化」「涨粉」「引流到店」 */
  goal: string;
  /** 想要的风格标签 */
  styles: string[];
  /** 想要的效果标签 */
  effects: string[];
  /** 货品种类（仅卖货类） */
  productType?: string;
  /** 露脸偏好 */
  face: "face" | "noface" | "any";
  /** 用户给的标题（可空，空则取套路默认标题） */
  title: string;
}

/** 智能剪辑方案记录（由某次分析自动生成骨架后留痕，供后台聚合展示） */
export interface EditPlanRecord {
  id: string;
  reportId: string;
  title: string;
  createdAt: string;
  /** 骨架段落数（占位镜头数） */
  segmentCount: number;
}

/** 我的 AI 导演：基于用户档案 + 历史分析记录的长期优化建议（规则驱动，纯前端） */
export interface DirectorAdvice {
  /** 是否具备生成条件（有档案或历史记录） */
  ready: boolean;
  /** 定位诊断（一句话结论） */
  diagnosis: string;
  /** 优先优化建议（3-5 条，按优先级排序） */
  priorities: string[];
  /** 本周内容方向建议（3 个选题角度） */
  weeklyTopics: { angle: string; why: string }[];
  /** 基于历史报告的进步轨迹（历史足够时给出） */
  progress?: {
    /** 已分析视频数 */
    analyzed: number;
    /** 平均综合分 */
    avgScore: number;
    /** 与首条对比的趋势 */
    trend: "up" | "down" | "flat";
    /** 轨迹说明 */
    note: string;
  };
  /** 还缺什么数据才能给更准的建议 */
  missingHint?: string;
}

/** 复刻助手：单个分镜镜头 */
export interface ReplicaShot {
  /** 镜头序号（从 1 开始） */
  index: number;
  /** 段落：钩子 / 铺垫 / 展开 / 高潮 / 收尾 */
  phase: string;
  /** 画面描述（拍什么） */
  visual: string;
  /** 台词 / 旁白（脚本式，可照念） */
  line: string;
  /** 时长（秒） */
  durationSec: number;
  /** 音效 / BGM 提示 */
  sfx: string;
}

/** 复刻助手：按行业一键生成的短视频方案 */
export interface ReplicaResult {
  /** 套用自公式库的哪条公式 */
  basedOnFormula: FormulaTemplate;
  /** 前 3 秒钩子（脚本式，可照抄） */
  hook: string;
  /** 主标题 */
  title: string;
  /** 备选标题（含主标题共 N 条） */
  titles: string[];
  /** 分镜表 */
  shots: ReplicaShot[];
  /** 复刻路径提示（来自公式库 copyPath） */
  copyPath: string;
  /** 落地提示（设备 / 时长 / 发布建议） */
  tips: string[];
}
