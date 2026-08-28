// 平台数据接入模型（源无关）：与 docs/data-platform-contract.md 保持一致。
// 目标：让诊断 / 复盘 / 对标从「用户手填估算」升级为「平台真实数据」时，
// 用一套统一数据结构，避免写死某家平台的 schema。

/** 数据可信度：诊断/复盘的判断依据到底是什么来源。 */
export type DataQuality = "platform" | "estimated" | "none";

/** 数据源 id（将来可注册新的真实平台源） */
export type DataSourceId =
  | "manual"
  | "douyin"
  | "xiaohongshu"
  | "shipinhao"
  | "bilibili"
  | "tiktok";

/** 一条作品的核心数据（vendor-agnostic） */
export interface PlatformMetrics {
  platform?: string;
  postId?: string;
  postTitle?: string;
  postedAt?: string;
  durationSec?: number;
  plays?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  completionRate?: number;
  follows?: number;
  conversions?: number;
}

/** 账号诊断所需的一次「快照」：来自平台 API 或用户手填 */
export interface AccountSnapshot {
  /** 精确到来源：manual=用户手填/回填；其余=将来真实平台 */
  source: DataSourceId;
  /** 数据可信度等级 */
  quality: DataQuality;
  account?: string;
  platform?: string;
  niche?: string;
  contentType?: "sell" | "talk";
  followers?: number;
  engagementRate?: number;
  avgPlays?: number;
  avgLikes?: number;
  avgComments?: number;
  avgShares?: number;
  description?: string;
  sampleText?: string;
}

/** 平台数据源适配器：实现这个借口即可把「真实数据」接入诊断/复盘。 */
export interface DataSourceAdapter {
  id: DataSourceId;
  /** 展示名（如「抖音」「小红书」） */
  name: string;
  /** 该源能提供哪些能力 */
  capabilities: ("account" | "posts" | "post_metrics" | "resolve_account")[];
  /**
   * 从账号标识（handle / URL）解析平台侧账号 id。
   * 真实源实现时在此调平台 API；本框架当前仅 manual 可用。
   */
  resolveAccount?(handleOrUrl: string): Promise<{ accountId: string }>;
  /** 拉取账号快照（给 /clinic 诊断） */
  fetchAccount?(handleOrUrl: string): Promise<AccountSnapshot>;
  /** 拉取该账号近 N 条作品数据（给 /review 复盘） */
  fetchPosts?(accountId: string): Promise<PlatformMetrics[]>;
}

/** 数据可信度 → 供前端展示的徽章文案 */
export function dataQualityLabel(q: DataQuality): string {
  switch (q) {
    case "platform":
      return "平台真实数据";
    case "estimated":
      return "用户手填估算";
    case "none":
      return "暂无账号数据";
  }
}

/** 数据可信度 → 诊断的来源说明（诚实边界） */
export function dataQualityNote(q: DataQuality): string {
  switch (q) {
    case "platform":
      return "说明：本结果基于该账号在平台的近 N 条真实数据给出，非估算。";
    case "estimated":
      return "说明：本结果基于你填写的账号数据（近 N 条指标/描述/文案采样）估算给出，未接入平台实时数据，仅供参考。";
    case "none":
      return "说明：本结果仅基于你填写的账号/赛道信息给出，未接入该账号的真实粉丝/互动/内容数据，不是真实账号数据诊断，仅供方向参考。";
  }
}
