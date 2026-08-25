import { NextRequest, NextResponse } from "next/server";
import { runViralEngine, type ViralEngineInput } from "@/lib/viral";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserEntitlements, PRO_GATE_INFO } from "@/lib/permissions";
import { capabilitiesFor } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 三段流水线：POST { text, product, persona?, platform? }
 * → { blueprint, script, storyboard, source }
 * 复用 replicate 的 IP 防刷限额。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "replicate");
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<ViralEngineInput>;
  const text = String(body.text ?? "").trim();
  const product = String(body.product ?? "").trim();
  if (!text) return NextResponse.json({ error: "请先粘贴对标视频的文案 / 字幕" }, { status: 400 });
  if (!product) return NextResponse.json({ error: "请填写你的产品 / 服务" }, { status: 400 });

  try {
    const result = await runViralEngine({
      text,
      product,
      persona: body.persona ? String(body.persona).trim() : undefined,
      platform: body.platform ? String(body.platform).trim() : undefined,
    });
    // —— Free / Pro 边界：真实生成后按权限决定展示范围 ——
    const user = await getCurrentUser();
    const ent = await getUserEntitlements(user?.id ?? "");
    const full = capabilitiesFor(ent.tier).scriptFull;
    const gateInfo = PRO_GATE_INFO.scriptFull;
    if (!full) {
      return NextResponse.json({
        ...result,
        script: (result.script || []).slice(0, 3),
        storyboard: {
          ...result.storyboard,
          rows: (result.storyboard?.rows || []).slice(0, 4),
        },
        locked: true,
        done: gateInfo.done,
        unlock: gateInfo.unlock,
      });
    }
    return NextResponse.json({ ...result, locked: false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "生成失败，请稍后重试" }, { status: 500 });
  }
}
