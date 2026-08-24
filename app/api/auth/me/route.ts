import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSql, hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 返回当前登录用户。
 * JWT 里的 tier/name 是签发那一刻的快照，会员升级或改名后会过期，
 * 所以有数据库时以数据库为准回读一次最新值。
 */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });

  if (!hasDatabase()) return NextResponse.json({ user: session });

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, email, name, tier, phone, email_verified FROM users WHERE id = ${session.id}`;
    if (!rows.length) {
      // 用户已被删除，但 Cookie 还在 —— 视为未登录
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const u = rows[0];
    return NextResponse.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        tier: u.tier,
        phone: u.phone ?? null,
        emailVerified: u.email_verified === true,
      },
    });
  } catch {
    // 数据库抖动时退回 JWT 里的快照，不至于把用户直接登出
    return NextResponse.json({ user: session });
  }
}
