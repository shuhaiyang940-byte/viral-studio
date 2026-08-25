import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const TYPES = ["report", "storyboard", "plan"] as const;
type WsType = (typeof TYPES)[number];

/**
 * 用户创作工作区（服务端持久化，按 userId 隔离）。
 * 用于把「报告 / 分镜 / 编辑计划」从 localStorage 唯一存储，升级为服务端持久化；
 * localStorage 仅保留为草稿缓存 / UI 状态。
 *
 *   POST { type, id, data }  → 保存/更新该用户的一条创作资产
 *   GET  ?type=report         → 返回该用户该类型的全部资产（数组）
 *
 * 身份只来自服务端 Session，客户端无法指定 userId。
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { type?: string; id?: string; data?: unknown };
  const type = body.type as WsType;
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "无效的资产类型" }, { status: 400 });
  }
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "缺少资产 id" }, { status: 400 });

  const key = `ws:${user.id}:${type}`;
  let list: { id: string; data: any; createdAt: string }[] = [];
  const raw = await kvGet(key);
  if (raw) {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  const item = { id, data: body.data ?? null, createdAt: new Date().toISOString() };
  const idx = list.findIndex((i) => i.id === id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  await kvSet(key, JSON.stringify(list.slice(0, 100)));
  return NextResponse.json({ ok: true, count: list.length });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") as WsType | null;
  if (!type || !TYPES.includes(type)) {
    return NextResponse.json({ error: "无效的资产类型" }, { status: 400 });
  }
  const raw = await kvGet(`ws:${user.id}:${type}`);
  if (!raw) return NextResponse.json({ items: [] });
  try {
    return NextResponse.json({ items: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
