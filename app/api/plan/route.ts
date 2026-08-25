import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { saveAsset } from "@/lib/assets";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const raw = await kvGet(`edit_plan:${user.id}`);
  if (!raw) {
    return NextResponse.json({ error: "暂无编辑计划" }, { status: 404 });
  }
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "数据损坏" }, { status: 500 });
  }
}

// 简易剪映：保存编辑计划（KV 写入，多实例共享）
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "plan");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const plan = await req.json();
    if (!plan || !plan.meta || !Array.isArray(plan.clips)) {
      return NextResponse.json({ error: "无效的编辑计划" }, { status: 400 });
    }
    await kvSet(`edit_plan:${user.id}`, JSON.stringify(plan));
    // 正式化：保存为 edit_plan 资产（parent 可选，支持从分镜工作流串联）
    await saveAsset({
      userId: user.id,
      type: "edit_plan",
      assetId: `plan:${user.id}`,
      parentAssetId: typeof plan.parentAssetId === "string" ? plan.parentAssetId : null,
      title: plan.meta?.title || "拍摄计划",
      status: "completed",
      payload: plan,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "保存失败" }, { status: 500 });
  }
}
