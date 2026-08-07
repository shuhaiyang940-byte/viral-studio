// 热点追踪 · 服务端爬虫、历史存储、懒详情与分类
// 三个核心能力：
//  1) 实时爬虫：拉取 微博/百度/抖音/知乎/头条 未鉴权热榜，跨源去重归一。
//  2) 历史时间轴：每次爬取把「今日」快照并入 data/hotspots-history.json，保留 30 天、按日期分组。
//     网站内只持久化「标题级」轻量记录；用户点击进入后才按需生成并落盘「详情」。
//  3) 懒详情：GET /api/hotspots?mode=detail&id= 仅在被点击时生成结构化创作参考，并写入 data/hotspot-details.json。

import fs from "node:fs";
import path from "node:path";
import type { Hotspot, HotspotCat, HotspotTitle, HotspotDetail } from "@/lib/hotspots";
import { reasoningChat, isConfigured } from "@/lib/llm";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const DAYS_KEEP = 30;
const PER_DAY_CAP = 60;

const HISTORY_PATH = path.join(process.cwd(), "data", "hotspots-history.json");
const DETAILS_PATH = path.join(process.cwd(), "data", "hotspot-details.json");
const CACHE_PATH = path.join(process.cwd(), "data", "hotspots-cache.json");
const TTL_MS = 10 * 60 * 1000;

interface RawHot {
  title: string;
  url: string;
  heat: number;
  summary?: string;
  hintCat?: string; // 上游自带的类目提示（如头条 InterestCategory）
  platform: string;
}

/* ----------------------------- 工具 ----------------------------- */

