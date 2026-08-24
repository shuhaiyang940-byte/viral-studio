import { NextRequest, NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { consumeEmailToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** 重置密码：消费令牌 + 更新密码哈希（所有会话自动失效） */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`reset-password:ip:${clientIp(req)}`, 10, 15 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "尝试过于频繁，请稍后再试" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  const password = String(body.password ?? "");
  if (!token) return NextResponse.json({ error: "缺少重置令牌" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  if (password.length > 72) {
    return NextResponse.json({ error: "密码最长 72 位" }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "数据库未配置，重置密码不可用" }, { status: 503 });
  }

  const userId = await consumeEmailToken(token, "reset-password");
  if (!userId) {
    return NextResponse.json(
      { error: "重置链接无效或已过期，请重新发起找回" },
      { status: 400 }
    );
  }

  try {
    const sql = getSql();
    const hash = await hashPassword(password);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "重置失败" }, { status: 500 });
  }
}
