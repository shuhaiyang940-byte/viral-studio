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
  capabilities: ("account" | "posts" | "post_metrics" | "resolve_account")[];
  resolveAccount(handleOrUrl: string): Promise<{ accountId: string }>;  // /clinic 从 handle/URL 解析账号 id
  fetchAccount(id: string): Promise<AccountSnapshot>;          // 给 /clinic 账号诊断
  fetchPosts(id: string): Promise<PlatformMetrics[]>;          // 给 /review 复盘
  // 注意：竞品/对标数据不来自平台 API —— 开放接口拿不到别人家全量指标。
  //   benchmarks 由「内部 benchmark 库」提供（可后续用平台授权数据 / 采购数据灌入），
  //   而不是 adapter 直接 fetch 竞品。
}
```

> **错误处理约定（写 adapter 时补上）**：token 过期要刷新重试；429 限流要退避/排队；接口返回 partial 数据时按字段缺失降级（填 null 而非整体失败），绝不能让一次采集失败导致整个诊断/复盘灰掉。

## 4. 接入点（现有功能 → 数据源）

- **/clinic 账号诊断**：`fetchAccount` 替换「手填账号数据」。
- **/review 复盘**：`fetchPosts` 替换「手填 / 粘贴 CSV」（当前 CSV 即 `PlatformMetrics.metrics` 子集）。
- **/find-peer 对标**：读「内部 benchmark 库」（当前种子对标库），将来用平台授权数据 / 采购数据灌入扩成真实对标库；**不依赖平台 API 直接拉竞品**（开放接口拿不到）。
- **/strategy 重合度**：对标库向量化 → 硬相似度，替代 `overlap_pct` 的 LLM 自报。

## 5. 半真 → 真源的迁移策略

当前 CSV / 粘贴回填已经在语义上对齐 `PlatformMetrics.metrics`。将来选数据源后：
1. 给该平台实现一个 `DataSourceAdapter`；
2. 在对应 API（`/api/clinic`、`/api/review`、`/api/find-peer`）接入点替换 fetch 调用；
3. **现有前端表单、页面结构、`/review` 写回人设逻辑全部不用动**。

这样从「半真」到「真回流」是增量替换，不是重构。

## 6. 现有 API 字段契约（前端 ⇄ 后端 对齐）

### 6.1 `POST /api/clinic`（账号诊断）

只接受**扁平字段**（禁止嵌套包裹，如 `accountData` / `metrics` / `data`）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `niche` | string | 是 | 11 赛道之一：生活/旅游/美食/情感/知识/美妆护肤/穿搭/母婴/剧情/搞笑/商业 |
| `contentType` | string | 是 | `sell`（卖货）/ `talk`（口播） |
| `platform` | string | 否 | 抖音/小红书/视频号/B站/TikTok |
| `account` | string | 否 | 账号名 / 主页链接 |
| `followers` | number | 否 | 粉丝量（万） |
| `engagementRate` | number | 否 | 互动率（%） |
| `avgPlays` | number | 否 | 近 20 条平均播放 |
| `avgLikes` | number | 否 | 近 20 条平均点赞 |
| `avgComments` | number | 否 | 近 20 条平均评论 |
| `description` | string | 否 | 账号近况 / 选题描述 |
| `sampleText` | string | 否 | 文案采样（近 1-3 条真实文案） |

> 如提交未知键（含嵌套结构）→ `400 INVALID_FIELDS`，绝不会静默降级为模板假诊断。

### 6.2 `POST /api/review`（数据复盘）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `assetId` | string | 否 | 关联策略脚本资源 id |
| `title` | string | 否 | 复盘标题（≤120 字符） |
| `note` | string | 否 | 备注（**必须是纯字符串**；传对象/数组 → `400 INVALID_NOTE`，避免中文键污染 LLM 上下文） |
| `metrics` | object | 否 | 拍后数据，**仅接受英文键**：`plays` / `likes` / `comments` / `completionRate` / `follows` / `conversions`，其余键（含中文键）一律忽略 |

> 含义：后端只认 English metric 键，中文键在数值层被丢弃。粘贴 CSV 时由前端 `PASTE_KEYS` 完成「中文→英文」映射后再提交。

### 6.3 `GET /api/quota`（配额）

返回分析配额 + 生成类配额（按 `operation` 分组：`strategy` / `review`）+ 重置时刻：

```ts
{
  quota: {
    limit: number | null,        // 分析每日上限；null = 不限（会员）
    used: number,
    remaining: number | null,
    isPro: boolean,
    generation: { operation: "strategy" | "review"; limit: number; used: number; remaining: number }[],
    resetAt: string              // 下一个 UTC 0 点（= 我国次日 08:00）的 ISO 时间
  }
}
```
