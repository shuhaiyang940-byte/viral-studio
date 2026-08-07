// 热点跟踪数据层
// 说明：当前为示例数据。真实"实时热点"需由后台爬虫服务提供：
//   TODO(backend): 接入实时爬虫 API —— GET /api/hotspots?cat=<类目>
//   返回字段与本结构一致即可，UI 会自动替换。fetchHotspots() 是唯一切换点。

export type HotspotCat =
  | "搞笑"
  | "剧情"
  | "测评"
  | "美食"
  | "知识"
  | "颜值"
  | "萌宠"
  | "社会"
  | "游戏"
  | "带货"
  | "其他";

export const HOTSPOT_CATEGORIES: HotspotCat[] = [
  "搞笑",
  "剧情",
  "测评",
  "美食",
  "知识",
  "颜值",
  "萌宠",
  "社会",
  "游戏",
  "带货",
  "其他",
];

export interface Hotspot {
  id: string;
  title: string; // 热点 / 梗标题
  category: HotspotCat;
  platform: string; // 抖音 / 小红书 / B站 / 视频号 ...
  heat: number; // 热度指数
  summary: string; // 一句话梗点 / 笑点
  whyHot: string; // 为什么火
  tags: string[];
  updatedAt: string; // 更新时间
  url?: string; // 原帖链接（真实数据提供）
}

// 网站内持久化的「标题级」轻量记录（时间轴用，不含正文/详情）
export interface HotspotTitle {
  id: string;
  title: string;
  category: HotspotCat;
  platform: string;
  heat: number;
  url?: string;
  tags?: string[];
  date: string; // YYYY-MM-DD，所属时间轴日期
  capturedAt?: string;
  seed?: boolean; // true=示例历史（非真实爬虫）
}

// 用户点击后才生成并落盘的「详情」
export interface HotspotDetail {
  id: string;
  title: string;
  category: HotspotCat;
  platform: string;
  heat: number;
  url?: string;
  fetchedAt: string; // 首次生成时间
  clicks: number; // 被点击次数
  summary: string; // 结构化创作参考摘要
  angles: string[]; // 创作角度
  outline: string[]; // 大纲要点
  whyHot: string; // 为什么火
  sourceNote: string; // 来源说明（标注为非新闻原文）
}

// 时间轴响应
export interface HotspotTimeline {
  days: Record<string, HotspotTitle[]>;
  items: Hotspot[]; // 今日实时快照（高亮用）
  updatedAt: string;
  sources: Record<string, "ok" | "fail">;
  live: boolean; // true=实时数据，false=示例兜底
}

