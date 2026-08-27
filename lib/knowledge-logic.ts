// 纯逻辑层：Learning Value / Weight / Lifecycle / Version 判定。
// 无任何 DB / 网络 / config 依赖，便于单元测试与将来复用于不同存储。

export type Role =
  | "DIRECTOR"
  | "PRODUCER"
  | "OPERATOR"
  | "EDITOR"
  | "AUDIENCE"
  | "COMMON";
export const ROLES: Role[] = ["DIRECTOR", "PRODUCER", "OPERATOR", "EDITOR", "AUDIENCE", "COMMON"];

export type Lifecycle =
  | "NEW"
  | "TESTING"
  | "ACTIVE"
  | "WEAKENING"
  | "DEPRECATED"
  | "REJECTED";
export const LIFECYCLES: Lifecycle[] = ["NEW", "TESTING", "ACTIVE", "WEAKENING", "DEPRECATED", "REJECTED"];

export type TrendType = "LONG_TERM" | "MID_TERM" | "SHORT_TERM" | "MEME";

export type SourceStatus =
  | "OK"
  | "PARTIAL"
  | "SOURCE_UNAVAILABLE"
  | "NO_DATA"
  | "DEMO";

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

/* ─────────── 1. Learning Value Score（0-100） ───────────
 * 不是「出现次数越多越高」。十个维度加权，权重参数暴露在这里，可调、可审计。
 */
export interface ValueFactors {
  evidence: number; // 0-100 证据量（多案例重复）
  recency: number; // 0-100 近因（最近被验证/被看见）
  confidence: number; // 0-100 置信
  longevity: number; // 0-100 长期性
  transferability: number; // 0-100 跨平台/跨内容
  reproducibility: number; // 0-100 可复现性
  contradiction: number; // 0-100 反例惩罚（越大越扣）
  platformRelevance: number; // 0-100
  categoryRelevance: number; // 0-100
  userOutcome: number; // 0-100 真实创作结果支持
}

const VALUE_WEIGHTS = {
  evidence: 0.12,
  recency: 0.08,
  confidence: 0.12,
  longevity: 0.14,
  transferability: 0.12,
  reproducibility: 0.1,
  contradiction: 0.08, // 反向
  platformRelevance: 0.08,
  categoryRelevance: 0.08,
  userOutcome: 0.08,
};

export function learningValueScore(f: Partial<ValueFactors>): number {
  const base = {
    evidence: 0, recency: 0, confidence: 0, longevity: 0, transferability: 0,
    reproducibility: 0, contradiction: 0, platformRelevance: 0, categoryRelevance: 0,
    userOutcome: 0,
    ...f,
  };
  let score = 0;
  let wsum = 0;
  (Object.keys(VALUE_WEIGHTS) as (keyof typeof VALUE_WEIGHTS)[]).forEach((k) => {
    const w = VALUE_WEIGHTS[k];
    const v = clamp(base[k]);
    if (k === "contradiction") {
      score -= w * v; // 反例越多，Learning Value 越低
    } else {
      score += w * v;
    }
    wsum += w;
  });
  return clamp(Math.round((score / wsum) * 10) / 10, 0, 100) as unknown as number;
}

/* ─────────── 2. Weight 计算（升 / 降 / 保持 / DEPRECATED） ───────────
 * 必须在「有证据」的前提下才升权；无证据一律保持或降权。
 */
export interface WeightParam {
  currentWeight: number;
  evidenceCount: number;
  successCount: number;
  failCount: number;
  confidence: number; // 0-100
  learningValue: number; // 0-100
  transferability: number; // 0-100
  recentSignalDays: number | null; // null=从未有最近信号
}

export function computeWeight(p: WeightParam): number {
  let w = p.currentWeight;
  const failRatio = p.evidenceCount > 0 ? p.failCount / p.evidenceCount : 0;

  if (failRatio > 0.5) {
    // 反例多 → 明显降权
    w -= 8 + failRatio * 12;
  } else {
    // 正面证据：证据越多、置信越高才升得越多
    const evidenceBoost = Math.min(12, p.evidenceCount * 1.5);
    const confidenceBoost = p.confidence >= 60 ? 3 : p.confidence >= 40 ? 1 : p.confidence > 0 ? -1 : -3;
    const valueBoost = p.learningValue >= 65 ? 3 : p.learningValue >= 40 ? 1 : -2;
    const transferBoost = p.transferability >= 60 ? 2 : p.transferability >= 35 ? 1 : -1;
    w += (evidenceBoost + confidenceBoost + valueBoost + transferBoost) * (p.evidenceCount > 0 ? 1 : 0);
  }

  // 长期无最近信号 → 缓慢衰减
  if (p.recentSignalDays != null && p.recentSignalDays > 30) {
    w -= Math.min(5, (p.recentSignalDays - 30) / 15);
  }
  if (p.recentSignalDays == null) {
    w -= 1; // 从未被最近信号支持，轻降
  }

  return clamp(Math.round(w * 10) / 10, 0, 100);
}

/** 反例：置信度与权重都应下降（而不是继续增加）。 */
export function applyCounterExample(
  currentWeight: number,
  currentConfidence: number,
  severity = 1
): { weight: number; confidence: number } {
  return {
    weight: clamp(currentWeight - 6 * severity, 0, 100),
    confidence: clamp(currentConfidence - 8 * severity, 0, 100),
  };
}

/* ─────────── 3. Lifecycle 转移 ─────────── */
export interface LifecycleParam {
  current: Lifecycle;
  weight: number;
  confidence: number; // 0-100
  evidenceCount: number;
  recentSignalDays: number | null; // null=从未有最近信号
}

export function nextLifecycle(p: LifecycleParam): Lifecycle {
  const stale = p.recentSignalDays == null || p.recentSignalDays > 30;
  switch (p.current) {
    case "NEW":
      return p.evidenceCount >= 2 &&
        p.confidence >= 40 &&
        (p.weight >= 50 || p.recentSignalDays == null)
        ? "TESTING"
        : "NEW";
    case "TESTING":
      if (p.confidence < 25 && p.evidenceCount >= 2) return "REJECTED";
      if (p.evidenceCount >= 4 && p.confidence >= 50 && p.weight >= 55) return "ACTIVE";
      return stale ? "NEW" : "TESTING";
    case "ACTIVE":
      if (p.weight < 38 || stale) return "WEAKENING";
      return "ACTIVE";
    case "WEAKENING":
      if (p.weight < 22 || (stale && p.recentSignalDays != null && p.recentSignalDays > 60)) return "DEPRECATED";
      return "WEAKENING";
    case "DEPRECATED":
    case "REJECTED":
      return p.current;
    default:
      return "NEW";
  }
}

/** 是否需要生成新版本（权重 / 置信 / 生命周期任一显著变化即版本化）。 */
export function shouldVersion(prev: {
  weight: number;
  lifecycle: Lifecycle;
  confidence: number;
}, next: {
  weight: number;
  lifecycle: Lifecycle;
  confidence: number;
}): boolean {
  return (
    Math.abs(prev.weight - next.weight) >= 1 ||
    prev.lifecycle !== next.lifecycle ||
    Math.abs(prev.confidence - next.confidence) >= 5
  );
}

/** Recency 分数：近 0 天=100；120 天及以上=0；中间线性下探。 */
export function recencyScore(days: number | null): number {
  if (days == null) return 0;
  if (days <= 0) return 100;
  return clamp(Math.round(100 - (days / 120) * 100), 0, 100);
}
