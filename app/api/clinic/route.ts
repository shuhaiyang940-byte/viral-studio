import { NextRequest, NextResponse } from "next/server";
import { generateClinic, type ClinicInput } from "@/lib/clinic";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { kvGet, kvSet } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 与 /clinic 页面对齐：页面下拉有 11 个赛道，API 也必须收全，否则选「美妆护肤/搞笑」等会 400
const NICHES = ["生活", "旅游", "美食", "情感", "知识", "美妆护肤", "穿搭", "母婴", "剧情", "搞笑", "商业"];

/**
 * 账号诊所：POST { niche, contentType, platform?, followers?, engagementRate?, description? }
 * → 返回差距诊断报告。复用 clinic 的 IP 防刷限额。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "clinic");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "账号诊断需先登录（防止资源滥用）" }, { status: 401 });

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
    // 结果缓存：同账号同输入短时间复用，避免 66s 重复诊断 + 二次触发限流
    const cacheKey = `clinic:${JSON.stringify({
      niche, contentType: body.contentType, platform: body.platform || "", account: body.account || "",
      followers: body.followers ?? "", engagementRate: body.engagementRate ?? "",
      avgPlays: body.avgPlays ?? "", description: body.description ? `${body.description}`.slice(0, 30) : "",
    }).replace(/\s+/g, "").slice(0, 200)}:${user.id}`;
    const cached = await kvGet(cacheKey);
    if (cached) return NextResponse.json(JSON.parse(cached));
    const result = await generateClinic({
      niche,
      contentType: body.contentType as "sell" | "talk",
      platform: body.platform ? String(body.platform).trim() : undefined,
      account: body.account ? String(body.account).trim().slice(0, 200) : undefined,
      followers: num(body.followers),
      engagementRate: num(body.engagementRate),
      avgPlays: num(body.avgPlays),
      avgLikes: num(body.avgLikes),
      avgComments: num(body.avgComments),
      description: body.description ? String(body.description).trim().slice(0, 500) : undefined,
      sampleText: body.sampleText ? String(body.sampleText).trim().slice(0, 800) : undefined,
    });
    await kvSet(cacheKey, JSON.stringify(result)).catch(() => {});
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "诊断失败，请稍后重试" }, { status: 500 });
  }
}
