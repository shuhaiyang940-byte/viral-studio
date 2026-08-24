/**
 * 会员权益矩阵（单一事实源）。
 *
 * 规则（与定价页一致）：
 *  - 免费版：每天 1 次完整分析（含完整报告 + 分镜表）；
 *  - 创作者版：每天 5 次，解锁 AI 写文案、公式库全量；
 *  - 进阶版：不限次，解锁爆款复刻助手 + AI 导演；
 *  - 专业版：不限次，全部能力 + 长期陪跑（roadmap 见定价页）。
 *
 * 公测期内容全站开放（NEXT_PUBLIC_FREE_FULL_ACCESS=1），
 * 档位差异通过「每日次数」真实生效；正式收费后 features 门禁一并启用。
 * 每日次数可用环境变量覆盖：DAILY_ANALYZE_FREE / DAILY_ANALYZE_CREATOR。
 */

export type Tier = "free" | "creator" | "pro" | "studio";

export const TIER_ORDER: Tier[] = ["free", "creator", "pro", "studio"];

export const TIER_LABELS: Record<Tier, string> = {
  free: "免费版",
  creator: "创作者版",
  pro: "进阶版",
  studio: "专业版",
};

export interface TierEntitlement {
  tier: Tier;
  label: string;
  /** 每日分析次数；null = 不限次 */
  dailyAnalyze: number | null;
  features: {
    /** 完整报告（8 段） */
    fullReport: boolean;
    /** 分镜表（分镜拆解 / 主题适配 / 拍摄脚本） */
    storyboard: boolean;
    /** AI 写文案 */
    copywriting: boolean;
    /** 公式库全量 */
    formulaFull: boolean;
    /** 爆款复刻助手 */
    replica: boolean;
    /** 我的 AI 导演 */
    director: boolean;
  };
}

function intEnv(name: string, fallback: number): number | null {
  const v = parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(v) || v < 0) return fallback;
  return v === 0 ? null : v; // 0 表示不限次（显式声明）
}

export const ENTITLEMENTS: Record<Tier, TierEntitlement> = {
  free: {
    tier: "free",
    label: "免费版",
    dailyAnalyze: intEnv("DAILY_ANALYZE_FREE", 1),
    features: {
      fullReport: true,
      storyboard: true,
      copywriting: false,
      formulaFull: false,
      replica: false,
      director: false,
    },
  },
  creator: {
    tier: "creator",
    label: "创作者版",
    dailyAnalyze: intEnv("DAILY_ANALYZE_CREATOR", 5),
    features: {
      fullReport: true,
      storyboard: true,
      copywriting: true,
      formulaFull: true,
      replica: false,
      director: false,
    },
  },
  pro: {
    tier: "pro",
    label: "进阶版",
    dailyAnalyze: null,
    features: {
      fullReport: true,
      storyboard: true,
      copywriting: true,
      formulaFull: true,
      replica: true,
      director: true,
    },
  },
  studio: {
    tier: "studio",
    label: "专业版",
    dailyAnalyze: null,
    features: {
      fullReport: true,
      storyboard: true,
      copywriting: true,
      formulaFull: true,
      replica: true,
      director: true,
    },
  },
};

export function entitlementFor(tier: string | undefined | null): TierEntitlement {
  if (tier && tier in ENTITLEMENTS) return ENTITLEMENTS[tier as Tier];
  return ENTITLEMENTS.free;
}

/** 功能是否对该档位开放（公测期内容全开放；收费上线后此函数接入门禁） */
export function canUseFeature(
  tier: string | undefined | null,
  feature: keyof TierEntitlement["features"]
): boolean {
  // 公测期：内容功能全开放（次数差异已真实生效）
  if (process.env.NEXT_PUBLIC_FREE_FULL_ACCESS !== "0") return true;
  return entitlementFor(tier).features[feature];
}
