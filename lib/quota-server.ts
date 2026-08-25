import { NextRequest } from "next/server";
import { hasDatabase, q } from "./db";
import { clientIp } from "./rate-limit";
import { getCurrentUser } from "./auth/session";
import { entitlementFor } from "./entitlements";

/**
 * 服务端配额（会员功能的服务端基础）：
 * - 按会员档位限次：免费 1 次/天、创作者 5 次/天、进阶/专业不限次；
 * - 匿名用户：每 IP 每天 ANON_DAILY_ANALYZE 次（默认 3），防止白嫖 AI 额度。
 * 计数存在数据库 quota_usage 表，多实例共享；无数据库时开发模式不限制。
 */

function intEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export const ANON_DAILY_ANALYZE = intEnv("ANON_DAILY_ANALYZE", 3);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface QuotaInfo {
  /** null 表示不限次（会员） */
  limit: number | null;
  used: number;
  remaining: number | null;
  /** 是否登录（会员判断依据） */
  isPro: boolean;
}

async function readCount(key: string): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    const rows = await q<{ count: number }>(
      `SELECT count FROM quota_usage WHERE key = $1`,
      [key]
    );
    return Number(rows[0]?.count ?? 0);
  } catch (e) {
    console.warn("[quota] 查询失败（按 0 处理）：", e);
    return 0;
  }
}

/** 原子 +1 并返回最新计数（固定按天，跨天自动重置） */
async function increment(key: string): Promise<number> {
  if (!hasDatabase()) return 0;
  const day = today();
  const rows = await q<{ count: number }>(
    `INSERT INTO quota_usage (key, count, day) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN quota_usage.day = $2 THEN quota_usage.count + 1 ELSE 1 END,
       day = $2
     RETURNING count`,
    [key, day]
  );
  return Number(rows[0]?.count ?? 1);
}

/** 取当前用户/匿名 IP 的配额主体信息 */
export async function getQuotaForReq(
  req: NextRequest
): Promise<{ userKey: string | null; ipKey: string; limit: number | null; isPro: boolean }> {
  const user = await getCurrentUser();
  if (user) {
    // 会员等级以数据库为准（JWT 是签发时快照，demo-upgrade 后可能滞后）
    let tier = user.tier;
    if (hasDatabase()) {
      try {
        const rows = await q<{ tier: string }>(
          `SELECT tier FROM users WHERE id = $1`,
          [user.id]
        );
        if (rows.length) tier = rows[0].tier;
      } catch {
        /* 数据库抖动时沿用 JWT 快照 */
      }
    }
    const ent = entitlementFor(tier);
    const isPro = tier !== "free";
    return {
      userKey: `analyze:user:${user.id}:`,
      ipKey: `analyze:ip:${clientIp(req)}:`,
      limit: ent.dailyAnalyze,
      isPro,
    };
  }
  return {
    userKey: null,
    ipKey: `analyze:ip:${clientIp(req)}:`,
    limit: ANON_DAILY_ANALYZE,
    isPro: false,
  };
}

/** 只读配额（供 /api/quota 展示） */
export async function getQuotaInfo(req: NextRequest): Promise<QuotaInfo> {
  const { userKey, ipKey, limit, isPro } = await getQuotaForReq(req);
  if (limit === null) return { limit: null, used: 0, remaining: null, isPro: true };
  const used = await readCount(userKey ?? ipKey);
  return { limit, used, remaining: Math.max(0, limit - used), isPro };
}

export type QuotaCheck =
  | { ok: true; remaining: number | null; limit: number | null }
  | { ok: false; remaining: number; limit: number };

/** 分析前调用：消耗一次配额，超限返回失败（会员/开发模式不消耗） */
export async function checkAnalyzeQuota(req: NextRequest): Promise<QuotaCheck> {
  const { userKey, ipKey, limit, isPro } = await getQuotaForReq(req);
  void isPro; // 档位差异已由 limit 体现（免费 1 / 创作者 5 / 进阶+ 不限）
  if (limit === null) return { ok: true, remaining: null, limit: null };
  if (!hasDatabase()) return { ok: true, remaining: limit, limit };
  const key = userKey ?? ipKey;
  const count = await increment(key);
  if (count <= limit) return { ok: true, remaining: limit - count, limit };
  return { ok: false, remaining: 0, limit };
}

/**
 * 原子消耗一次配额：+1 并返回最新计数。
 * 并发安全：单条 INSERT ... ON CONFLICT DO UPDATE，count 单调递增，
 * 调用方在 count > limit 时可 refund 回退（超出的那次），保证并发不会刷穿。
 */
export async function consumeQuota(key: string): Promise<number> {
  return increment(key);
}

/** 原子回退一次配额（-1，最低到 0，且仅限当天），用于 AI 失败后退还额度 */
export async function refundQuota(key: string): Promise<void> {
  if (!hasDatabase()) return;
  const day = today();
  try {
    await q(
      `UPDATE quota_usage SET count = GREATEST(0, count - 1) WHERE key = $1 AND day = $2`,
      [key, day]
    );
  } catch (e) {
    console.warn("[quota] refund 失败：", e);
  }
}

/** 额度使用日志（consume / refund / success / failed），便于回答「为什么少了一次额度」 */
export async function logUsage(entry: {
  userId?: string | null;
  quotaType: string;
  amount: number;
  action: "consume" | "refund" | "success" | "failed";
  status?: "ok" | "failed";
  requestId?: string | null;
}): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await q(
      `INSERT INTO usage_logs (user_id, quota_type, amount, action, status, request_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.userId ?? null, entry.quotaType, entry.amount, entry.action, entry.status ?? null, entry.requestId ?? null]
    );
  } catch (e) {
    console.warn("[quota] log 失败（不影响主流程）：", e);
  }
}

/* ─────────── 生成类（脚本/分镜/文案等 AI 成本）配额 ───────────
 * 临时测试额度（非最终商业额度）：FREE=20 / CREATOR=50 / PRO=200 次每日。
 * 通过环境变量覆盖：FREE_GENERATE_DAILY_LIMIT / CREATOR_GENERATE_DAILY_LIMIT / PRO_GENERATE_DAILY_LIMIT。
 */
export function generateLimitFor(tier: string | undefined | null): number {
  if (tier === "pro" || tier === "studio") return intEnv("PRO_GENERATE_DAILY_LIMIT", 200);
  if (tier === "creator") return intEnv("CREATOR_GENERATE_DAILY_LIMIT", 50);
  return intEnv("FREE_GENERATE_DAILY_LIMIT", 20);
}

/** 原子消耗一次生成配额（按 operation 区分）；超限回退并返回失败 */
export async function consumeGenerationQuota(
  userId: string,
  operation: string,
  tier: string | undefined | null
): Promise<{ ok: boolean; remaining: number; limit: number }> {
  const limit = generateLimitFor(tier);
  const key = `gen:${operation}:user:${userId}:`;
  const count = await consumeQuota(key);
  if (count > limit) {
    await refundQuota(key);
    return { ok: false, remaining: 0, limit };
  }
  return { ok: true, remaining: limit - count, limit };
}

/** AI 失败时回退一次生成配额 */
export async function refundGenerationQuota(userId: string, operation: string): Promise<void> {
  await refundQuota(`gen:${operation}:user:${userId}:`);
}
