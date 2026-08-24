import { NextRequest, NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { consumeEmailToken } from "@/lib/auth/tokens";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** 邮箱验证：消费一次性令牌并标记用户已验证 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`verify-email:ip:${clientIp(req)}`, 10, 15 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "尝试过于频繁，请稍后再试" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "缺少验证令牌" }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "数据库未配置，邮箱验证不可用" }, { status: 503 });
  }

  const userId = await consumeEmailToken(token, "verify-email");
  if (!userId) {
    return NextResponse.json(
      { error: "验证链接无效或已过期，请重新发送验证邮件" },
      { status: 400 }
    );
  }

  try {
    const sql = getSql();
    await sql`UPDATE users SET email_verified = true WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "验证失败" }, { status: 500 });
  }
}