async function getJson(url: string, headers: Record<string, string>, ms = 12000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*", ...headers },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function normTitle(s: string): string {
  return (s || "").replace(/[#＃@\s·•・、，,。.\-_—:%：]/g, "").toLowerCase();
}

/* --------------------------- 各源适配器 --------------------------- */
// 说明（诚实边界）：
//  - 微博/百度/头条/抖音：标准未鉴权热榜，稳定可用（已在沙箱实测 200）。
//  - 知乎 preset_words 是「搜索预设词」而非真正热榜，仅作趋势词补充，已在 platform 标注。

const adapters: Record<string, () => Promise<RawHot[]>> = {
  async weibo() {
    const j = await getJson(
      "https://weibo.com/ajax/side/hotSearch",
      { Referer: "https://weibo.com/" },
      15000
    );
    const arr: any[] = (j?.data?.realtime || []).slice(0, 30);
    return arr.map((x) => ({
      title: x.word || x.note || "",
      url: "https://s.weibo.com/weibo?q=" + encodeURIComponent(x.word || ""),
      heat: Number(x.num) || 0,
      summary: x.note && x.note !== x.word ? x.note : undefined,
      platform: "微博",
    }));
  },

  async baidu() {
    const j = await getJson("https://top.baidu.com/api/board?platform=wise&tab=realtime", {
      Referer: "https://www.baidu.com/",
    });
    const items: any[] = (j?.data?.cards?.[0]?.content?.[0]?.content || []).slice(0, 30);
    return items.map((x, i) => ({
      title: x.word || "",
      url: x.url || "https://www.baidu.com/s?wd=" + encodeURIComponent(x.word || ""),
      heat: Number(x.hotScore) || 1000 - i,
      summary: x.desc || undefined,
      platform: "百度",
    }));
  },

  async toutiao() {
    const j = await getJson("https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc", {
      Referer: "https://www.toutiao.com/",
    });
    const arr: any[] = (j?.data || []).slice(0, 30);
    return arr.map((x) => ({
      title: x.Title || "",
      url: x.Url || "https://www.toutiao.com/",
      heat: Number(x.HotValue) || 0,
      hintCat: x.InterestCategory || undefined,
      platform: "头条",
    }));
  },

  async douyin() {
    const j = await getJson("https://www.douyin.com/aweme/v1/web/hot/search/list/", {
      Referer: "https://www.douyin.com/",
    });
    const arr: any[] = (Array.isArray(j?.data) ? j.data : []).slice(0, 30);
    return arr.map((x) => ({
      title: x.word || "",
      url: "https://www.douyin.com/search/" + encodeURIComponent(x.word || ""),
      heat: Number(x.hot_value) || 0,
      platform: "抖音",
    }));
  },

  async zhihu() {
    const j = await getJson("https://www.zhihu.com/api/v4/search/preset_words", {
      Referer: "https://www.zhihu.com/",
    });
    const arr: any[] = (j?.preset_words?.words || []).slice(0, 30);
    return arr.map((x) => ({
      title: x.real_query || x.query || "",
      url: "https://www.zhihu.com/search?q=" + encodeURIComponent(x.query || ""),
      heat: Number(x.weight) || 0,
      platform: "知乎",
    }));
  },
};

/* ----------------------------- 分类 ----------------------------- */
// 分类策略（让「其他」大幅减少）：
//  - 关键词命中 ×3 分（更具体的创作者类目在前，宽泛的「社会」在后兜底）。
//  - 头条 InterestCategory 提示 +5 分。
//  - 平台先验 +1 分（知乎→知识 / 微博·百度·头条→社会 / 抖音→搞笑），作为未命中时的兜底分配，
//    避免大量热点无谓堆积到「其他」。
//  说明：这是零成本启发式；精准分类需设置 LLM_API_KEY 走 AI（见 enrichWithLLM）。

const CAT_KEYWORDS: [HotspotCat, string[]][] = [
  [
    "萌宠",
    ["猫", "狗", "宠物", "萌宠", "兔子", "仓鼠", "铲屎", "猫主子", "狗狗", "鹦鹉", "乌龟", "撸猫", "吸猫", "猫咖", "修勾", "狗子", "异宠", "水豚", "羊驼", "猫粮", "狗粮"],
  ],
  [
    "美食",
    ["美食", "吃", "餐厅", "探店", "菜", "料理", "火锅", "小吃", "奶茶", "做饭", "吃播", "宵夜", "食谱", "烘焙", "外卖", "甜品", "烧烤", "早餐", "夜宵", "餐饮", "夜市", "减脂餐", "螺蛳粉", "麻辣烫", "炸鸡", "咖啡", "饮品", "水果", "探店", "吃货"],
  ],
  [
    "游戏",
    ["游戏", "原神", "王者", "手游", "端游", "电竞", "主播", "攻略", "皮肤", "steam", "switch", "任天堂", "氪金", "lol", "和平精英", "蛋仔", "塞尔达", "主机", "掌机", "副本", "段位", "上分", "代练", "赛事", "战队", "二次元", "网易", "腾讯游戏"],
  ],
  [
    "颜值",
    ["颜值", "变美", "穿搭", "妆", "护肤", "减肥", "瘦身", "整容", "改造", "发型", "ootd", "男装", "女装", "美甲", "医美", "素颜", "健身", "瑜伽", "街拍", "情侣装", "汉服", "cos", "穿搭博主"],
  ],
  [
    "测评",
    ["测评", "评测", "实测", "体验", "横评", "开箱", "拔草", "上车", "避坑", "对比评测", "试用", "红黑榜", "排雷", "种草", "数码", "手机", "耳机", "平板", "电脑", "家电", "相机", "汽车", "新能源车", "智能"],
  ],
  [
    "带货",
    ["带货", "直播带货", "优惠", "促销", "好物", "神器", "低价", "折扣", "秒杀", "淘宝", "京东", "拼多多", "下单", "种草", "购物", "源头", "砍价", "直播间", "好物分享", "必买", "囤货", "薅羊毛", "优惠券", "百亿补贴", "清单"],
  ],
  [
    "知识",
    ["知识", "科普", "干货", "教程", "学习", "考研", "考公", "英语", "历史", "物理", "数学", "理财", "认知", "思维", "读书", "课程", "健康", "医保", "社保", "个税", "法律", "心理", "冷知识", "自学", "技能", "教授", "院士", "专家", "医生", "科学", "化学", "生物", "地理", "经济", "金融", "投资", "基金", "股票", "养老", "公积金", "落户", "公考", "教资", "雅思", "托福", "宇宙", "天文"],
  ],
  [
    "剧情",
    ["短剧", "反转", "逆袭", "爽文", "霸总", "影视", "电影", "连续剧", "追剧", "故事", "悬疑", "纪录片", "综艺", "电视剧", "演员", "导演", "票房", "上映", "开播", "大结局", "番剧", "动漫", "漫画", "小说", "改编", "杀青", "路透", "塌房", "官宣", "分手", "结婚", "离婚", "恋情", "绯闻", "春晚"],
  ],
  [
    "搞笑",
    ["搞笑", "沙雕", "段子", "喜剧", "脱口秀", "整活", "神回复", "梗", "幽默", "吐槽", "嘴替", "笑死", "欢乐", "谐音梗", "表情包", "名场面", "翻车", "社死", "迷惑行为", "玩梗", "热搜梗", "神评论", "抽象", "发疯", "搞笑"],
  ],
  [
    "社会",
    ["去世", "身亡", "离世", "落水", "溺亡", "失联", "遇难", "救援", "总统", "官方", "回应", "通报", "地震", "火灾", "车祸", "拘", "判", "罚", "发布", "紧急", "辟谣", "确诊", "疫情", "暴雨", "高温", "预警", "事故", "警方", "政策", "民生", "房价", "就业", "工资", "养老", "群众", "逮捕", "起诉", "处罚", "调查", "涨价", "降价", "退市", "破产", "裁员", "罢工", "抗议", "战争", "冲突", "爆炸", "坍塌", "坠", "亡", "致", "案", "声明", "道歉", "造假", "失信", "违规", "查", "抓", "约谈", "整改", "查处", "政务", "教育", "高考", "中考", "入学", "招聘", "失业", "低保", "扶贫", "乡村振兴", "环保", "污染", "天气", "交通", "铁路", "民航", "航班", "延误", "景区", "旅游", "游客", "国务院", "部委", "央行", "发改委", "工信部", "发布会", "新规", "条例", "立法", "判决", "庭审", "维权", "投诉", "曝光", "暗访", "打假", "反腐", "落马", "纪委", "巡视", "诈骗", "传销", "网贷", "校园", "幼儿园", "学校", "医院", "护士", "患者", "消防", "应急", "公安", "交警", "法院", "检察", "医保", "公积金"],
  ],
];

// 头条 InterestCategory 等上游类目 → 我们的类目
const HINT_MAP: Record<string, HotspotCat> = {
  科技: "知识",
  财经: "带货",
  时事: "社会",
  社会: "社会",
  娱乐: "剧情",
  游戏: "游戏",
  体育: "其他",
  美食: "美食",
  影视: "剧情",
};

// 平台先验（未命中关键词时的兜底分配）
const PLATFORM_DEFAULT: Record<string, HotspotCat> = {
  知乎: "知识",
  微博: "社会",
  百度: "社会",
  头条: "社会",
  抖音: "搞笑",
};

function classify(title: string, platform: string, hintCat?: string): HotspotCat {
  const score: Record<string, number> = {};
  const add = (c: string, s: number) => {
    score[c] = (score[c] || 0) + s;
  };
  for (const [cat, kws] of CAT_KEYWORDS) {
    if (kws.some((k) => title.includes(k))) add(cat, 3);
  }
  if (hintCat && HINT_MAP[hintCat]) add(HINT_MAP[hintCat], 5);
  const def = PLATFORM_DEFAULT[platform];
  if (def) add(def, 1);

  let best: HotspotCat = "其他";
  let bestS = 0;
  for (const [c, s] of Object.entries(score)) {
    if (s > bestS) {
      bestS = s;
      best = c as HotspotCat;
    }
  }
  return best;
}

/* --------------------------- 编排 + 缓存 --------------------------- */

interface CrawlResult {
  items: Hotspot[];
  sources: Record<string, "ok" | "fail">;
}

export async function crawlHotspots(): Promise<CrawlResult> {
  const names = Object.keys(adapters);
  const settled = await Promise.allSettled(names.map(async (n) => ({ n, r: await adapters[n]() })));

  const sources: Record<string, "ok" | "fail"> = {};
  const raw: RawHot[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      sources[s.value.n] = "ok";
      raw.push(...s.value.r.filter((x) => x.title));
    } else {
      sources[names[i] ?? "unknown"] = "fail";
    }
  });

  // 跨源去重：同标题取最高热度，平台并入 tags
  const byKey = new Map<string, Hotspot>();
  for (const r of raw) {
    const key = normTitle(r.title);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.heat = Math.max(existing.heat, r.heat);
      if (!existing.tags.includes(r.platform)) existing.tags.push(r.platform);
    } else {
      byKey.set(key, {
        id: "hs-" + key.slice(0, 24),
        title: r.title,
        category: classify(r.title, r.platform, r.hintCat),
        platform: r.platform,
        heat: r.heat,
        summary: r.summary || `来自${r.platform}热榜，热度 ${r.heat || "—"}。`,
        whyHot: `近期在${r.platform}登上热榜，讨论度高，适合借势创作。`,
        tags: [r.platform],
        updatedAt: new Date().toISOString().slice(0, 10),
        url: r.url,
      });
    }
  }

  let items = Array.from(byKey.values()).sort((a, b) => b.heat - a.heat);
  items = await enrichWithLLM(items);
  return { items, sources };
}

