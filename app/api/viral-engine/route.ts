import { NextRequest, NextResponse } from "next/server";
import { runViralEngine, type ViralEngineInput } from "@/lib/viral";
import { guardAiRequest } from "@/lib/ai-guard";

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
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "生成失败，请稍后重试" }, { status: 500 });
  }
}
