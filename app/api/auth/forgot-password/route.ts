import { NextRequest, NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { createEmailToken, resetPasswordLink, emailShell } from "@/lib/auth/tokens";
import { sendMail, shouldExposeDevLink } from "@/lib/mail";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 忘记密码：生成重置令牌并发邮件（不泄露邮箱是否存在） */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`forgot-password:ip:${clientIp(req)}`, 5, 60 * 60_000);
  const rlEmail = rateLimit(`forgot-password:email:${clientIp(req)}`, 3, 60 * 60_000);
  if (!rl.ok || !rlEmail.ok) {
    return NextResponse.json({ error: "尝试过于频繁，请稍后再试" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "数据库未配置，找回密码不可用" }, { status: 503 });
  }

  try {
    const sql = getSql();
    const rows = await sql`SELECT id, name FROM users WHERE email = ${email}`;
    // 统一提示，避免被用来探测注册邮箱
    const okBody = {
      ok: true,
      message: "如果该邮箱已注册，我们已发送重置链接，请查收。",
    };
    if (!rows.length) return NextResponse.json(okBody);

    const token = await createEmailToken(String(rows[0].id), "reset-password");
    if (!token) {
      return NextResponse.json({ error: "创建重置令牌失败，请稍后再试" }, { status: 500 });
    }

    const link = resetPasswordLink(token);
    const result = await sendMail({
      to: email,
      subject: "重置你的爆款研究所密码",
      html: emailShell(
        "重置密码",
        `<p>你好${rows[0].name ? `，${rows[0].name}` : ""}：</p>
         <p>点击下面的按钮重置密码（24 小时内有效）：</p>
         <p style="text-align:center">
           <a href="${link}" style="display:inline-block;padding:10px 22px;background:#6d28d9;color:#fff;border-radius:8px;text-decoration:none">重置密码</a>
         </p>
         <p style="word-break:break-all;font-size:12px;color:#9ca3af">或复制链接：${link}</p>`,
        "24 小时"
      ),
      text: `重置密码链接（24 小时内有效）：${link}`,
    });

    if (!result.ok) {
      console.warn("[forgot-password] 邮件发送失败：", result.error);
      return NextResponse.json(
        { error: "邮件发送失败，请稍后再试或联系管理员" },
        { status: 500 }
      );
    }

    // 开发模式（未配置邮件服务）把链接带回响应，方便本地联调
    const dev = shouldExposeDevLink(result.method);
    return NextResponse.json(dev ? { ...okBody, devLink: link } : okBody);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "请求失败" }, { status: 500 });
  }
}
