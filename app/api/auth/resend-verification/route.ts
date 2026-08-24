import { NextRequest, NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { createEmailToken, verifyEmailLink, emailShell } from "@/lib/auth/tokens";
import { sendMail, shouldExposeDevLink } from "@/lib/mail";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 重新发送邮箱验证邮件 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`resend-verification:ip:${clientIp(req)}`, 5, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "尝试过于频繁，请稍后再试" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "数据库未配置，邮件验证不可用" }, { status: 503 });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, email_verified FROM users WHERE email = ${email}`;
    const okBody = { ok: true, message: "如果该邮箱已注册且未验证，我们已发送验证邮件。" };
    if (!rows.length || rows[0].email_verified === true) return NextResponse.json(okBody);

    const token = await createEmailToken(String(rows[0].id), "verify-email");
    if (!token) {
      return NextResponse.json({ error: "创建验证令牌失败，请稍后再试" }, { status: 500 });
    }

    const link = verifyEmailLink(token);
    const result = await sendMail({
      to: email,
      subject: "验证你的爆款研究所邮箱",
      html: emailShell(
        "验证邮箱",
        `<p>点击下面的按钮完成邮箱验证（24 小时内有效）：</p>
         <p style="text-align:center">
           <a href="${link}" style="display:inline-block;padding:10px 22px;background:#6d28d9;color:#fff;border-radius:8px;text-decoration:none">验证邮箱</a>
         </p>
         <p style="word-break:break-all;font-size:12px;color:#9ca3af">或复制链接：${link}</p>`,
        "24 小时"
      ),
      text: `验证邮箱链接（24 小时内有效）：${link}`,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "邮件发送失败，请稍后再试或联系管理员" },
        { status: 500 }
      );
    }

    const dev = shouldExposeDevLink(result.method);
    return NextResponse.json(dev ? { ...okBody, devLink: link } : okBody);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "请求失败" }, { status: 500 });
  }
}
