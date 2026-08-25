import { NextRequest, NextResponse } from "next/server";
import { generateClinic, type ClinicInput } from "@/lib/clinic";
import { guardAiRequest } from "@/lib/ai-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NICHES = ["生活", "旅游", "美食", "情感", "知识", "商业"];

/**
 * 账号诊所：POST { niche, contentType, platform?, followers?, engagementRate?, description? }
 * → 返回差距诊断报告。复用 clinic 的 IP 防刷限额。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "clinic");
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<ClinicInput>;
  const niche = String(body.niche ?? "").trim();
  if (!NICHES.includes(niche)) {
    return NextResponse.json({ error: "请选择有效的赛道" }, { status: 400 });
  }
  if (!["sell", "talk"].includes(String(body.contentType))) {
    return NextResponse.json({ error: "请选择内容类型（卖货 / 口播）" }, { status: 400 });
  }

  function num(v: unknown): number | undefined {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  try {
    const result = await generateClinic({
      niche,
      contentType: body.contentType as "sell" | "talk",
      platform: body.platform ? String(body.platform).trim() : undefined,
      followers: num(body.followers),
      engagementRate: num(body.engagementRate),
      avgPlays: num(body.avgPlays),
      avgLikes: num(body.avgLikes),
      avgComments: num(body.avgComments),
      description: body.description ? String(body.description).trim().slice(0, 500) : undefined,
      sampleText: body.sampleText ? String(body.sampleText).trim().slice(0, 800) : undefined,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "诊断失败，请稍后重试" }, { status: 500 });
  }
}