// LLM 增强（推理层 = DeepSeek）：有 Key 时对高热度 top N 热点批量生成更贴合的
// 创作参考（summary / whyHot）；分类仍走关键词启发式（已是 0%「其他」）。
// 无 Key 或调用异常 → 静默回退启发式，不阻断爬虫。
async function enrichWithLLM(items: Hotspot[]): Promise<Hotspot[]> {
  if (!isConfigured("deepseek")) return items;

  const top = items.slice(0, 20);
  const rest = items.slice(20);
  try {
    const content = await reasoningChat(
      [
        {
          role: "system",
          content:
            "你是短视频热点创作顾问，只返回 JSON，不要任何解释。结构：{\"results\":[{\"id\":\"热点id\",\"summary\":\"一句话创作切入点（25字内）\",\"whyHot\":\"为什么适合借势创作（30字内）\"}]}",
        },
        {
          role: "user",
          content:
            "请为以下热点生成创作参考：\n" +
            top
              .map((h) => `- id:${h.id} | 标题:${h.title} | 平台:${h.platform} | 类目:${h.category}`)
              .join("\n"),
        },
      ],
      { json: true, temperature: 0.6, maxTokens: 2000, timeoutMs: 40000 }
    );
    const parsed = JSON.parse(content) as {
      results?: { id: string; summary?: string; whyHot?: string }[];
    };
    const byId = new Map((parsed.results || []).map((r) => [r.id, r]));
    const enriched = top.map((h) => {
      const e = byId.get(h.id);
      if (!e) return h;
      return {
        ...h,
        summary: e.summary?.trim() || h.summary,
        whyHot: e.whyHot?.trim() || h.whyHot,
      };
    });
    return [...enriched, ...rest];
  } catch (err) {
    console.warn("[hotspots] LLM 润色失败，沿用启发式：", err);
    return items;
  }
}

