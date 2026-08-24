import { NextRequest, NextResponse } from "next/server";
import { banIp, unbanIp, listBlockedIps } from "@/lib/ai-guard";

export const dynamic = "force-dynamic";

/**
 * IP 封禁管理接口（需 ADMIN_TOKEN，请求头 Authorization: Bearer <token>
 * 或 URL 参数 ?token=<token>）：
 *   GET    /api/admin/ip            → 列出当前封禁
 *   POST   /api/admin/ip            → 手动封禁 { ip, hours? }
 *   DELETE /api/admin/ip            → 解封 { ip }
 */

function authorize(req: NextRequest): { ok: boolean; error?: string; status?: number } {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return {
      ok: false,
      error: "未配置 ADMIN_TOKEN，管理接口不可用",
      status: 503,
    };
  }
  const header = req.headers.get("authorization") || "";
  const queryToken = req.nextUrl.searchParams.get("token") || "";
  if (header === `Bearer ${token}` || queryToken === token) return { ok: true };
  return { ok: false, error: "口令不正确", status: 401 };
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const items = await listBlockedIps();
  return NextResponse.json({
    items,
    count: items.length,
    note: "封禁会在到期后自动解除；until 为 null 表示永久封禁。",
  });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await req.json().catch(() => ({}));
  const ip = String(body.ip ?? "").trim();
  if (!ip) return badRequest("请提供 ip");
  const hours = Math.max(1, Math.min(24 * 30, parseInt(body.hours ?? "24", 10) || 24));
  await banIp(ip, body.reason ? String(body.reason).slice(0, 200) : "管理员手动封禁", hours * 3600_000);
  return NextResponse.json({ ok: true, ip, hours });
}

export async function DELETE(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await req.json().catch(() => ({}));
  const ip = String(body.ip ?? "").trim();
  if (!ip) return badRequest("请提供 ip");
  await unbanIp(ip);
  return NextResponse.json({ ok: true, ip });
}
