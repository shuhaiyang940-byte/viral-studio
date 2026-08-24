import { hasDatabase, getSql } from "./db";

/**
 * 内存限流（滑动窗口计数）+ 全局限流（数据库原子计数）。
 *
 * 诚实说明它的边界：
 * - Serverless 每个实例各自计数，多实例下不是全局精确限流；
 * - 实例回收后计数清零。
 * 它挡不住有组织的分布式撞库，但足以挡住「同一 IP 疯狂试密码」这类最常见的暴力破解，
 * 且零依赖、零外部服务。等有 Redis / Upstash 时可平滑替换成同名接口。
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** 定期清理过期桶，避免内存无限增长 */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** 剩余可用次数 */
  remaining: number;
  /** 还需等待多少秒 */
  retryAfter: number;
}

/**
 * @param key    限流键（建议 `${路由}:${IP}` 或 `${路由}:${邮箱}`）
 * @param limit  窗口内允许次数
 * @param windowMs 窗口长度（毫秒）
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  b.count += 1;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

/**
 * 全局（跨实例）限流：用数据库做原子计数，多实例下精确共享。
 *
 * 实现：固定时间窗口 + 单条 UPSERT（Neon HTTP 单语句原子执行）。
 * 无数据库时自动回退到内存限流（单实例有效）。
 *
 * 注意：数据库限流每个请求多一次 DB 往返（约几十 ms），
 * 换取「多实例全局一致」；Vercel 多实例部署时这是必要成本。
 */
export async function globalRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!hasDatabase()) return rateLimit(key, limit, windowMs);
  try {
    const sql = getSql();
    const win = Math.floor(Date.now() / windowMs);
    const rows = await sql`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, ${win})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.window_start = ${win}
                     THEN rate_limits.count + 1
                     ELSE 1 END,
        window_start = ${win}
      RETURNING count, window_start`;
    const count = Number(rows[0]?.count ?? 1);

    // 惰性清理：约 1% 概率清掉上一窗口及更早的计数，避免表无限膨胀
    if (Math.random() < 0.01) {
      sql`DELETE FROM rate_limits WHERE window_start < ${win - 1}`.catch(() => {});
    }

    if (count > limit) {
      const resetAt = (win + 1) * windowMs;
      return {
        ok: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
      };
    }
    return { ok: true, remaining: limit - count, retryAfter: 0 };
  } catch (e) {
    console.warn("[rate-limit] 数据库限流失败，回退内存限流：", e);
    return rateLimit(key, limit, windowMs);
  }
}

/** 登录成功后清掉失败计数，避免正常用户被自己的历史失败拖累 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** 从请求头里取客户端 IP（Vercel / 常见反代都会带 x-forwarded-for） */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