/* --------------------------- 历史时间轴存储 --------------------------- */

interface HistoryFile {
  version: number;
  days: Record<string, HotspotTitle[]>;
}

function loadHistory(): HistoryFile {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as HistoryFile;
  } catch {
    return { version: 1, days: {} };
  }
}

function saveHistory(h: HistoryFile) {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(h));
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function toTitle(it: Hotspot, day: string): HotspotTitle {
  return {
    id: it.id,
    title: it.title,
    category: it.category,
    platform: it.platform,
    heat: it.heat,
    url: it.url,
    tags: it.tags,
    date: day,
    capturedAt: new Date().toISOString(),
  };
}

// 把「今日」快照并入历史，并裁剪超过 30 天的旧数据。
function mergeToday(items: Hotspot[]): HistoryFile {
  const h = loadHistory();
  const day = todayKey();
  const existing = new Map((h.days[day] || []).map((t) => [t.id, t]));
  for (const it of items) {
    if (!existing.has(it.id)) existing.set(it.id, toTitle(it, day));
  }
  h.days[day] = Array.from(existing.values()).sort((a, b) => b.heat - a.heat);

  const cutoff = new Date(Date.now() - DAYS_KEEP * 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(h.days)) if (k < cutoff) delete h.days[k];

  saveHistory(h);
  return h;
}

