# 平台数据接入契约（源无关 · 纸面 spec）

> 目标：将来把诊断 / 复盘 / 对标从「手填 / CSV 半真」升级为「平台真实数据」时，用一个**统一数据模型**，
> 避免提前给某家（抖音 / 小红书 / 视频号）写死 schema。当前 CSV 回填只是本契约的一个「手动子集实现」。
> 本文件是文档，不是死代码；将来选定数据源后，按此实现 adapter 即可，不动现有表单与页面结构。

## 1. PlatformMetrics —— 一条作品的核心数据（vendor-agnostic）

```ts
interface PlatformMetrics {
  platform: "douyin" | "xiaohongshu" | "shipinhao" | "bilibili" | "tiktok" | "manual";
  accountId?: string;          // 平台侧账号标识（不是本站 user id）
  accountName?: string;
  postId?: string;
  postTitle?: string;
  postedAt?: string;           // ISO 时间
  durationSec?: number;
  metrics: {
    plays?: number;            // 播放量 / views
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;            // 收藏 / 保存
    completionRate?: number;   // 完播率 %
    follows?: number;          // 净增粉丝
    conversions?: number;      // 转化 / 线索 / 加私域
  };
  audience?: { age?: string; gender?: string; region?: string };
}
```

## 2. 当前 CSV / 粘贴回填的对应关系（`0cda34d` 已实现的子集）

| 当前表单字段 | 已支持别名（`app/review/page.tsx` PASTE_KEYS） | PlatformMetrics.metrics |
|---|---|---|
| 播放量 | 播放 / 播放量 / plays / views / video_views / play_count | `plays` |
| 点赞 | 点赞 / likes / like_count | `likes` |
| 评论 | 评论 / comments / comment_count | `comments` |
| 完播率 | 完播 / completion_rate / complete_rate | `completionRate` |
| 涨粉 | 涨粉 / follows / new_followers | `follows` |
| 转化 | 转化 / 线索 / leads | `conversions` |

> 也就是说，当前半真回填已经用上了 `PlatformMetrics.metrics` 的子集语义。

## 3. DataSourceAdapter —— 将来接某平台时实现的接缝

```ts
interface DataSourceAdapter {
  id: "douyin" | "xiaohongshu" | "shipinhao" | "manual";
  capabilities: ("account" | "posts" | "post_metrics")[];
  fetchAccount(id: string): Promise<AccountSnapshot>;          // 给 /clinic 账号诊断
  fetchPosts(id: string): Promise<PlatformMetrics[]>;          // 给 /review 复盘
  fetchBenchmarks(niche: string): Promise<PlatformMetrics[]>;  // 给 /find-peer 对标
}
```

## 4. 接入点（现有功能 → 数据源）

- **/clinic 账号诊断**：`fetchAccount` 替换「手填账号数据」。
- **/review 复盘**：`fetchPosts` 替换「手填 / 粘贴 CSV」（当前 CSV 即 `PlatformMetrics.metrics` 子集）。
- **/find-peer 对标**：`fetchBenchmarks` 替换「种子对标库」。
- **/strategy 重合度**：对标库向量化 → 硬相似度，替代 `overlap_pct` 的 LLM 自报。

## 5. 半真 → 真源的迁移策略

当前 CSV / 粘贴回填已经在语义上对齐 `PlatformMetrics.metrics`。将来选数据源后：
1. 给该平台实现一个 `DataSourceAdapter`；
2. 在对应 API（`/api/clinic`、`/api/review`、`/api/find-peer`）接入点替换 fetch 调用；
3. **现有前端表单、页面结构、`/review` 写回人设逻辑全部不用动**。

这样从「半真」到「真回流」是增量替换，不是重构。
