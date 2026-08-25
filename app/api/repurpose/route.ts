import { NextRequest, NextResponse } from "next/server";
import { generateRepurpose, type RepurposeInput } from "@/lib/repurpose";
import { guardAiRequest } from "@/lib/ai-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 爆款基因重组：POST { playbook, myTopic, myPersona?, platform? }
 * → 返回一套可照拍的口播脚本（含画面 / 语调 / 避坑）。
 * 复用 replicate 的 IP 防刷限额，公测期全站免费开放。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "replicate");
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<RepurposeInput>;
  const myTopic = String(body.myTopic ?? "").trim();
  if (!myTopic) {
    return NextResponse.json({ error: "请先填写你的主题 / 产品" }, { status: 400 });
  }
  if (!body.playbook?.structure?.length) {
    return NextResponse.json({ error: "缺少爆款套路数据" }, { status: 400 });
  }

  try {
    const result = await generateRepurpose({
      playbook: body.playbook,
      myTopic,
      myPersona: body.myPersona ? String(body.myPersona).trim() : undefined,
      platform: body.platform ? String(body.platform).trim() : undefined,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "生成失败，请稍后重试" }, { status: 500 });
  }
}
