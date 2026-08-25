import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { saveAsset, listAssets, type AssetType } from "@/lib/assets";

export const dynamic = "force-dynamic";

const TYPE_MAP: Record<string, AssetType> = {
  report: "analysis",
  storyboard: "storyboard",
  plan: "edit_plan",
  analysis: "analysis",
  replica: "replica",
  copywriting: "copywriting",
  director: "director",
  edit_plan: "edit_plan",
};

/**
 * 用户创作工作区（正式数据源：Postgres assets 表，按 userId 隔离）。
 * localStorage 仅作为前端缓存 / 草稿。
 *   POST { type, id, data } → 保存/更新该用户的一条创作资产（幂等 upsert）
 *   GET  ?type=report&limit= → 返回该用户该类型资产（按更新时间倒序）
 * 身份只来自服务端 Session；客户端无法指定 userId。
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { type?: string; id?: string; data?: unknown; title?: string };
  const assetType = TYPE_MAP[String(body.type ?? "")];
  if (!assetType) return NextResponse.json({ error: "无效的资产类型" }, { status: 400 });
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "缺少资产 id" }, { status: 400 });

  try {
    await saveAsset({
      userId: user.id,
      type: assetType,
      assetId: id,
      title: typeof body.title === "string" ? body.title : "",
      status: "completed",
      payload: body.data ?? {},
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "保存失败" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const assetType = TYPE_MAP[String(sp.get("type") ?? "")];
  if (!assetType) return NextResponse.json({ error: "无效的资产类型" }, { status: 400 });
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 100) || 100, 1), 100);

  const { items } = await listAssets({ userId: user.id, type: assetType, limit });
  return NextResponse.json({
    items: items.map((a) => ({ id: a.assetId, data: a.payload, createdAt: a.createdAt })),
  });
}
