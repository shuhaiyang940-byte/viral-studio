import { NextRequest, NextResponse } from "next/server";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { getPersonaCard } from "@/lib/persona";
import { runStrategyWorkflow } from "@/lib/workflow";
import { consumeGenerationQuota, refundGenerationQuota } from "@/lib/quota-server";
import { getUserEntitlements } from "@/lib/permissions";
import { saveAsset } from "@/lib/assets";
import { logEvent, EVENTS } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "creative");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reference = String(body.reference || "").trim().slice(0, 2000);
  const product = String(body.product || "").trim().slice(0, 200);
  const platform = String(body.platform || "").trim().slice(0, 60);
  const duration = body.duration ? Number(body.duration) : undefined;
  if (!reference && !product) return NextResponse.json({ error: "请提供对标内容或我的方向" }, { status: 400 });

  const ent = await getUserEntitlements(user.id);
  const q = await consumeGenerationQuota(user.id, "strategy", ent.tier);
  if (!q.ok) return NextResponse.json({ error: "今日策略生成次数已用完，请升级会员或明日再试", code: "QUOTA_EXCEEDED" }, { status: 429 });

  try {
    const personaCard = await getPersonaCard(user.id);
    const result = await runStrategyWorkflow({ personaCard, reference, product, platform, duration });
    const assetId = `strategy:${user.id}:${Date.now()}`;
    await saveAsset({ userId: user.id, type: "script", assetId, parentAssetId: null, title: result.title || product || "策略脚本", status: "completed", payload: result });
    await logEvent({ userId: user.id, event: "script_generated", assetId });
    return NextResponse.json({ ...result, assetId });
  } catch (e: any) {
    await refundGenerationQuota(user.id, "strategy");
    return NextResponse.json({ error: e?.message || "策略生成失败，请重试" }, { status: 502 });
  }
}
