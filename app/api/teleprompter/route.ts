import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { kvGet, kvSet } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const PREFIX = "teleprompter:";

/**
 * 手机扫码提词器：
 *   POST { title, lines[] } → 生成短 token 存 KV，返回 { token, url }
 *   GET  ?token= → { title, lines }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { title?: string; lines?: string[] };
  const lines = Array.isArray(body.lines)
    ? body.lines.map((l) => String(l)).filter(Boolean)
    : [];
  if (!lines.length) {
    return NextResponse.json({ error: "没有可提词的内容" }, { status: 400 });
  }
  const token = randomBytes(6).toString("hex");
  await kvSet(PREFIX + token, JSON.stringify({
    title: String(body.title || "提词器"),
    lines: lines.slice(0, 40),
  }));
  return NextResponse.json({ token, url: `${SITE_URL}/teleprompter?token=${token}` });
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "缺少 token" }, { status: 400 });
  const raw = await kvGet(PREFIX + token);
  if (!raw) return NextResponse.json({ error: "提词内容已过期" }, { status: 404 });
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "提词内容损坏" }, { status: 500 });
  }
}
