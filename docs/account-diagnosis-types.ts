// 账号诊断系统 · 程序层类型规格（v0.1）
// 对应 docs/account-diagnosis-spec.md 的 ①~⑦ 层。
// 开发时直接引用本文件，保证前/后端/规则引擎用同一套 DTO。
// 标注 [SPEC] 表示未来由真实数据源填充；现阶段的采集依赖"用户提供链接/上传"或降级。

// ─── ① Account Collector ───────────────────────────────────────────────
export type Platform = "douyin" | "xiaohongshu" | "shipinhao" | "bilibili" | "tiktok";

export interface AccountProfile {
  id: string;            // acct_<account_key hash>
  platform: Platform;
  accountKey: string;    // sec_uid / handle / 数字id（重名辨识）
  displayName: string;
  followers: number;     // [SPEC] 需真实数据源
  likes: number;         // [SPEC]
  worksCount: number;    // [SPEC]
  bio?: string;
  verified: boolean;
  industry?: string;     // 用户填
  goal?: string;         // 涨粉/获客/品牌
}

export interface AccountSnapshot {
  capturedAt: string;
  followers: number;
  likes: number;
  worksCount: number;
  jobId?: string;
}

// ─── ② Content Collector ───────────────────────────────────────────────
export interface VideoMetrics {
  videoId: string;
  publishedAt?: string;
  durationSec?: number;
  plays?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  videoUrl?: string;     // [SPEC/用户提供]
  coverUrl?: string;
}

export interface VideoWithContent extends VideoMetrics {
  transcript?: string;         // ASR 字幕/口播
  ocrText?: string;            // 画面文字
  frames?: string[];           // 抽帧 dataURL [SPEC]
  understanding?: {
    coverageStatus: "FULL" | "PARTIAL" | "LOW" | "NONE";
    hasTranscript: boolean;
    hasVision: boolean;
    hasOcr: boolean;
    note: string;
  };
}

// ─── ③ Content Analysis ───────────────────────────────────────────────
export type AnalyzerId =
  | "hook" | "script" | "structure" | "visual"
  | "editing" | "audio" | "cta" | "topic" | "emotion";

export interface AnalyzerContext {
  video: VideoWithContent;
  config: { visual: "real" | "mock" | "none" };
}

export interface AnalyzerResult {
  analyzer: AnalyzerId;
  data: Record<string, unknown>;              // 结构化产出
  available: boolean;                          // 视觉/剪辑可能不可用（诚实）
  reason?: string;                             // available=false 时的原因
  evidence?: { finding: string; timestamp?: string }[];
}

export interface VideoAnalyzer {
  id: AnalyzerId;
  run(ctx: AnalyzerContext): Promise<AnalyzerResult>;
}

// ─── ④ Benchmark Engine ───────────────────────────────────────────────
export interface BenchmarkMetric {
  key: string;             // like_rate / comment_rate / share_rate / freq / dur
  p25: number;             // 同行 25分位
  p50: number;
  p75: number;
  source: "internal_seed" | "real_market";   // 内部种子库 vs 真实市场（诚实区分）
  note?: string;
}

export interface BenchmarkGroup {
  platform: Platform;
  niche: string;
  tier: string;            // 粉丝量级
  metrics: BenchmarkMetric[];
}

// ─── ⑤ Diagnosis Engine ───────────────────────────────────────────────
export interface Metric {
  key: string;
  accountValue: number;
  benchmarkValue: number;
  pctRank: number;         // 相对同行百分位
  delta: number;
}

export interface Signal {
  metricKey: string;
  severity: "high" | "medium" | "low";
  gap: number;             // 账号值 - 对标值
}

export interface Evidence {
  videoId: string;
  finding: string;
  timestamp?: string;
}

export interface Hypothesis {
  reason: string;
  support: number;         // 命中率 0-1
}

export interface Diagnosis {
  metricKey: string;
  severity: "high" | "medium" | "low";
  title: string;
  rootCause: string;
  confidence: number;
  evidence: Evidence[];
}

export interface DiagnoseResult {
  metrics: Metric[];
  signals: Signal[];
  diagnoses: Diagnosis[];
}

// ─── ⑥ Strategy Engine ───────────────────────────────────────────────
export interface Recommendation {
  id: string;
  diagnosisId: string;
  title: string;
  detail: string;
  template?: string;          // 具体可照做
  verifyPeriod?: string;      // 验证周期
  successMetric?: string;     // 成功指标（如 评论率≥0.45%）
  priority: number;           // 1-5
}

// ─── ⑦ Report Engine ─────────────────────────────────────────────────
export interface DiagnosisReportSummary {
  contentQuality: number;      // 内容质量
  contentStrategy: number;     // 内容策略
  userInteraction: number;     // 用户互动
  accountPositioning: number;  // 账号定位
  updateStability: number;     // 更新稳定性
}

export interface DiagnosisReport {
  id: string;
  profileId: string;
  niche?: string;
  goal?: string;
  healthScore: number;         // 0-100
  summary: DiagnosisReportSummary;
  topProblem: {
    title: string;
    detail: string;
    evidence: Evidence[];
    priority: number;
  };
  metrics: Metric[];
  diagnoses: Diagnosis[];
  recommendations: Recommendation[];
  tier: "free" | "creator" | "pro" | "studio";
  createdAt: string;
}

// ─── 分层常量（成本控制） ─────────────────────────────────────────────
export const DIAGNOSIS_VIDEO_CAP: Record<"free" | "creator" | "pro" | "studio", number> = {
  free: 10,
  creator: 30,
  pro: 100,
  studio: 1000,
};
