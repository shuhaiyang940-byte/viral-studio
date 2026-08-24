import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureSchema, hasDatabase } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createEmailToken, verifyEmailLink, emailShell } from "@/lib/auth/tokens";
import { sendMail, shouldExposeDevLink } from "@/lib/mail";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim().slice(0, 40);

  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  if (email.length > 120) return NextResponse.json({ error: "邮箱过长" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  if (password.length > 72) {
    // bcrypt 只取前 72 字节，超长直接拒绝，避免「密码被静默截断」的安全错觉
    return NextResponse.json({ error: "密码最长 72 位" }, { status: 400 });
  }
  // 防批量注册：同 IP 1 小时最多 5 个账号（限流放在数据库检查之前）
  const reg = rateLimit(`register:ip:${clientIp(req)}`, 5, 60 * 60_000);
  if (!reg.ok) {
    return NextResponse.json(
      { error: "注册过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(reg.retryAfter) } }
    );
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "服务端尚未配置数据库（DATABASE_URL），账号功能暂不可用" },
      { status: 503 }
    );
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length) return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });

    const id = randomUUID();
    const hash = await hashPassword(password);
    const rows = await sql`
      INSERT INTO users (id, email, password_hash, name)
      VALUES (${id}, ${email}, ${hash}, ${name})
      RETURNING id, email, name, tier, email_verified`;
    const u = rows[0];
    const user = {
      id: u.id,
      email: u.email,
      name: u.name,
      tier: u.tier,
      emailVerified: u.email_verified === true,
    };
    let devLink: string | undefined;
    const res = NextResponse.json({ user });
    await setSession(res, { sub: u.id, email: u.email, name: u.name, tier: u.tier });

    // 发送验证邮件（失败不阻断注册；开发模式把链接带回响应方便联调）
    const token = await createEmailToken(id, "verify-email");
    if (token) {
      const link = verifyEmailLink(token);
      const result = await sendMail({
        to: email,
        subject: "验证你的爆款研究所邮箱",
        html: emailShell(
          "验证邮箱",
          `<p>欢迎加入爆款研究所${name ? `，${name}` : ""}！</p>
           <p>点击下面的按钮完成邮箱验证（24 小时内有效）：</p>
           <p style="text-align:center">
             <a href="${link}" style="display:inline-block;padding:10px 22px;background:#6d28d9;color:#fff;border-radius:8px;text-decoration:none">验证邮箱</a>
           </p>
           <p style="word-break:break-all;font-size:12px;color:#9ca3af">或复制链接：${link}</p>`,
          "24 小时"
        ),
        text: `验证邮箱链接（24 小时内有效）：${link}`,
      });
      if (result.ok && shouldExposeDevLink(result.method)) devLink = link;
    }
    if (devLink) {
      // 开发模式把验证链接带回响应（生产环境绝不返回）
      const body = { user, devVerifyLink: devLink };
      const finalRes = NextResponse.json(body);
      await setSession(finalRes, { sub: u.id, email: u.email, name: u.name, tier: u.tier });
      return finalRes;
    }
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "注册失败" }, { status: 500 });
  }
}
