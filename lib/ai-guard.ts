import { NextRequest, NextResponse } from "next/server";
import { globalRateLimit, clientIp } from "./rate-limit";
import { hasDatabase, q } from "./db";
import { logApiError } from "./analytics";

/**
 * AI 接口防刷守卫（IP 维度）。
 *
 * 能力：
 *  1. 滑动窗口限流：每个 IP 在窗口内（默认 1 小时）只能调用 N 次；
 *  2. 自动封禁：连续触发限流达到阈值后，该 IP 自动进入封禁名单（默认 24 小时）；
 *  3. 封禁名单持久化：有数据库时写入 ip_blocklist 表，多实例共享；
 *     无数据库时退化为内存封禁（单实例有效）。
 *  4. 管理接口 / 脚本：/api/admin/ip 可查、可手动封、可解封。
 *
 * 环境变量（均可选）：
 *  - AI_LIMIT_<SCOPE>：单 IP 每小时次数，如 AI_LIMIT_ANALYZE=10
 *  - AI_BAN_THRESHOLD：连续几次触发限流后封禁（默认 3）
 *  - AI_BAN_MS：封禁时长毫秒（默认 24 小时）
 *  - ADMIN_TOKEN：管理接口口令（不配置则管理接口直接拒绝）
 */

export type AiScope =
  | "analyze"
  | "copy"
  | "replicate"
  | "clinic"
  | "hotspots"
  | "plan"
  | "render"
  | "creative";

const DEFAULT_LIMITS: Record<AiScope, { limit: number; windowMs: number }> = {
  analyze: { limit: 10, windowMs: 60 * 60_000 },
  copy: { limit: 30, windowMs: 60 * 60_000 },
  replicate: { limit: 10, windowMs: 60 * 60_000 },
  clinic: { limit: 30, windowMs: 60 * 60_000 },
  hotspots: { limit: 30, windowMs: 60 * 60_000 },
  plan: { limit: 20, windowMs: 60 * 60_000 },
  render: { limit: 5, windowMs: 60 * 60_000 },
  creative: { limit: 60, windowMs: 60 * 60_000 },
};

function intEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function scopeLimit(scope: AiScope) {
  const base = DEFAULT_LIMITS[scope];
  const limit = intEnv(`AI_LIMIT_${scope.toUpperCase()}`, base.limit);
  return { limit, windowMs: base.windowMs };
}

const BAN_THRESHOLD = intEnv("AI_BAN_THRESHOLD", 3);
const BAN_MS = intEnv("AI_BAN_MS", 24 * 60 * 60_000);

/* ---------- 内存态：封禁名单 / 违规计数 / DB 查询缓存 ---------- */

const blockedMemory = new Map<string, { until: number }>();
/** DB 封禁名单的短缓存（避免每个请求都打一次数据库） */
const dbCheckCache = new Map<string, { until: number; checkedAt: number }>();
const DB_CACHE_MS = 60_000;

/** 判断 IP 是否被封禁（内存优先，数据库兜底，带 60s 缓存） */
export async function isIpBlocked(
  ip: string
): Promise<{ blocked: boolean; until: number | null }> {
  if (!ip || ip === "unknown") return { blocked: false, until: null };

  const mem = blockedMemory.get(ip);
  if (mem) {
    if (mem.until > Date.now()) return { blocked: true, until: mem.until };
    blockedMemory.delete(ip);
  }

  const cached = dbCheckCache.get(ip);
  if (cached && Date.now() - cached.checkedAt < DB_CACHE_MS) {
    return cached.until > Date.now()
      ? { blocked: true, until: cached.until }
      : { blocked: false, until: null };
  }

  let until = 0;
  if (hasDatabase()) {
    try {
      const rows = await q<{ expires_at: string | null }>(
        `SELECT expires_at FROM ip_blocklist
         WHERE ip = $1 AND (expires_at IS NULL OR expires_at > now())
         LIMIT 1`,
        [ip]
      );
      if (rows.length) {
        until = rows[0].expires_at
          ? new Date(rows[0].expires_at).getTime()
          : Number.MAX_SAFE_INTEGER;
      }
    } catch (e) {
      console.warn("[ai-guard] 封禁名单查询失败，降级为内存判断：", e);
    }
  }
  dbCheckCache.set(ip, { until, checkedAt: Date.now() });
  return until > Date.now() ? { blocked: true, until } : { blocked: false, until: null };
}

/** 封禁一个 IP（内存 + 数据库双写；数据库失败时仅内存生效） */
export async function banIp(
  ip: string,
  reason: string,
  ms: number = BAN_MS
): Promise<void> {
  const until = Date.now() + ms;
  blockedMemory.set(ip, { until });
  dbCheckCache.set(ip, { until, checkedAt: Date.now() });
  if (!hasDatabase()) return;
  try {
    await q(
      `INSERT INTO ip_blocklist (ip, reason, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (ip)
       DO UPDATE SET reason = EXCLUDED.reason, expires_at = EXCLUDED.expires_at`,
      [ip, reason, new Date(until).toISOString()]
    );
  } catch (e) {
    console.warn("[ai-guard] 封禁写入数据库失败（仅内存生效）：", e);
  }
}

