// 服务端统一会员权限判断层。
// 原则：客户端永远不能决定自己的会员身份；权限只来自「当前登录用户 + 数据库真实 tier」。
//
// 注意：这里直接用 entitlementFor(tier).features，**不**受 NEXT_PUBLIC_FREE_FULL_ACCESS
// 公测放宽影响——权限安全以真实会员状态为准，不做 UI 级放宽。
//
// 仅服务端引用（/api/...），切勿在 'use client' 中 import。

import { entitlementFor, type TierEntitlement } from "@/lib/entitlements";
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
