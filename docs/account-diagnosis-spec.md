# 账号诊断系统 · 技术规格（v0.1）

> 目标：把 `/clinic` 从「AI 看一眼账号 → 打个分」升级成「
> **账号证据采集 → 内容级分析 → 横向对标 → 原因归因 → 诊断 → 改进方案 → 商业报告**」的
> 数据系统。**核心资产不是 Prompt，而是结构化证据 + 证据推导原因。**
>
> 本文件是**规格，不是代码**。四个规格分开：①数据库 Schema ②API ③AI Analyzer 接口 ④诊断规则引擎。
> 配套 `docs/account-diagnosis-types.ts`（程序层可直接引用的类型/DTO）。

---

## 0. 分层总览（7 层，各层职责单一，禁止混写）

```
用户输入(平台/账号URL/行业/目标/补充)
   ↓
① Account Collector        账号是谁 → AccountProfile + AccountSnapshot
   ↓
② Content Collector        这条账号的 N 条视频 → Video + VideoMetrics + VideoTranscript + VideoFrames
   ↓
③ Content Analysis         每条视频→ 多个 Analyzer(钩子/脚本/结构/视觉/剪辑/音频/CTA/话题/情绪)
   ↓
④ Benchmark Engine         同平台同赛道同量级 → Metric 基准
   ↓
⑤ Diagnosis Engine         Metric→Signal→Hypothesis→Evidence→Diagnosis（AI负责判断，不负责制造事实）
   ↓
⑥ Strategy Engine          问题→原因→解决方案→执行动作→验证周期→成功指标
   ↓
⑦ Report Engine            商业级诊断报告（健康度+核心结论+最大问题+证据+优先级）
```

**设计铁律**
1. AI 只做「判断/归因/生成」，不做「采集/计数/对标计算」。事实必须来自 ①②④ 的结构化数据。
2. 每个 Diagnosis 必须有 `evidence[]`（具体到 video_id + timestamp + finding）。
3. 每个 Metric 必须和 Benchmark 比较，单账号数据没有意义。
4. 每条诊断保存 `AccountSnapshot`，为「历史趋势 / 增长 X%」打基础。

---

## 1. 数据库 Schema（Neon / Postgres）

### 1.1 表设计（新增表，复用现有 `assets`/`users`）

#### `account_profiles` ①账号档案
```sql
CREATE TABLE IF NOT EXISTS account_profiles (
  id            TEXT PRIMARY KEY,                -- acct_<sec_uid哈希>
  platform      TEXT NOT NULL,                   -- douyin / xiaohongshu / shipinhao ...
  account_key   TEXT NOT NULL,                   -- sec_uid / handle / 数字id（重名辨识）
  display_name  TEXT NOT NULL,
  followers     INTEGER,                          -- 粉丝数
  likes         INTEGER,                          -- 获赞数
  works_count   INTEGER,                          -- 作品数
  bio           TEXT,
  verified      BOOLEAN DEFAULT FALSE,
  industry      TEXT,                             -- 行业标签（用户填）
  goal          TEXT,                             -- 用户目标：涨粉/获客/品牌
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, account_key)
);
```

#### `account_snapshots` ①每次诊断快照（支撑历史趋势）
```sql
CREATE TABLE IF NOT EXISTS account_snapshots (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES account_profiles(id),
  user_id       TEXT,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  followers     INTEGER,
  likes         INTEGER,
  works_count   INTEGER,
  job_id        TEXT                                -- 关联本次采集任务
);
CREATE INDEX IF NOT EXISTS idx_snap_profile_captured ON account_snapshots(profile_id, captured_at DESC);
```

#### `account_videos` ②账号下的视频（每条一条）
```sql
CREATE TABLE IF NOT EXISTS account_videos (
  id            TEXT PRIMARY KEY,                -- video_id
  profile_id    TEXT NOT NULL REFERENCES account_profiles(id),
  platform      TEXT NOT NULL,
  title         TEXT,
  published_at  TIMESTAMPTZ,
  duration_sec  INTEGER,
  plays         INTEGER,
  likes         INTEGER,
  comments      INTEGER,
  shares        INTEGER,
  saves         INTEGER,
  video_url     TEXT,
  cover_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_av_profile ON account_videos(profile_id, published_at DESC);
```

