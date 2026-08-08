import { NextRequest, NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const PHONE_RE = /^1\d{10}$/;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? "").trim();
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
  }
  if (!hasDatabase()) return NextResponse.json({ error: "数据库未配置" }, { status: 503 });

  try {
    const sql = getSql();
    await sql`UPDATE users SET phone = ${phone} WHERE id = ${user.id}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "绑定失败" }, { status: 500 });
  }
}