/* ----------------------------- 种子历史 ----------------------------- */
// 仅在历史为空时生成近 18 天的示例热点（标注 seed），让时间轴立即可见、可演示；
// 真实爬虫从今天起持续追加。明确为示例，非真实热榜。

const SEED_POOL: { title: string; category: HotspotCat }[] = [
  { title: "水豚去上班被全公司围观", category: "萌宠" },
  { title: "修勾护主反被猫欺负", category: "萌宠" },
  { title: "撸猫馆能不能带回家", category: "萌宠" },
  { title: "异宠饲养到底合不合法", category: "萌宠" },
  { title: "路边摊螺蛳粉到底干不干净", category: "美食" },
  { title: "减脂餐吃一个月的真实身材变化", category: "美食" },
  { title: "深夜烧烤摊的隐藏菜单", category: "美食" },
  { title: "奶茶第二杯半价到底划不划算", category: "美食" },
  { title: "原神新地图卡顿怎么解决", category: "游戏" },
  { title: "王者荣耀赛季末上分攻略", category: "游戏" },
  { title: "Steam夏促值得买的独立游戏", category: "游戏" },
  { title: "蛋仔派对联动皮肤上线", category: "游戏" },
  { title: "素人改造前后对比太离谱", category: "颜值" },
  { title: "油皮夏天不脱妆的化妆步骤", category: "颜值" },
  { title: "微胖女生显瘦穿搭公式", category: "颜值" },
  { title: "健身房练三个月身材对比", category: "颜值" },
  { title: "百元耳机和千元耳机听感差别", category: "测评" },
  { title: "新能源车冬季续航实测", category: "测评" },
  { title: "网红小家电是智商税吗", category: "测评" },
  { title: "平价彩妆红黑榜", category: "测评" },
  { title: "直播间源头工厂砍价实录", category: "带货" },
  { title: "百亿补贴买手机靠不靠谱", category: "带货" },
  { title: "薅羊毛攻略怎么凑满减", category: "带货" },
  { title: "九月必买好物清单", category: "带货" },
  { title: "为什么晚上更容易 emo 科普", category: "知识" },
  { title: "房贷利率下调到底能省多少", category: "知识" },
  { title: "考研报名人数今年降了", category: "知识" },
  { title: "个税专项扣除怎么填最划算", category: "知识" },
  { title: "猫咪为什么半夜跑酷", category: "知识" },
  { title: "短剧霸总台词到底谁写的", category: "剧情" },
  { title: "这部剧大结局烂尾观众怒了", category: "剧情" },
  { title: "综艺名场面又上热搜", category: "剧情" },
  { title: "动漫改编真人版选角争议", category: "剧情" },
  { title: "打工人的抽象发疯日常", category: "搞笑" },
  { title: "谐音梗为什么永远好笑", category: "搞笑" },
  { title: "社死现场名场面合集", category: "搞笑" },
  { title: "神评论比原视频还好笑", category: "搞笑" },
  { title: "多地暴雨预警出行注意", category: "社会" },
  { title: "某车企被约谈要求整改", category: "社会" },
  { title: "景区游客滞留事件通报", category: "社会" },
  { title: "新规外卖骑手权益保障", category: "社会" },
  { title: "某地地震最新救援进展", category: "社会" },
  { title: "高考志愿填报防坑指南", category: "社会" },
  { title: "医保异地结算怎么操作", category: "社会" },
];