// 示例种子数据（标注：待接实时爬虫）
export const HOTSPOTS: Hotspot[] = [
  {
    id: "h1",
    title: "打工人嘴替合集",
    category: "搞笑",
    platform: "抖音",
    heat: 982,
    summary: "把职场崩溃瞬间用夸张配音说出来，每条都是共鸣弹幕。",
    whyHot: "情绪高度共鸣 + 低门槛二创，评论区全是'是我本人'。",
    tags: ["嘴替", "职场", "配音梗"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h2",
    title: "反向种草翻车现场",
    category: "测评",
    platform: "小红书",
    heat: 871,
    summary: "博主买了全网吹爆的神器，结果当场翻车，真实感拉满。",
    whyHot: "'说真话'人设 + 预期违背，完播率极高。",
    tags: ["翻车", "真实", "种草避雷"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h3",
    title: "3秒钩子开场挑战",
    category: "知识",
    platform: "B站",
    heat: 834,
    summary: "每条开头用'你绝对不知道…'制造信息缺口，留人。",
    whyHot: "信息缺口钩子是知识区通用爆款公式，可复制。",
    tags: ["钩子", "信息缺口", "知识区"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h4",
    title: "沉浸式做饭ASMR",
    category: "美食",
    platform: "视频号",
    heat: 812,
    summary: "无旁白，只有切菜油炸声，治愈系深夜流量王。",
    whyHot: "ASMR 天然高停留，适合挂车转化。",
    tags: ["ASMR", "治愈", "挂车"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h5",
    title: "猫主子的内心戏",
    category: "萌宠",
    platform: "抖音",
    heat: 905,
    summary: "给猫配人声内心独白，拟人化吐槽铲屎官。",
    whyHot: "萌宠 + 拟人台词，转发率极高。",
    tags: ["猫", "拟人", "配音"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h6",
    title: "逆袭爽文短剧",
    category: "剧情",
    platform: "抖音",
    heat: 956,
    summary: "前3集憋屈，第4集绝地反杀，付费点卡在情绪顶点。",
    whyHot: "情绪曲线设计成熟，付费转化模型清晰。",
    tags: ["爽文", "短剧", "反转"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h7",
    title: "素人改造前后对比",
    category: "颜值",
    platform: "小红书",
    heat: 789,
    summary: "左原图右成品，进度条滑动看变化，停留拉满。",
    whyHot: "视觉冲击 + '我也能'的代入感。",
    tags: ["改造", "对比", "颜值"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h8",
    title: "社会新闻温情反转",
    category: "社会",
    platform: "视频号",
    heat: 768,
    summary: "看似冲突的事件，结尾温情反转，引发转发。",
    whyHot: "情绪过山车 + 正能量收尾，易上推荐。",
    tags: ["反转", "温情", "正能量"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h9",
    title: "游戏名场面复刻",
    category: "游戏",
    platform: "B站",
    heat: 744,
    summary: "用现实道具还原游戏经典镜头，硬核又搞笑。",
    whyHot: "圈层认同强，弹幕互动高。",
    tags: ["名场面", "复刻", "整活"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h10",
    title: "工厂直供砍价实录",
    category: "带货",
    platform: "抖音",
    heat: 921,
    summary: "主播冲进仓库跟老板砍价，'源头价'人设立住。",
    whyHot: "'源头好货 + 现场砍价'信任感强，转化高。",
    tags: ["源头", "砍价", "信任"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h11",
    title: "反向凡尔赛吐槽",
    category: "搞笑",
    platform: "小红书",
    heat: 698,
    summary: "用'惨'的语气炫耀，反差幽默引发模仿。",
    whyHot: "格式极易二创，UGC 自传播。",
    tags: ["凡尔赛", "吐槽", "二创"],
    updatedAt: "2026-08-06",
  },
  {
    id: "h12",
    title: "冷知识暴击",
    category: "知识",
    platform: "抖音",
    heat: 712,
    summary: "一条一个反常识知识点，结尾留'下集更狠'。",
    whyHot: "系列化钩子，关注转化稳。",
    tags: ["冷知识", "反常识", "系列"],
    updatedAt: "2026-08-06",
  },
];

/**
 * 获取热点时间轴（按日期分组）。
 * 优先请求真实爬虫 API（/api/hotspots），失败时回退到「今日示例」时间轴。
 * 返回结构含 days（时间轴）与 items（今日实时快照）。
 */
export async function fetchHotspotTimeline(cat?: HotspotCat): Promise<HotspotTimeline> {
  try {
    const qs = cat ? `?cat=${encodeURIComponent(cat)}` : "";
    const res = await fetch(`/api/hotspots${qs}`, { cache: "no-store" });
    if (!res.ok) throw new Error("bad status " + res.status);
    const j = await res.json();
    if (j.days && Object.keys(j.days).length) {
      return {
        days: j.days as Record<string, HotspotTitle[]>,
        items: (j.items as Hotspot[]) || [],
        updatedAt: j.updatedAt,
        sources: j.sources ?? {},
        live: true,
      };
    }
  } catch {
    /* 走示例兜底 */
  }
  const today = new Date().toISOString().slice(0, 10);
  const titles: HotspotTitle[] = HOTSPOTS.map((h) => ({
    id: h.id,
    title: h.title,
    category: h.category,
    platform: h.platform,
    heat: h.heat,
    date: today,
    tags: h.tags,
  }));
  return { days: { [today]: titles }, items: HOTSPOTS, updatedAt: "", sources: {}, live: false };
}

/**
 * 懒加载热点详情：点击后才生成并落盘（服务端保证）。
 * 返回 null 表示未找到该热点（id 无效）。
 */
export async function fetchHotspotDetail(id: string): Promise<HotspotDetail | null> {
  try {
    const res = await fetch(`/api/hotspots?mode=detail&id=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as HotspotDetail;
  } catch {
    return null;
  }
}

export interface HotspotsInfo {
  updatedAt: string;
  sources: Record<string, "ok" | "fail">;
  live: boolean; // true=实时数据，false=示例兜底
}

/** 取热点页元信息（更新时间 + 各数据源状态），用于页面实时指示。 */
export async function fetchHotspotsInfo(): Promise<HotspotsInfo> {
  try {
    const res = await fetch(`/api/hotspots?meta=1`, { cache: "no-store" });
    if (!res.ok) throw new Error();
    const j = await res.json();
    return { updatedAt: j.updatedAt, sources: j.sources ?? {}, live: true };
  } catch {
    return { updatedAt: "", sources: {}, live: false };
  }
}
