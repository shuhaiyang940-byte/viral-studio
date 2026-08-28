// 可插拔数据源注册表：将来接任何真实平台源（抖音/小红书 API 等）时，
// 只需实现 DataSourceAdapter 并 register(source)，clinic/review 无需改动即可消费。
// 当前仅有 manual（用户手填/回填），真实平台源按 docs/data-platform-contract.md 的 §3 实现。

import type { AccountSnapshot, DataSourceAdapter, DataQuality, DataSourceId } from "./types";

const registry = new Map<DataSourceId, DataSourceAdapter>();

export function registerDataSource(adapter: DataSourceAdapter): void {
  registry.set(adapter.id, adapter);
}

export function getDataSource(id: DataSourceId): DataSourceAdapter | undefined {
  return registry.get(id);
}

export function listDataSources(): DataSourceAdapter[] {
  return [...registry.values()];
}

/** 判断一次 /clinic 请求的「数据可信度」：有真实平台源才是 platform；否则按是否有用户输入判 estimated/none */
export function classifyDataQuality(
  snap: Pick<AccountSnapshot, "source" | "followers" | "engagementRate" | "avgPlays" | "avgLikes" | "avgComments" | "description" | "sampleText">
): DataQuality {
  if (snap.source !== "manual") return "platform";
  const hasNumeric =
    [snap.followers, snap.engagementRate, snap.avgPlays, snap.avgLikes, snap.avgComments]
      .some((v) => v !== undefined && v !== null && Number.isFinite(v));
  const hasText = !!snap.description?.trim() || !!snap.sampleText?.trim();
  if (hasNumeric || hasText) return "estimated";
  return "none";
}

/** 把 /clinic 的扁平输入归一化为一个 AccountSnapshot（当前只有 manual 源） */
export function manualSnapshot(input: {
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
}): AccountSnapshot {
  const snap: AccountSnapshot = {
    source: "manual",
    quality: "none",
    account: input.account,
    platform: input.platform,
    niche: input.niche,
    contentType: input.contentType,
    followers: input.followers,
    engagementRate: input.engagementRate,
    avgPlays: input.avgPlays,
    avgLikes: input.avgLikes,
    avgComments: input.avgComments,
    avgShares: input.avgShares,
    description: input.description,
    sampleText: input.sampleText,
  };
  snap.quality = classifyDataQuality(snap);
  return snap;
}