#### `video_content` ②视频内容/内容级采集（transcript/frames/OCR）
```sql
CREATE TABLE IF NOT EXISTS video_content (
  video_id      TEXT PRIMARY KEY REFERENCES account_videos(id),
  transcript    TEXT,                              -- ASR 字幕/口播
  ocr_text      TEXT,                               -- 画面文字
  frames        JSONB DEFAULT '[]',                 -- 抽帧数据URL数组
  understanding JSONB,                              -- VideoUnderstanding(覆盖度/分段)
  collected_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `content_analysis` ③每条视频的分析结果（多个 Analyzer 聚合）
```sql
CREATE TABLE IF NOT EXISTS content_analysis (
  id            TEXT PRIMARY KEY,
  video_id      TEXT NOT NULL REFERENCES account_videos(id),
  analyzer      TEXT NOT NULL,                     -- hook/script/structure/visual/editing/audio/cta/topic/emotion
  data          JSONB NOT NULL,                    -- 该 Analyzer 的结构化产出
  model         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ca_video ON content_analysis(video_id);
```

#### `diagnosis_metrics` ⑤诊断指标（含账号值 vs 对标值）
```sql
CREATE TABLE IF NOT EXISTS diagnosis_metrics (
  id            TEXT PRIMARY KEY,
  report_id     TEXT NOT NULL,
  key           TEXT NOT NULL,                     -- like_rate / comment_rate / share_rate / freq / dur
  account_value REAL,
  benchmark_value REAL,
  pct_rank      REAL,                              -- 相对同行百分位
  delta         REAL
);
```

#### `diagnoses` ⑤证据驱动的诊断结论
```sql
CREATE TABLE IF NOT EXISTS diagnoses (
  id            TEXT PRIMARY KEY,
  report_id     TEXT NOT NULL,
  metric_key    TEXT NOT NULL,                     -- 关联 diagnosis_metrics.key
  severity      TEXT NOT NULL,                     -- high/medium/low
  title         TEXT NOT NULL,
  root_cause    TEXT,                              -- 归因（由规则+LLM综合）
  confidence    REAL,
  evidence      JSONB DEFAULT '[]',                -- [{video_id,finding,timestamp}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `recommendations` ⑥改进策略
```sql
CREATE TABLE IF NOT EXISTS recommendations (
  id            TEXT PRIMARY KEY,
  report_id     TEXT NOT NULL,
  diagnosis_id  TEXT,
  title         TEXT NOT NULL,
  detail        TEXT,
  template      TEXT,                              -- 具体可照做的模板
  verify_period TEXT,                              -- 验证周期
  success_metric TEXT,                             -- 成功指标（如 评论率≥0.45%）
  priority      INTEGER
);
```

#### `diagnosis_reports` ⑦最终报告
```sql
CREATE TABLE IF NOT EXISTS diagnosis_reports (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  profile_id    TEXT NOT NULL,
  niche         TEXT,
  goal          TEXT,
  health_score  INTEGER,
  summary       JSONB DEFAULT '{}',                -- 核心结论(内容质量/策略/互动/定位/稳定性)
  top_problem   JSONB,                             -- 最大问题
  report        JSONB DEFAULT '{}',                -- 完整报告
  tier          TEXT,                              -- free/creator/pro/studio
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **幂等建表**：`ensureSchema` 用「users 已存在」探测会跳过新表，故这些新表的 DDL 需通过一个独立的
> `ensureDiagnosisSchema()` 幂等建表函数执行（参考 `lib/billing/orders.ts` 的做法），勿塞进现有 `SCHEMA_SQL`。

---

## 2. API 设计（Next.js App Router，`app/api/`）

### 2.1 采集类
```
POST /api/diagnosis/collect
  输入: { platform, accountKey|url, industry?, goal? }
  输出: { profile, snapshot, videos: VideoMeta[], jobId }
  职责: ①+② 采集。分为「支持真实数据源」与「降级采集」两路。

POST /api/diagnosis/collect/video          -- 单条视频内容采集(上行截图/URL→transcript+frames+OCR)
GET  /api/diagnosis/collect/status?jobId=  -- 采集任务轮询（长任务）
```

### 2.2 分析类
```
POST /api/diagnosis/content-analyze
  输入: { videoIds: string[] }
  输出: { analyses: ContentAnalysis[] }     -- ③ 逐条跑 Analyzer
```

### 2.3 对标类
```
GET /api/diagnosis/benchmark?platform=&niche=&tier=&metric=
  输出: { benchmark: BenchmarkGroup }       -- ④ 从 benchmark 库聚合
```

### 2.4 诊断/报告类
```
POST /api/diagnosis/run
  输入: { profileId, videoIds?, niche, goal }
  输出: { reportId, healthScore, summary, topProblem, diagnoses[], recommendations[] }
  职责: ④⑤⑥⑦ 全链路。默认读已采集数据，避免重复烧钱。

GET  /api/diagnosis/report?reportId=        -- 取完整报告
```

> **复用现有资质**：所有接口用 `guardAiRequest(req, "creative")` 防滥用；配额用 `generateLimitFor(tier)`。
> **分档限次**（见 §5）由 tier 决定 N 值，`consumeGenerationQuota(userId, "diagnosis", tier)` 落库。

### 2.5 与现有 `/clinic` 的关系
- `/clinic` =「快速初判 + 缺数据引导」（已有），保留作为免费入口。
- `/diagnosis/*` =「商业级证据诊断」（本规格），是升级版，按 tier 解锁。
- 两者共用 `account_profiles`，避免重复采集。

---

## 3. AI Analyzer 接口（③④ 层）

### 3.1 统一 Analyzer 接口（程序层 `lib/diagnosis/analyzers.ts`）
```ts
export interface AnalyzerContext {
  video: VideoWithContent;       // 含 transcript/frames/ocr/understanding
  config: { visual: "real" | "mock" | "none" };
}
export interface AnalyzerResult {
  analyzer: string;
  data: Record<string, unknown>; // 结构化产出（不是自然语言）
  evidence?: { finding: string; timestamp?: string }[];
}
export interface VideoAnalyzer {
  id: "hook" | "script" | "structure" | "visual" | "editing" | "audio" | "cta" | "topic" | "emotion";
  run(ctx: AnalyzerContext): Promise<AnalyzerResult>;
}
```

### 3.2 每个 Analyzer 的量化产出（关键：可被 ⑤ 引用为「证据」）
| Analyzer | 关键量化指标 | 产出示例 |
|---|---|---|
| hook | 前1s/3s/5s/10s是否含 冲突/悬念/结果前置/利益/反常识 | `{hookType:"冲突", triggerAtSec:0.8}` |
| script | 开头/问题/铺垫/论证/高潮/结论/CTA 是否齐 | `{hasCta:false, structureRating:0.7}` |
| structure | 有 CTA/有提问/有争议点 | `{hasQuestion:false, hasConflict:false}` |
| visual | 人物/构图/字幕覆盖率/景别切换 | `{subtitleCoverage:0.55, shotChanges:9}` |
| editing | 平均镜头长度/跳切/转场 | `{avgShotLen:2.1s, jumpCuts:3}` |
| audio | 有BGM/有音效/声音特征 | `{hasBgm:true, hasSfx:false}` |
| cta | 结尾是否有 互动/关注/评论引导 | `{hasCta:false, ctaType:"none"}` |
| topic | 话题戳中用户/争议度 | `{topicHeat:0.6, isControversial:false}` |
| emotion | 情绪曲线峰值 | `{peakEmotion:"共鸣", emotionCurve:[...]}` |

> **诚实边界**：`visual/editing` 依赖真实视频理解（抽帧/ASR）。`/analyze` 现有管线已能产出
> `VideoUnderstanding`（含 coverageStatus）。若视觉为 `mock/none`，这些 Analyzer 返回 `{available:false, reason}`，
> 并在报告里诚实标注「本条未做画面级分析」，**绝不编造镜头数**。

### 3.3 真实视频内容采集能力（关键约束，必须诚实）
- **现有可用**：单条视频 URL/上传 → `/api/analyze` 已能产出 `VideoUnderstanding`（转写/画面/OCR + 覆盖度）。
- **直接可用（无账号 API）**：用户提供视频链接 / 上传视频 → 逐条分析。这是「降级采集」。
- **依赖真实数据源**：账号下「自动列出 N 条视频 + 每条数据」需要 ① ② 的数据源 adapter。
  抖音 sec_uid 需要登录态/签名，官方开放 API / 数据服务商（蝉小红/飞瓜）才能稳定拿到。
  **无此数据源前，②Content Collector 只能依赖「用户提供链接/上传」，不能假装能自动抓账号作品列表。**

---

## 4. 诊断规则引擎（⑤⑥ 核心：AI 不制造事实）

### 4.1 数据流（从事实到归因）
```ts
// 1) 算指标（规则，无 AI）
computeMetrics(account: AccountSnapshot, videos: VideoMetrics[], benchmark: BenchmarkGroup): Metric[]
// 例: 评论率 = 总评论/总播放; 分享率 = 总分享/总播放; 更新频率 = 条数/周

// 2) 找信号（规则，无 AI）: 账号值 vs 对标值
detectSignals(metrics: Metric[]): Signal[]
// 例: comment_rate 低于 P25 的 benchmark → {metric:"comment_rate", severity:"high", gap:0.44}

// 3) 聚合视频证据（规则，无 AI）: 某信号对应的视频级特征
collectEvidence(signal, videos, analyses): Evidence[]
// 例: 评论率低 → 扫描 videos 找 cta.hasCta=false / structure.hasQuestion=false → 命中率 27/30

// 4) 候选原因（规则，无 AI）: 由命中证据推断
hypothesize(signal, evidence): Hypothesis[]
// 例: 27/30 无 CTA → {reason:"互动设计不足", support:0.9}

// 5) LLM 综合判断（AI 只做这一步）：结合 metrics+benchmark+evidence+hypothesis 归一
finalizeDiagnosis(metrics, signals, evidence, hypotheses): Diagnosis[]
// AI 输出: {title:"评论率显著落后同行", rootCause:"内容缺评论触发机制", confidence:0.91}
```

> **铁律**：LLM 的输入是结构化 facts（metrics/evidence/hypotheses），严禁让 LLM 凭空「猜原因」。
> 规则引擎负责"发现异常 + 找证据"，LLM 负责"把证据讲成一句诊断"。这样 AI 不能胡说。

### 4.2 证据链格式（每个 diagnosis 必带）
```json
{
  "diagnosis": "评论率偏低",
  "severity": "high",
  "metric": { "account": 0.18, "benchmark": 0.62 },
  "evidence": [
    { "video_id": "123", "finding": "结尾无CTA", "timestamp": "00:42-00:45" },
    { "video_id": "127", "finding": "内容为单向观点输出", "timestamp": "00:00-00:38" }
  ],
  "confidence": 0.91
}
```

---

## 5. 分档限次（成本控制，防止一次分析全部历史导致成本爆炸）

| 档位 | 采集视频数 | 内容分析 | 对标 | 报告深度 |
|---|---|---|---|---|
| free | 最近 10 条 | 基础指标+健康度 | 基础对标 | 3 个核心问题 |
| creator | 最近 30 条 | 完整视频分析 | 同赛道对标 | 内容结构分析 |
| pro | 最近 100 条 | 全维度分析 | 竞品对标+历史趋势 | 深度诊断 |
| studio | 持续监控 | 账号群/竞品群/行业 | 行业Benchmark+预警 | 自动预警 |

> N 值由 tier 决定，采集前先 `consumeGenerationQuota(userId, "diagnosis", tier)`。
> 免费档只做「证据采集 + 指标计算 + 规则发现」，不触发大量 LLM 视频分析，控制成本。

---

## 6. 复用现有资产清单（避免重造）

| 本规格层 | 现有可复用 |
|---|---|
| ① Account Collector | `lib/data-platform/adapter.ts`（DataSourceAdapter 接缝）、`lib/account-resolve.ts`(账号解析) |
| ② Content Collector | `lib/vision.ts`(抽帧/ASR/视觉)、`lib/video-fact.ts`(VideoUnderstanding) |
| ③ Content Analysis | `app/api/analyze` 管线产出 `AnalysisReport`/`golden3s`/`structure` |
| ④ Benchmark Engine | `lib/benchmarks.ts`（对标库含 followers/engagementRate/blackHorseIndex） |
| ⑤⑥⑦ | `lib/clinic.ts`(诊断)、`lib/organic-check.ts`(刷量检测，可并入③/⑤) |

---

## 7. 分阶段落地建议（最小可交付 → 完整闭环）

> 按你的要求，这是规格；开发顺序建议如下，避免"改一点补一个洞"。

- **Phase 1（证据采集 + 指标 + 规则，纯代码，不依赖数据源）**：
  `AccountSnapshot` + `VideoMetrics` 采集接口（用户提供链接/上传）+ 指标计算 + 规则发现。
  产出「健康度 + 核心问题 + 证据链」（免费档的10条）—— 这就能让「网站主动看视频」落地（用户给链接/上传，我们真实读）。
- **Phase 2（横向对标 + 归因 + 报告）**：接入 Benchmark 聚合 + LLM 综合判断 + 商业报告结构。
- **Phase 3（真实数据源 adapter）**：定源（官方API/数据服务商），实现 `fetchAccount`/`fetchPosts`，
  让「输入账号URL自动拉N条」真正全自动。**这是 80 分的关键，卡在外部源。**
- **Phase 4（订阅化）**：历史趋势 + 监控 + 自动预警（Studio 档）。

---

## 8. 诚实边界（必须遵守，不能假装）

1. **账号作品列表自动获取**：需真实数据源（官方API/数据服务商）。无源前，②只能靠「用户提供链接/上传」，
   不能假装能自动抓账号全部视频。
2. **视觉/剪辑分析**：依赖真实视频理解。`AI_VISION_MOCK` 或未配置 QWEN_VL 时，标 `available:false`，
   绝不编造镜头数/字幕覆盖。
3. **Benchmark 数据**：目前 `lib/benchmarks.ts` 是种子库（人工填充）。"同赛道 TOP25%"需真实对标库，
   需采购/授权数据补充。无真实对标时，对比标注为「基于内部种子库，非全行业真实分布」。
4. **每个结论必须有 evidence 溯源**，否则不产出。
