import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { generateRepurpose } from "@/lib/repurpose";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserEntitlements, PRO_GATE_INFO } from "@/lib/permissions";
import { capabilitiesFor } from "@/lib/entitlements";
import { getAsset, saveAsset, type AssetRecord } from "@/lib/assets";
import { beginGenerate, markGenerateDone, markGenerateFailed } from "@/lib/generate-guard";
import { consumeGenerationQuota, refundGenerationQuota } from "@/lib/quota-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 从 Analysis 资产构造生成脚本用的爆款骨架（基于真实分析结果，非客户端提供） */
function playbookFromAnalysis(rep: any) {
  const sb = Array.isArray(rep?.storyboard) ? rep.storyboard : [];
  const hookLine = sb.find((s: any) => s.phase === "钩子")?.line;
  const structure = sb.length
    ? sb.map((s: any) => ({ phase: s.phase || "段落", secs: 8, detail: `${s.visual || ""}：${s.line || ""}`.trim() }))
    : [
        { phase: "钩子", secs: 3, detail: "反常识 / 痛点直击" },
        { phase: "铺垫", secs: 8, detail: "建立共鸣" },
        { phase: "展开", secs: 12, detail: "给出可操作的三步" },
        { phase: "收尾", secs: 7, detail: "行动号召" },
      ];
  return {
    id: rep?.id || "analysis",
    title: rep?.meta?.title || "这个爆款",
    hook: hookLine || `（开场）「${rep?.meta?.title || "这个爆款"}」——先弄清楚它为什么能爆。`,
    structure,
    cameraTips: ["特写", "中景", "手部演示", "近景收尾"],
    music: ["轻快 BGM"],
    shots: ["开场", "素材", "步骤", "成品"],
  };
}

/**
 * 一键创作：POST { analysisAssetId, myTopic, requestId? }
 * → 服务端验证当前用户拥有该 Analysis(404)；读取真实 Analysis；生成 Script+Storyboard 资产(chain)。
 * Free=Preview、Pro=Full；per-user 配额 + requestId 幂等 + 失败退款。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "replicate");
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as {
    analysisAssetId?: string;
    myTopic?: string;
    requestId?: string;
  };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const analysisAssetId = String(body.analysisAssetId ?? "").trim();
  const myTopic = String(body.myTopic ?? "").trim();
  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
  if (!analysisAssetId) return NextResponse.json({ error: "缺少分析资产" }, { status: 400 });
  if (!myTopic) return NextResponse.json({ error: "请填写你的产品 / 主题" }, { status: 400 });

  const ent = await getUserEntitlements(user.id);
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

  // 幂等
  const begin = await beginGenerate(requestId, user.id);
  if (!begin.ok) return NextResponse.json({ error: begin.error, code: "DUPLICATE_REQUEST" }, { status: begin.status });
  if (begin.doneAssetId) {
    const exist = await getAsset(user.id, begin.doneAssetId);
    if (exist) return NextResponse.json(applyView(exist.payload));
  }

  // owner 校验：读当前用户的 Analysis，不存在/不属于当前用户 → 404（不泄露归属）
  const analysis: AssetRecord | null = await getAsset(user.id, analysisAssetId);
  if (!analysis || analysis.type !== "analysis") {
    return NextResponse.json({ error: "分析资产不存在" }, { status: 404 });
  }

  // 配额
  const q = await consumeGenerationQuota(user.id, "script", ent.tier);
  if (!q.ok) {
    await markGenerateFailed(requestId);
    return NextResponse.json({ error: "今日生成次数已用完，升级会员可继续。", code: "QUOTA_EXCEEDED" }, { status: 429 });
  }

  try {
    const playbook = playbookFromAnalysis(analysis.payload);
    const result = await generateRepurpose({ playbook, myTopic });
    const scriptId = requestId ? `script:${user.id}:${requestId}` : `script:${user.id}:${randomUUID()}`;
    await saveAsset({ userId: user.id, type: "script", assetId: scriptId, parentAssetId: analysisAssetId, title: result.title || myTopic, status: "completed", payload: result });
    const sbId = requestId ? `storyboard:${user.id}:${requestId}` : `storyboard:${user.id}:${randomUUID()}`;
    await saveAsset({ userId: user.id, type: "storyboard", assetId: sbId, parentAssetId: scriptId, title: `${result.title || myTopic} · 分镜`, status: "completed", payload: { shots: result.shots || [] } });
    if (requestId) await markGenerateDone(requestId, user.id, scriptId);
    return NextResponse.json({ ...applyView(result), assetId: scriptId, storyboardAssetId: sbId });
  } catch (e: any) {
    await refundGenerationQuota(user.id, "script");
    await markGenerateFailed(requestId);
    return NextResponse.json({ error: e?.message || "生成失败，请稍后重试" }, { status: 500 });
  }
}