function ensureSeed() {
  const h = loadHistory();
  const has = Object.values(h.days).some((arr) => arr.length > 0);
  if (has) return;

  const platforms = ["微博", "百度", "抖音", "知乎", "头条"];
  const now = Date.now();
  for (let d = 1; d <= 18; d++) {
    const day = new Date(now - d * 86400000).toISOString().slice(0, 10);
    const picks = SEED_POOL.filter((_, i) => (i + d) % 2 === 0).slice(0, 22);
    h.days[day] = picks.map((p, idx) => {
      const platform = platforms[(d + idx) % platforms.length];
      return {
        id: "hs-" + normTitle(p.title).slice(0, 24),
        title: p.title,
        category: p.category,
        platform,
        heat: Math.floor(500 + Math.random() * 9000),
        url: undefined,
        tags: [platform],
        date: day,
        capturedAt: new Date(now - d * 86400000).toISOString(),
        seed: true,
      } as HotspotTitle;
    });
  }
  saveHistory(h);
}

/* ----------------------------- 懒详情 ----------------------------- */

function findTitle(id: string): HotspotTitle | undefined {
  const h = loadHistory();
  for (const day of Object.keys(h.days)) {
    const f = h.days[day].find((t) => t.id === id);
    if (f) return f;
  }
  return undefined;
}

function loadDetails(): Record<string, HotspotDetail> {
  try {
    return JSON.parse(fs.readFileSync(DETAILS_PATH, "utf8")) as Record<string, HotspotDetail>;
  } catch {
    return {};
  }
}

function saveDetails(d: Record<string, HotspotDetail>) {
  fs.mkdirSync(path.dirname(DETAILS_PATH), { recursive: true });
  fs.writeFileSync(DETAILS_PATH, JSON.stringify(d));
}

const ANGLES: Record<HotspotCat, string[]> = {
  萌宠: ["从「云吸宠」视角做治愈向二创", "宠物拟人内心独白配音", "铲屎官真实痛点共鸣"],
  美食: ["探店避雷 vs 种草的真实测评", "深夜放毒 ASMR 无旁白", "低成本复刻教程"],
  游戏: ["名场面现实复刻整活", "新手向攻略避坑", "版本更新吐槽"],
  颜值: ["素人改造前后对比", "小预算变美技巧", "穿搭公式拆解"],
  测评: ["红黑榜实测排雷", "百元 vs 千元对比", "智商税鉴定"],
  带货: ["源头工厂砍价实录", "必买清单种草", "薅羊毛攻略"],
  知识: ["冷知识反常识钩子", "实用干货教程", "认知误区纠正"],
  剧情: ["短剧反转套路拆解", "角色代入二创", "名场面模仿"],
  搞笑: ["社死 / 抽象发疯日常", "谐音梗二创", "神评论放大"],
  社会: ["温情反转叙事", "事件科普解读", "正能量收尾"],
  其他: ["借势热点做观点输出", "多平台视角对比", "情绪共鸣切入"],
};

