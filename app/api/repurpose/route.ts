import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { generateRepurpose, type RepurposeInput } from "@/lib/repurpose";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserEntitlements, PRO_GATE_INFO } from "@/lib/permissions";
import { capabilitiesFor } from "@/lib/entitlements";
import { saveAsset, getAsset } from "@/lib/assets";
import { beginGenerate, markGenerateDone, markGenerateFailed } from "@/lib/generate-guard";
import { consumeGenerationQuota, refundGenerationQuota, consumeAnonymousGenerate, refundQuota } from "@/lib/quota-server";
import { clientIp } from "@/lib/rate-limit";
import { logEvent, EVENTS, logApiError } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 爆款基因重组（三段脚本）：生成后自动落 Script + Storyboard 资产（parent 链）。
 * 服务端 per-user 生成配额 + requestId 幂等 + 失败退款；Free 只返回 Preview、Pro 返回 Full。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "replicate");
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<RepurposeInput> & {
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
          body: (result.body || []).slice(0, 2),
          shots: (result.shots || []).slice(0, 3),
          locked: true,
          done: gateInfo.done,
          unlock: gateInfo.unlock,
        };

  const myTopic = String(body.myTopic ?? "").trim();
  if (!myTopic) return NextResponse.json({ error: "请先填写你的主题 / 产品" }, { status: 400 });
  if (!body.playbook?.structure?.length) {
    return NextResponse.json({ error: "缺少爆款套路数据" }, { status: 400 });
  }

  // —— requestId 幂等：已处理完成直接返回已有资产（不重复调用 AI / 扣额）——
  const begin = await beginGenerate(requestId, user?.id);
  if (!begin.ok) {
    return NextResponse.json({ error: begin.error, code: "DUPLICATE_REQUEST" }, { status: begin.status });
  }
  if (begin.doneAssetId && user) {
    const existing = await getAsset(user.id, begin.doneAssetId);
    if (existing) return NextResponse.json(applyView(existing.payload));
  }

  // —— 服务端 per-user 生成配额（登录用户强制）——
  if (user) {
    const q = await consumeGenerationQuota(user.id, "script", ent.tier);
    if (!q.ok) {
      await markGenerateFailed(requestId);
      await logApiError({ endpoint: "/api/repurpose", status: 429, errorType: "QUOTA_LIMIT", userId: user.id });
      return NextResponse.json(
        { error: "今日生成次数已用完，升级会员可继续。", code: "QUOTA_EXCEEDED", quota: { remaining: q.remaining, limit: q.limit } },
        { status: 429 }
      );
    }
  }
  let anonKey: string | null = null;
  if (!user) {
    const ip = clientIp(req);
    anonKey = `gen:anon:script:ip:${ip}:`;
    const an = await consumeAnonymousGenerate(ip, "script");
    if (!an.ok) {
      await markGenerateFailed(requestId);
      await logApiError({ endpoint: "/api/repurpose", status: 429, errorType: "QUOTA_LIMIT" });
      return NextResponse.json({ error: "免费体验次数已用完，请明日再来或登录升级。", code: "ANON_QUOTA_EXCEEDED" }, { status: 429 });
    }
  }

  try {
    const result = await generateRepurpose({
      playbook: body.playbook,
      myTopic,
      myPersona: typeof body.myPersona === "string" ? body.myPersona.trim() || undefined : undefined,
      platform: typeof body.platform === "string" ? body.platform.trim() || undefined : undefined,
      casual: Number.isFinite(Number(body.casual)) ? Math.max(0, Math.min(100, Number(body.casual))) : undefined,
      emotion: Number.isFinite(Number(body.emotion)) ? Math.max(0, Math.min(100, Number(body.emotion))) : undefined,
      duration: Number.isFinite(Number(body.duration)) ? Math.max(30, Math.min(60, Number(body.duration))) : undefined,
    });
    // —— 资产化：Script + Storyboard（带 parent 链，幂等 upsert）——
    let respAsset: Record<string, string> = {};
    if (user) {
      const scriptId = requestId ? `script:${user.id}:${requestId}` : `script:${user.id}:${randomUUID()}`;
      await saveAsset({
        userId: user.id, type: "script", assetId: scriptId, parentAssetId: parentAssetId || null,
        title: result.title || myTopic, status: "completed", payload: result,
      });
      const sbId = requestId ? `storyboard:${user.id}:${requestId}` : `storyboard:${user.id}:${randomUUID()}`;
      await saveAsset({
        userId: user.id, type: "storyboard", assetId: sbId, parentAssetId: scriptId,
        title: `${result.title || myTopic} · 分镜`, status: "completed", payload: { shots: result.shots || [] },
      });
      if (requestId) await markGenerateDone(requestId, user.id, scriptId);
      respAsset = { assetId: scriptId, storyboardAssetId: sbId };
      await logEvent({ userId: user.id, event: EVENTS.script_generated, assetId: scriptId });
      await logEvent({ userId: user.id, event: EVENTS.storyboard_generated, assetId: sbId });
    }
    return NextResponse.json({ ...applyView(result), ...respAsset });
  } catch (e: any) {
    if (user) await refundGenerationQuota(user.id, "script");
    else if (anonKey) await refundQuota(anonKey);
    await markGenerateFailed(requestId);
    return NextResponse.json({ error: e?.message || "生成失败，请稍后重试" }, { status: 500 });
  }
}
