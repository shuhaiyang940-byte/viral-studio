import { createHash, randomBytes } from "node:crypto";
import { getSql, hasDatabase, q } from "@/lib/db";

export type EmailTokenType = "verify-email" | "reset-password";

/**
 * 生成一次性邮件令牌（验证邮箱 / 重置密码共用）。
 * 原始 token 只出现在邮件链接里；数据库只存 sha256 哈希，降低泄库风险。
 */
export async function createEmailToken(
  userId: string,
  type: EmailTokenType,
  ttlMs = 24 * 3600_000
): Promise<string | null> {
  if (!hasDatabase()) return null;
  const raw = randomBytes(32).toString("hex");
  const hash = sha256(raw);
  try {
    const sql = getSql();
    // 直接在 JS 端算好过期时间（避免依赖 make_interval 等数据库函数差异）
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await sql`
      INSERT INTO email_tokens (token_hash, user_id, type, expires_at)
      VALUES (${hash}, ${userId}, ${type}, ${expiresAt})`;
    return raw;
  } catch (e) {
    console.warn("[tokens] 创建令牌失败：", e);
    return null;
  }
}

/** 消费一次性令牌：校验 + 标记已用，返回对应用户 id */
export async function consumeEmailToken(
  rawToken: string,
  type: EmailTokenType
): Promise<string | null> {
  if (!hasDatabase() || !rawToken) return null;
  const hash = sha256(rawToken.trim());
  try {
    const sql = getSql();
    const rows = await sql`
      UPDATE email_tokens
      SET used_at = now()
      WHERE token_hash = ${hash}
        AND type = ${type}
        AND expires_at > now()
        AND used_at IS NULL
      RETURNING user_id`;
    return rows.length ? String(rows[0].user_id) : null;
  } catch (e) {
    console.warn("[tokens] 消费令牌失败：", e);
    return null;
  }
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** 邮件链接的站点根地址（生产必须配置 SITE_URL，否则退化为 localhost） */
export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function verifyEmailLink(token: string): string {
  return `${siteUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

export function resetPasswordLink(token: string): string {
  return `${siteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

/** 简单可复用的邮件 HTML 外壳 */
export function emailShell(title: string, bodyHtml: string, validity = "24 小时"): string {
  return `
  <div style="max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2337">
    <h2 style="margin:0 0 16px;color:#6d28d9">爆款研究所</h2>
    <div style="padding:20px;border:1px solid #e5e7eb;border-radius:12px;line-height:1.7">
      <h3 style="margin:0 0 12px">${title}</h3>
      ${bodyHtml}
    </div>
    <p style="margin-top:16px;font-size:12px;color:#9ca3af">
      如果这不是你的操作，请忽略本邮件。此链接 ${validity} 内有效。
    </p>
  </div>`;
}
