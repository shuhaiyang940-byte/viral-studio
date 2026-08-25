import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listAssets, type AssetType } from "@/lib/assets";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<string>(["analysis", "storyboard", "edit_plan", "replica", "copywriting", "director"]);

/**
 * 真实用户历史记录：只返回当前登录用户自己的创作资产（按更新时间倒序）。
 * 身份只来自服务端 Session，不接受客户端 userId；未登录 401。
 * 仅返回轻量元数据（不含 payload），用户点击详情再拉资产。
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const typeRaw = sp.get("type") || undefined;
  if (typeRaw && !VALID_TYPES.has(typeRaw)) {
    return NextResponse.json({ error: "无效的历史类型" }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 20) || 20, 1), 100);
  const cursor = sp.get("cursor") || undefined;

  const { items, nextCursor } = await listAssets({
    userId: user.id,
    type: typeRaw as AssetType | undefined,
    limit,
    cursor,
  });

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.assetId,
      type: a.type,
      assetId: a.assetId,
      title: a.title,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    nextCursor,
  });
}
