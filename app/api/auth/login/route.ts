import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureSchema, hasDatabase } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import { rateLimit, resetRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
  }
  // 防暴力破解：同 IP 15 分钟 20 次、同邮箱 15 分钟 10 次
  // 放在数据库检查之前 —— 限流必须是最外层的闸门
  const ipKey = `login:ip:${clientIp(req)}`;
  const emailKey = `login:email:${email}`;
  const ipLimit = rateLimit(ipKey, 20, 15 * 60_000);
  const emailLimit = rateLimit(emailKey, 10, 15 * 60_000);
  if (!ipLimit.ok || !emailLimit.ok) {
    const retryAfter = Math.max(ipLimit.retryAfter, emailLimit.retryAfter);
    return NextResponse.json(
      { error: `尝试过于频繁，请 ${Math.ceil(retryAfter / 60)} 分钟后再试` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
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
    const rows = await sql`
      SELECT id, email, name, tier, password_hash FROM users WHERE email = ${email}`;
    if (!rows.length) return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });

    const u = rows[0];
    const ok = await verifyPassword(password, u.password_hash);
    if (!ok) return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });

    // 登录成功，清掉该邮箱的失败计数
    resetRateLimit(emailKey);

    const res = NextResponse.json({
      user: { id: u.id, email: u.email, name: u.name, tier: u.tier },
    });
    await setSession(res, { sub: u.id, email: u.email, name: u.name, tier: u.tier });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "登录失败" }, { status: 500 });
  }
}
