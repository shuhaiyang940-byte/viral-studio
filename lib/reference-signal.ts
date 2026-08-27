import type { ReferenceSignal } from "@/lib/types";

/**
 * 参考信号提取（Mock 版，纯函数，可在服务端 / 客户端共用）。
 *
 * 设计原则（与真实接入一致）：
 * - 链接模式下，我们只读取平台「公开」的标签 / 话题与高赞评论，作为 AI 分析的**参考信号**；
 * - 这些信号**只作参考、不当答案**——不能直接拿来当结论，更不能假装 AI 真的"看懂"了视频；
 * - 反过来，匿名聚合这些信号 + 用户的目标分数，是「AI 成长飞轮」的训练素材（见 lib/learning.ts）。
 *
 * 真实接入时：把下面 mock 实现换成官方 / 合规聚合 API
 * （抖音开放平台数据 API / 小红书开放平台 + TikHub / Just One API / 腾讯云笔记详情 API），
 * 严禁任意爬取。
 */

/** 从链接识别平台（演示模式用，真实接入按官方域名判断） */
export function detectPlatform(url: string): string {
  const u = (url || "").toLowerCase();
  if (u.includes("douyin") || u.includes("iesdouyin") || u.includes("tiktok")) return "抖音";
  if (u.includes("xiaohongshu") || u.includes("xhslink") || u.includes("xhs")) return "小红书";
  if (u.includes("bilibili") || u.includes("b23.tv") || u.includes("bili")) return "B站";
  if (u.includes("weixin") || u.includes("channels") || u.includes("qq.com")) return "视频号";
  return "未知平台";
}

const TAG_POOL_BY_TYPE: Record<string, string[]> = {
  "生活记录 / 情感向": ["治愈", "真实记录", "情绪价值", "第一视角", "生活感", "共鸣"],
  "知识科普": ["干货", "涨知识", "科普", "逻辑清晰", "收藏向", "思维导图"],
  "好物种草": ["好物推荐", "平价", "测评", "种草", "避雷", "性价比"],
  "剧情短片": ["短剧", "反转", "演技", "上头", "剧情", "微电影"],
  "测评对比": ["实测", "对比", "参数", "客观", "避坑", "硬核"],
};

const COMMENT_POOL_BY_TYPE: Record<string, string[]> = {
  "生活记录 / 情感向": [
    "看哭了，这就是普通人的浪漫",
    "真实得不像摆拍，收藏了",
    "隔着屏幕都觉得温暖",
    "求同款 BGM，太好听了",
    "已经推荐给三个朋友了",
  ],
  "知识科普": [
    "终于有人讲明白了，谢谢",
    "建议收藏，反复看",
    "这个角度之前从来没想到",
    "逻辑清晰，比教科书强",
    "求出续集",
  ],
  "好物种草": [
    "已下单，蹲一个使用反馈",
    "价格真香，比我想的便宜",
    "博主测评很客观，粉了",
    "这个避雷提醒太及时了",
    "求链接",
  ],
  "剧情短片": [
    "反转太爽了，二刷",
    "演员演技在线，上头",
    "这结局没想到",
    "微电影质感，赞",
    "求更新下一集",
  ],
  "测评对比": [
    "参数拉满，硬核测评",
    "避坑指南，省了我一笔钱",
    "客观真实，不像恰饭",
    "对比很直观，懂了",
    "蹲长期体验",
  ],
};

// 高赞样本评论的点赞数（演示用，递减更真实）
const LIKE_WEIGHTS = [12800, 8600, 5300, 3100, 1900];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 生成参考信号（确定性：同一链接 + 同一类型结果稳定，便于演示与测试）。
 */
export function mockReferenceSignal(
  source: string | undefined,
  refType: string | undefined
): ReferenceSignal {
  const platform = source ? detectPlatform(source) : "未知平台";
  const type = refType && TAG_POOL_BY_TYPE[refType] ? refType : "生活记录 / 情感向";

  const tags = (TAG_POOL_BY_TYPE[type] || TAG_POOL_BY_TYPE["生活记录 / 情感向"]).slice();
  const rawComments =
    COMMENT_POOL_BY_TYPE[type] || COMMENT_POOL_BY_TYPE["生活记录 / 情感向"];

  // 用链接哈希做轻微偏移，让不同链接的"样本评论"顺序略有差异（但仍确定）
  const offset = source ? hashString(source) % rawComments.length : 0;
  const comments = rawComments.map((text, i) => ({
    text,
    like: LIKE_WEIGHTS[(i + offset) % LIKE_WEIGHTS.length],
  }));

  return {
    platform,
    tags,
    comments,
    sourceStatus: "DEMO" as const,
    note: "以上标签与评论来自该链接的公开信息，仅作为 AI 分析的「参考信号」——帮你理解这条视频受欢迎的侧面，但**不能当作结论或答案**。真正判断还是要靠你对内容的拆解。",
    // 明确：演示数据，禁止作为真实学习样本进入知识库（Phase 15-B P0）。
  };
}