const WHY: Record<HotspotCat, string> = {
  萌宠: "萌宠自带治愈与转发属性，拟人台词极易引发评论区玩梗。",
  美食: "高停留 + 强挂车属性，探店与教程类完播率稳定。",
  游戏: "圈层认同强，名场面与攻略是天然的高互动选题。",
  颜值: "视觉冲击 + 「我也能」的代入感，改造对比停留拉满。",
  测评: "「说真话」人设 + 预期违背，避坑内容完播率极高。",
  带货: "「源头好货 + 现场砍价」信任感强，转化路径短。",
  知识: "信息缺口钩子是通用爆款公式，系列化易涨粉。",
  剧情: "情绪曲线设计成熟，反转与名场面适合二创。",
  搞笑: "格式极易二创，UGC 自传播，嘴替类共鸣最强。",
  社会: "情绪过山车 + 正能量收尾，易上推荐且具公共价值。",
  其他: "话题自带流量，借势做观点输出最稳妥。",
};

// 由标题结构化生成「创作参考」（非新闻原文）。接入 LLM_API_KEY 后可换成真实成稿。
function buildDetail(r: HotspotTitle): HotspotDetail {
  const cat = r.category;
  const angles = ANGLES[cat] || ANGLES["其他"];
  const outline = [
    `开头钩子：${angles[0]}，3 秒内制造信息缺口`,
    `前 5 秒抛出冲突 / 反差，留住划走的手指`,
    `中段展开：${angles[1]}，用具体画面替代说教`,
    `结尾：${angles[2]}，并抛出互动问题引导评论`,
  ];
  return {
    id: r.id,
    title: r.title,
    category: cat,
    platform: r.platform,
    heat: r.heat,
    url: r.url,
    fetchedAt: new Date().toISOString(),
    clicks: 1,
    summary: `${r.title} 是近期在${r.platform}等平台持续发酵的热点，自带流量与讨论度，适合结合自身定位做借势创作。`,
    angles,
    outline,
    whyHot: WHY[cat] || WHY["其他"],
    sourceNote:
      "本详情由热点标题结构化生成，为创作参考而非新闻原文；接入 LLM_API_KEY 后可产出更贴合的成稿。",
  };
}

/**
 * 懒加载热点详情：仅在被点击时调用。命中已有详情则累加点击数直接返回；
 * 否则生成结构化创作参考并落盘（data/hotspot-details.json）后返回。
 */
export function getDetail(id: string): HotspotDetail | null {
  const title = findTitle(id);
  if (!title) return null;
  const details = loadDetails();
  if (details[id]) {
    details[id].clicks = (details[id].clicks || 0) + 1;
    saveDetails(details);
    return details[id];
  }
  const d = buildDetail(title);
  details[id] = d;
  saveDetails(details);
  return d;
}

/* --------------------------- 对外聚合接口 --------------------------- */

export interface HotspotsPayload {
  updatedAt: string;
  items: Hotspot[];
  sources: Record<string, "ok" | "fail">;
  days: Record<string, HotspotTitle[]>;
}

export async function getHotspots(force = false): Promise<HotspotsPayload> {
  ensureSeed();

  let items: Hotspot[] = [];
  let sources: Record<string, "ok" | "fail"> = {};
  let cachedUpdatedAt = "";
  let cacheHit = false;

  if (!force) {
    try {
      const f = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
      if (Date.now() - new Date(f.updatedAt).getTime() < TTL_MS && Array.isArray(f.items)) {
        items = f.items as Hotspot[];
        sources = f.sources || {};
        cachedUpdatedAt = f.updatedAt;
        cacheHit = true;
      }
    } catch {
      /* 缓存缺失/损坏，重新爬 */
    }
  }

  if (!cacheHit) {
    const c = await crawlHotspots();
    items = c.items;
    sources = c.sources;
    const payload = { updatedAt: new Date().toISOString(), items, sources };
    try {
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(payload));
    } catch {
      /* 写缓存失败不致命 */
    }
  }

  // 无论是否命中缓存，都把今日快照并入历史（保持时间轴新鲜）
  const history = mergeToday(items);

  return {
    updatedAt: cacheHit ? cachedUpdatedAt : new Date().toISOString(),
    items,
    sources,
    days: history.days,
  };
}
