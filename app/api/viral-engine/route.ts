import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { runViralEngine, type ViralEngineInput } from "@/lib/viral";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserEntitlements, PRO_GATE_INFO } from "@/lib/permissions";
import { capabilitiesFor } from "@/lib/entitlements";
import { saveAsset, getAsset } from "@/lib/assets";
import { beginGenerate, markGenerateDone, markGenerateFailed } from "@/lib/generate-guard";
import { consumeGenerationQuota, refundGenerationQuota, consumeAnonymousGenerate, refundQuota } from "@/lib/quota-server";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 三段流水线：生成后自动落 Script + Storyboard 资产；配额/幂等/失败退款；Free=Preview, Pro=Full */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "replicate");
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<ViralEngineInput> & {
    requestId?: string;
    parentAssetId?: string;
  };
  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
  const parentAssetId = typeof body.parentAssetId === "string" ? body.parentAssetId : undefined;
  const user = await getCurrentUser();
  const ent = await getUserEntitlements(user?.id ?? "");
  const full = capabilitiesFor(ent.tier).scriptFull;
  const gateInfo = PRO_GATE_INFO.scriptFull;
  const applyView = (result: any) =>
    full
      ? { ...result, locked: false }
      : {
          ...result,
          script: (result.script || []).slice(0, 3),
          storyboard: { ...(result.storyboard || {}), rows: (result.storyboard?.rows || []).slice(0, 4) },
          locked: true,
          done: gateInfo.done,
          unlock: gateInfo.unlock,
        };

  const text = String(body.text ?? "").trim();
  const product = String(body.product ?? "").trim();
  if (!text) return NextResponse.json({ error: "请先粘贴对标视频的文案 / 字幕" }, { status: 400 });
  if (!product) return NextResponse.json({ error: "请填写你的产品 / 服务" }, { status: 400 });

  const begin = await beginGenerate(requestId, user?.id);
  if (!begin.ok) return NextResponse.json({ error: begin.error, code: "DUPLICATE_REQUEST" }, { status: begin.status });
  if (begin.doneAssetId && user) {
    const existing = await getAsset(user.id, begin.doneAssetId);
    if (existing) return NextResponse.json(applyView(existing.payload));
  }
  if (user) {
    const q = await consumeGenerationQuota(user.id, "script", ent.tier);
    if (!q.ok) {
      await markGenerateFailed(requestId);
      return NextResponse.json({ error: "今日生成次数已用完，升级会员可继续。", code: "QUOTA_EXCEEDED" }, { status: 429 });
    }
  }
  let anonKey: string | null = null;
  if (!user) {
    const ip = clientIp(req);
    anonKey = `gen:anon:script:ip:${ip}:`;
    const an = await consumeAnonymousGenerate(ip, "script");
    if (!an.ok) {
      await markGenerateFailed(requestId);
      return NextResponse.json({ error: "免费体验次数已用完，请明日再来或登录升级。", code: "ANON_QUOTA_EXCEEDED" }, { status: 429 });
    }
  }

  try {
    const result = await runViralEngine({
      text, product,
      persona: typeof body.persona === "string" ? body.persona.trim() || undefined : undefined,
      platform: typeof body.platform === "string" ? body.platform.trim() || undefined : undefined,
    });
    let respAsset: Record<string, string> = {};
    if (user) {
      const scriptId = requestId ? `script:${user.id}:${requestId}` : `script:${user.id}:${randomUUID()}`;
      await saveAsset({
        userId: user.id, type: "script", assetId: scriptId, parentAssetId: parentAssetId || null,
        title: product, status: "completed", payload: { blueprint: result.blueprint, script: result.script },
      });
      const sbId = requestId ? `storyboard:${user.id}:${requestId}` : `storyboard:${user.id}:${randomUUID()}`;
      await saveAsset({
        userId: user.id, type: "storyboard", assetId: sbId, parentAssetId: scriptId,
        title: `${product} · 分镜`, status: "completed", payload: result.storyboard,
      });
      if (requestId) await markGenerateDone(requestId, user.id, scriptId);
      respAsset = { assetId: scriptId, storyboardAssetId: sbId };
    }
    return NextResponse.json({ ...applyView(result), ...respAsset });
  } catch (e: any) {
    if (user) await refundGenerationQuota(user.id, "script");
    else if (anonKey) await refundQuota(anonKey);
    await markGenerateFailed(requestId);
    return NextResponse.json({ error: e?.message || "生成失败，请稍后重试" }, { status: 500 });
  }
}
