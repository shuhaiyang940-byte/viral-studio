import { NextRequest, NextResponse } from "next/server";
import { generateRepurpose, type RepurposeInput } from "@/lib/repurpose";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserEntitlements, PRO_GATE_INFO } from "@/lib/permissions";
import { capabilitiesFor } from "@/lib/entitlements";

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
      casual: Number.isFinite(Number(body.casual)) ? Math.max(0, Math.min(100, Number(body.casual))) : undefined,
      emotion: Number.isFinite(Number(body.emotion)) ? Math.max(0, Math.min(100, Number(body.emotion))) : undefined,
      duration: Number.isFinite(Number(body.duration)) ? Math.max(30, Math.min(60, Number(body.duration))) : undefined,
    });
    // —— Free / Pro 边界：先生成真实完整脚本，再按权限决定展示范围 ——
    const user = await getCurrentUser();
    const ent = await getUserEntitlements(user?.id ?? "");
    const full = capabilitiesFor(ent.tier).scriptFull;
    const gateInfo = PRO_GATE_INFO.scriptFull;
    if (!full) {
      // Preview：保留 hook + 前 2 条要点 + 前 3 镜，剩余明确为 Pro 解锁
      return NextResponse.json({
        ...result,
        body: (result.body || []).slice(0, 2),
        shots: (result.shots || []).slice(0, 3),
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
