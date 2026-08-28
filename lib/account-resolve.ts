// 账号解析与预览：输入「平台 + 账号名/主页链接」，返回该账号的可疑识数据预览，
// 让用户确认「是不是自己的账号」（避免账号重名导致的误判）。
//
// 诚实边界：当前无平台真实 API，任何「粉丝量 / 播放」预览都必须标注数据来源与可信度，
// 绝不能凭空编一个粉丝数。将来接入真实 adapter 后，这里改为优先拉真实数据。

import type { DataSourceId } from "@/lib/data-platform/types";

export interface AccountPreview {
  /** 是否有可确认的账号身份信息 */
  recognized: boolean;
  platform: string;
  /** 归一化平台 id（用于数据源判断） */
  platformKey: string;
  account: string;
  /** 规范化后的平台账号 id（可用于排除重名） */
  accountKey: string;
  /** 识别到的身份信息（粉丝/播放等），来源可能是用户手填/截图/真实平台 */
  signals: {
    label: string;
    value: string;
    source: "platform" | "manual" | "screen" | "none";
  }[];
  /** 重名提示：同一平台下有多个同名账号时给出提醒 */
  nameConflictHint?: string;
  /** 数据源 id */
  source: DataSourceId;
  note: string;
}

const PLATFORM_ALIASES: Record<string, string> = {
  抖音: "douyin",
  douyin: "douyin",
  小红书: "xiaohongshu",
  xiaohongshu: "xiaohongshu",
  视频号: "shipinhao",
  shipinhao: "shipinhao",
  B站: "bilibili",
  bilibili: "bilibili",
  TikTok: "tiktok",
  tiktok: "tiktok",
};

export function normalizePlatform(p: string): string {
  return PLATFORM_ALIASES[p.trim()] ?? p.trim();
}

/** 从主页链接中尝试提取账号标识（抖音/小红书常见的 handle、ID、主页路径） */
export function extractAccountKey(platform: string, account: string): string {
  const a = account.trim();
  if (!a) return "";
  // 常见链接：douyin.com/user/MS4wLj... / xhslink.com/xxx / 主页 id
  const m = a.match(/\/user\/([A-Za-z0-9_\-]+)/) || a.match(/[?&]sec_uid=([A-Za-z0-9_\-]+)/);
  if (m) return m[1];
  const handle = a.match(/@([\u4e00-\u9fa5A-Za-z0-9_]+)/);
  if (handle) return handle[1];
  // 纯数字 ID（大概率是平台账号 id，可精确区分重名）
  if (/^\d{5,}$/.test(a)) return a;
  return a;
}

export function buildAccountPreview(input: {
  platform: string;
  account: string;
  signals?: { label: string; value: string; source: AccountPreview["signals"][number]["source"] }[];
  source?: DataSourceId;
}): AccountPreview {
  const platform = input.platform.trim();
  const platformKey = normalizePlatform(input.platform);
  const account = input.account.trim();
  const accountKey = extractAccountKey(platform, account);
  const signals = input.signals?.length ? input.signals : [];
  const recognized = signals.length > 0;
  return {
    recognized,
    platform,
    platformKey,
    account,
    accountKey,
    signals,
    note: recognized
      ? "已识别到账号信息，请确认是否为你自己的账号（同平台可能有重名账号）。"
      : "未识别到账号数据。建议补充账号数据或上传截图，以便确认账号身份。",
    source: input.source ?? "manual",
  };
}

/** 分析用户提供的账号数据，生成「信号」（用于确认是本人账号 + 为诊断提供依据） */
export function buildSignalsFromManual(input: {
  followers?: number;
  engagementRate?: number;
  avgPlays?: number;
  avgLikes?: number;
  avgComments?: number;
  sampleText?: string;
}): AccountPreview["signals"] {
  const out: AccountPreview["signals"] = [];
  if (input.followers != null && Number.isFinite(input.followers)) out.push({ label: "粉丝量", value: `${input.followers} 万`, source: "manual" });
  if (input.engagementRate != null && Number.isFinite(input.engagementRate)) out.push({ label: "互动率", value: `${input.engagementRate}%`, source: "manual" });
  if (input.avgPlays != null && Number.isFinite(input.avgPlays)) out.push({ label: "平均播放", value: `${input.avgPlays}`, source: "manual" });
  if (input.avgLikes != null && Number.isFinite(input.avgLikes)) out.push({ label: "平均点赞", value: `${input.avgLikes}`, source: "manual" });
  if (input.avgComments != null && Number.isFinite(input.avgComments)) out.push({ label: "平均评论", value: `${input.avgComments}`, source: "manual" });
  if (input.sampleText?.trim()) out.push({ label: "文案采样", value: input.sampleText.trim().slice(0, 80), source: "manual" });
  return out;
}
