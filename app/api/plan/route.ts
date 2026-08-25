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
      // 兼容两种分镜资产结构：flow 链路存 { shots: RepurposeShot[] }，viral-engine 链路存 { rows: StoryboardRow[] }
      const raw = (sb.payload as any) || {};
      const rawShots: any[] = Array.isArray(raw.shots) ? raw.shots : [];
      const rawRows: any[] = Array.isArray(raw.rows) ? raw.rows : [];
      const shots: any[] = rawShots.length ? rawShots : rawRows;
      const clips = shots.map((s, i) => ({
        id: `clip-${Date.now()}-${i}`,
        no: String(i + 1).padStart(2, "0"),
        phase: s.phase || s.shot || `镜头 ${i + 1}`,
        durationSec: s.durationSec || 8,
        visual: s.visual || s.cue || s.shot || "中景，对着镜头讲",
        line: s.line || "",
        sfx: s.sfx || "",
        camera: s.camera || (typeof s.shot === "string" ? s.shot : "手机固定机位"),
        note: s.pitfall || s.note || "",
      }));
      const plan = {
        meta: { title: sb.title || "拍摄计划", source: "storyboard" },
        order: clips.map((c) => `${c.no}. ${c.phase}`),
        clips,
        postTips: [
          "先拍重头镜，保证情绪连贯，别按剧本顺序硬拍。",
          "成片建议 15~30 秒节奏，前 3 秒务必给足钩子。",
          "竖屏与平台一致（抖音/小红书建议 9:16），口播音量统一。",
        ],
        parentAssetId: storyboardAssetId,
        // 按分镜版本来标识，避免不同 Storyboard 的计划互相覆盖（版本链不污染）
        assetId: `plan:${user.id}:${storyboardAssetId}`,
      };
      await kvSet(`edit_plan:${user.id}`, JSON.stringify(plan));
      await saveAsset({
        userId: user.id, type: "edit_plan", assetId: plan.assetId,
        parentAssetId: storyboardAssetId, title: plan.meta.title, status: "completed", payload: plan,
      });
      await logEvent({ userId: user.id, event: EVENTS.plan_generated, assetId: plan.assetId });
      return NextResponse.json({ ok: true, plan, planAssetId: plan.assetId });
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