/** 解封一个 IP */
export async function unbanIp(ip: string): Promise<void> {
  blockedMemory.delete(ip);
  dbCheckCache.delete(ip);
  if (!hasDatabase()) return;
  try {
    await q(`DELETE FROM ip_blocklist WHERE ip = $1`, [ip]);
  } catch (e) {
    console.warn("[ai-guard] 解封数据库失败（已清除内存封禁）：", e);
  }
}

export interface BlockedIpInfo {
  ip: string;
  until: number | null;
  reason: string;
}

/** 列出当前生效的封禁（内存 + 数据库合并去重） */
export async function listBlockedIps(): Promise<BlockedIpInfo[]> {
  const out: BlockedIpInfo[] = [];
  const now = Date.now();
  for (const [ip, b] of blockedMemory) {
    if (b.until > now) out.push({ ip, until: b.until, reason: "内存封禁" });
  }
  if (hasDatabase()) {
    try {
      const rows = await q<{ ip: string; reason: string; expires_at: string | null }>(
        `SELECT ip, reason, expires_at FROM ip_blocklist
         WHERE expires_at IS NULL OR expires_at > now()`
      );
      const seen = new Set(out.map((o) => o.ip));
      for (const r of rows) {
        if (seen.has(r.ip)) continue;
        out.push({
          ip: r.ip,
          until: r.expires_at ? new Date(r.expires_at).getTime() : null,
          reason: r.reason || "手动/数据库封禁",
        });
      }
    } catch (e) {
      console.warn("[ai-guard] 封禁名单列表查询失败：", e);
    }
  }
  return out;
}

export type GuardResult =
  | { ok: true }
  | { ok: false; res: NextResponse };

/**
 * 在路由处理器开头调用：
 *   const g = await guardAiRequest(req, "analyze");
 *   if (!g.ok) return g.res;
 * 拦截顺序：封禁名单 → 滑动窗口限流 → 连续违规自动封禁。
 */
export async function guardAiRequest(
  req: NextRequest,
  scope: AiScope
): Promise<GuardResult> {
  // 研发 / 评测阶段：默认关闭 IP 限流与封禁，避免评测人员/真实登录用户反复被误封。
  // 正式上线时在环境变量设 AI_IP_LIMIT_ENABLED=1 才启用（封禁名单 + 滑动窗口 + 连续违规自动封）。
  if (process.env.AI_IP_LIMIT_ENABLED !== "1") return { ok: true };
  const ip = clientIp(req);

  // 1. 已封禁 IP 直接拒绝
  const { blocked, until } = await isIpBlocked(ip);
  if (blocked) {
    const untilIso =
      until === null || until === Number.MAX_SAFE_INTEGER
        ? null
        : new Date(until).toISOString();
    await logApiError({ endpoint: req.nextUrl.pathname, status: 403, errorType: "IP_BLOCKED" });
    return {
      ok: false,
      res: NextResponse.json(
        {
          error: "该 IP 因请求过于频繁已被临时封禁，如有疑问请联系管理员。",
          code: "IP_BLOCKED",
          scope,
          blockedUntil: untilIso,
        },
        {
          status: 403,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil(((until ?? Date.now()) - Date.now()) / 1000))
            ),
          },
        }
      ),
    };
  }

  // 2. 全局限流（数据库原子计数；无数据库时回退内存）
  const { limit, windowMs } = scopeLimit(scope);
  const key = `${scope}:${ip}`;
  const r = await globalRateLimit(key, limit, windowMs);
  if (r.ok) return { ok: true };

  // 3. 连续触发限流达到阈值 → 自动封禁（违规计数同样全局化）
  const violKey = `${scope}:viol:${ip}`;
  const viol = await globalRateLimit(violKey, Math.max(1, BAN_THRESHOLD - 1), windowMs);
  if (!viol.ok) {
    const now = Date.now();
    await banIp(
      ip,
      `自动封禁：${scope} 接口（${limit} 次/小时）被连续触发限流`,
      BAN_MS
    );
    await logApiError({ endpoint: req.nextUrl.pathname, status: 429, errorType: "RATE_LIMIT" });
    return {
      ok: false,
      res: NextResponse.json(
        {
          error: "检测到异常高频请求，该 IP 已被临时封禁，请稍后再试。",
          code: "IP_BANNED",
          scope,
          bannedUntil: new Date(now + BAN_MS).toISOString(),
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(BAN_MS / 1000)) },
        }
      ),
    };
  }

  await logApiError({ endpoint: req.nextUrl.pathname, status: 429, errorType: "RATE_LIMIT" });
  return {
    ok: false,
    res: NextResponse.json(
      {
        error: "请求过于频繁，请稍后再试。",
        code: "RATE_LIMITED",
        scope,
        retryAfter: r.retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(r.retryAfter) },
      }
    ),
  };
}
