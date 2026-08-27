// 可插拔学习源适配器（Phase 15-B）。
//
// 核心诚实边界：每个源必须有「能力标记」。
//   - 有真实数据 → OK / PARTIAL
//   - 没有合规数据 → SOURCE_UNAVAILABLE（绝不模拟评论 / 弹幕 / 视频正文）
// 热点 ≠ 学习知识：热点只能当作「候选样本」进入学习流程，不能直接变成知识。
//
// 目前真实可用：抖音 / 微博 / 百度 / 头条 / 知乎 的【标题级】未鉴权热榜（lib/hotspots-server.ts）。
// 视频正文 / 评论 / 弹幕 / 互动：全部 SOURCE_UNAVAILABLE。

import { getHotspots } from "@/lib/hotspots-server";
import type { SourceStatus } from "@/lib/knowledge-logic";

export type SourceName =
  | "douyin"
  | "xiaohongshu"
  | "weibo"
  | "bilibili"
  | "youtube"
  | "hotlist";

export interface SourceCapabilities {
  title: SourceStatus;
  video_content: SourceStatus;
  comments: SourceStatus;
  danmaku: SourceStatus;
  interaction: SourceStatus;
}

export interface LearningSample {
  id: string;
  source: string;
  source_status: SourceStatus;
  platform: string;
  category: string;
  title: string;
  heat: number;
  url?: string;
  capabilities: SourceCapabilities;
}

export type CapabilityKey = keyof SourceCapabilities;

/** 每个源的「内容能力」现状（真实，不编造）。 */
export const SOURCE_CAPABILITIES: Record<SourceName, SourceCapabilities> = {
  douyin: {
    title: "PARTIAL", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE",
    danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE",
  },
  xiaohongshu: {
    title: "SOURCE_UNAVAILABLE", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE",
    danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE",
  },
  weibo: {
    title: "PARTIAL", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE",
    danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE",
  },
  bilibili: {
    title: "SOURCE_UNAVAILABLE", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE",
    danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE",
  },
  youtube: {
    title: "SOURCE_UNAVAILABLE", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE",
    danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE",
  },
  hotlist: {
    title: "PARTIAL", video_content: "SOURCE_UNAVAILABLE", comments: "SOURCE_UNAVAILABLE",
    danmaku: "SOURCE_UNAVAILABLE", interaction: "SOURCE_UNAVAILABLE",
  },
};

/** 当前所有接入源的「能力状态」报告（无网络请求）。 */
export function sourceStatusReport(): Record<SourceName, SourceCapabilities> {
  return SOURCE_CAPABILITIES;
}

/** 把一个真实热点条目映射成一个「候选样本」（标题级）。 */
export function makeSampleFromHotspot(h: {
  id?: string;
  title: string;
  category: string;
  platform: string;
  heat: number;
  url?: string;
}): LearningSample {
  const key = h.platform.toLowerCase();
  const source: SourceName =
    /抖音/.test(h.platform) ? "douyin"
    : /小红书/.test(h.platform) ? "xiaohongshu"
    : /微博/.test(h.platform) ? "weibo"
    : /B站|bilibili/i.test(h.platform) ? "bilibili"
    : /youtube|优兔/i.test(h.platform) ? "youtube"
    : "hotlist";
  return {
    id: h.id || `hs-${String(h.title).slice(0, 24)}`,
    source,
    source_status: SOURCE_CAPABILITIES[source].title,
    platform: h.platform,
    category: h.category,
    title: h.title,
    heat: h.heat,
    url: h.url,
    capabilities: SOURCE_CAPABILITIES[source],
  };
}

/** 拉取候选样本：复用现有热点爬虫（标题级，10 分钟缓存，不额外烧 LLM）。 */
export async function fetchLearningSamples(opts: {
  maxItems?: number;
  forceRefresh?: boolean;
}): Promise<{ samples: LearningSample[]; sourceStatus: Record<SourceName, SourceCapabilities> }> {
  const maxItems = Math.min(Math.max(opts.maxItems ?? 20, 1), 100);
  try {
    const payload = await getHotspots(!!opts.forceRefresh);
    const items = (payload.items || []).slice(0, maxItems);
    const samples = items.map(makeSampleFromHotspot);
    return { samples, sourceStatus: SOURCE_CAPABILITIES };
  } catch (e) {
    console.warn("[sources] 候选样本拉取失败：", e);
    return { samples: [], sourceStatus: SOURCE_CAPABILITIES };
  }
}
