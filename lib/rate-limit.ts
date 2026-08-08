/**
 * 极简内存限流（滑动窗口计数）。
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
