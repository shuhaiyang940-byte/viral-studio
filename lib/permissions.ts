// 服务端统一会员权限判断层。
// 原则：客户端永远不能决定自己的会员身份；权限只来自「当前登录用户 + 数据库真实 tier」。
//
// 注意：这里直接用 entitlementFor(tier).features，**不**受 NEXT_PUBLIC_FREE_FULL_ACCESS
// 公测放宽影响——权限安全以真实会员状态为准，不做 UI 级放宽。
//
// 仅服务端引用（/api/...），切勿在 'use client' 中 import。

import { entitlementFor, type TierEntitlement } from "@/lib/entitlements";
import { capabilitiesFor, type Capability } from "@/lib/entitlements";
import { q, hasDatabase } from "@/lib/db";

export type Feature = keyof TierEntitlement["features"];

export interface EntitlementDecision {
  ok: boolean;
  status?: 401 | 403;
  error?: string;
  ent?: TierEntitlement;
}

/**
 * 从数据库读取用户当前真实会员权益（tier 以库为准，而非 JWT 快照，避免改档后不同步）。
 * 无数据库 / 查不到时按 free 处理（安全降级，绝不误放行）。
 */
export async function getUserEntitlements(userId: string): Promise<TierEntitlement> {
  if (!userId) return entitlementFor("free");
  if (!hasDatabase()) return entitlementFor("free");
  try {
    const rows = await q<{ tier: string }>("SELECT tier FROM users WHERE id = $1", [userId]);
    return entitlementFor(rows[0]?.tier);
  } catch {
    return entitlementFor("free");
  }
}

/**
 * 校验当前用户是否可用某会员功能。
 *   userId 为空        → 401 未登录
 *   登录但档位无此功能 → 403 无权限（需升级）
 *   有权限            → { ok:true, ent }
 * 业务 API 据此决定放行，并可用 ent.tier 判断"是否 Pro 档"（决定输出量等）。
 */
export async function requireEntitlement(
  userId: string | undefined | null,
  feature: Feature
): Promise<EntitlementDecision> {
  if (!userId) {
    return { ok: false, status: 401, error: "未登录，请先登录后再使用该功能" };
  }
  const ent = await getUserEntitlements(userId);
  if (!ent.features[feature]) {
    return { ok: false, status: 403, error: "当前账号暂无该功能权限，请升级会员" };
  }
  return { ok: true, ent };
}

/** 是否 Pro / Studio 档（决定「完整输出」级别） */
export function isProTier(tier: string | undefined | null): boolean {
  return tier === "pro" || tier === "studio";
}

/* ─────────── 统一 Capability Gate（Free / Pro 付费断点） ─────────── */

export interface CapDecision {
  ok: boolean;
  status?: 401 | 403;
  error?: string;
  ent?: TierEntitlement;
  /** 当前已完成什么 */
  done?: string[];
  /** Pro 解锁什么 */
  unlock?: string[];
}

export const PRO_GATE_INFO: Record<Capability, { done: string[]; unlock: string[] }> = {
  scriptFull: {
    done: ["你的爆款分析已完成", "你的脚本预览已生成"],
    unlock: ["完整脚本", "完整分镜", "完整拍摄计划", "当前项目直接继续"],
  },
  storyboardFull: {
    done: ["你的脚本预览已生成", "分镜预览已就绪"],
    unlock: ["完整分镜", "完整拍摄计划", "按镜头的拍摄指导"],
  },
  planFull: {
    done: ["你的脚本与分镜已生成"],
    unlock: ["完整拍摄计划", "完整剪辑计划", "导出成片所需素材"],
  },
  export: {
    done: ["你的创作内容已生成"],
    unlock: ["导出提词器", "导出分镜表", "导出剪映草稿"],
  },
  advanced: {
    done: ["基础分析已完成"],
    unlock: ["深度分析", "账号诊断", "AI 导演长期陪跑"],
  },
  analysisDeep: {
    done: ["基础爆款分析已完成"],
    unlock: ["深度商业分析", "对标黑马对比", "账号诊所"],
  },
  // 以下 preview 类不设门禁（Free 开放），此处仅占位
  analysisBasic: { done: [], unlock: [] },
  scriptPreview: { done: [], unlock: [] },
  storyboardPreview: { done: [], unlock: [] },
  planPreview: { done: [], unlock: [] },
};

/**
 * 服务端能力门禁：未登录 / free 只开放 preview 类，完整类（scriptFull/storyboardFull/planFull/export/advanced）需 Pro。
 * 返回 403 + PRO_GATE 明确文案（已完成什么、升级解锁什么），并在 ent 里带上档位。
 */
export async function requireCapability(
  userId: string | undefined | null,
  cap: Capability
): Promise<CapDecision> {
  const ent = await getUserEntitlements(userId ?? "");
  if (capabilitiesFor(ent.tier)[cap]) {
    return { ok: true, ent };
  }
  const info = PRO_GATE_INFO[cap] ?? { done: [], unlock: [] };
  return {
    ok: false,
    status: 403,
    error: "需要升级会员解锁该完整能力",
    done: info.done,
    unlock: info.unlock,
    ent,
  };
}
