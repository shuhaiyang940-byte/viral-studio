import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { saveAsset, getAsset } from "@/lib/assets";
import { logEvent, EVENTS } from "@/lib/analytics";

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
    const body = await req.json();
    const storyboardAssetId = typeof body.storyboardAssetId === "string" ? body.storyboardAssetId : undefined;

    // 从 Storyboard 服务端生成拍摄计划（不信任客户端提交的分镜内容；验证归属）
    if (storyboardAssetId) {
      const sb = await getAsset(user.id, storyboardAssetId);
      if (!sb || sb.type !== "storyboard") {
        return NextResponse.json({ error: "分镜资产不存在" }, { status: 404 });
      }
      const shots: any[] = Array.isArray((sb.payload as any)?.shots) ? (sb.payload as any).shots : [];
      const plan = {
        meta: { title: sb.title || "拍摄计划", source: "storyboard" },
        clips: shots.map((s, i) => ({
          id: `clip-${Date.now()}-${i}`,
          phase: s.phase,
          durationSec: s.durationSec || 8,
          visual: s.visual,
          line: s.line,
          sfx: s.sfx,
        })),
        parentAssetId: storyboardAssetId,
        assetId: `plan:${user.id}`,
      };
      await kvSet(`edit_plan:${user.id}`, JSON.stringify(plan));
      await saveAsset({
        userId: user.id, type: "edit_plan", assetId: `plan:${user.id}`,
        parentAssetId: storyboardAssetId, title: plan.meta.title, status: "completed", payload: plan,
      });
      await logEvent({ userId: user.id, event: EVENTS.plan_generated, assetId: `plan:${user.id}` });
      return NextResponse.json({ ok: true, plan, planAssetId: `plan:${user.id}` });
    }

    const plan = body;
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
