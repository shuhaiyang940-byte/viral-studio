import { NextRequest, NextResponse } from "next/server";
import { generateClinic, type ClinicInput } from "@/lib/clinic";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { kvGet, kvSet } from "@/lib/kv";
import { manualSnapshot } from "@/lib/data-platform/adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 与 /clinic 页面对齐：页面下拉有 11 个赛道，API 也必须收全，否则选「美妆护肤/搞笑」等会 400
const NICHES = ["生活", "旅游", "美食", "情感", "知识", "美妆护肤", "穿搭", "母婴", "剧情", "搞笑", "商业"];

// 账号诊所「扁平字段」白名单：前端表单只提交这些键。
// 严防任何嵌套结构（如 accountData / metrics / data）或拼错字段被静默忽略，
// 避免用户明明填了数据却收到"假诊断（模板）"而毫无察觉。
const FLAT_FIELDS = new Set([
  "niche",
  "contentType",
  "platform",
  "account",
  "followers",
  "engagementRate",
  "avgPlays",
  "avgLikes",
  "avgComments",
  "avgShares",
  "description",
  "sampleText",
]);

/**
 * 账号诊所：POST { niche, contentType, platform?, followers?, engagementRate?, description? }
 * → 返回差距诊断报告。复用 clinic 的 IP 防刷限额。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "clinic");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "为了您的体验，请先登录", code: "UN_AUTHED" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<ClinicInput>;

  // 结构校验：出现不可识别的键 → 直接 400，拒绝"嵌套结构/字段改名"被静默降级成模板。
  // 这样真实用户若因前端 bug、代理转发、接口字段变化导致数据放错位置，会立刻收到明确报错，
  // 而不是拿到一份貌似正常但实际是模板的"假诊断"。
  const unknownKeys = Object.keys(body).filter((k) => !FLAT_FIELDS.has(k));
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      {
        error:
          "提交的字段结构不正确（未知字段：" +
          unknownKeys.join(", ") +
          "）。账号诊断只接受扁平字段：niche、contentType、platform、account、followers、engagementRate、avgPlays、avgLikes、avgComments、description、sampleText。请勿嵌套包裹（如 accountData / metrics / data）。",
        code: "INVALID_FIELDS",
      },
      { status: 400 }
    );
  }

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

  // 是否有真实数据：无数据请求不走缓存，避免读到"旧 LLM 编造分"残留
  const hasData =
    [body.followers, body.engagementRate, body.avgPlays, body.avgLikes, body.avgComments]
      .some((v) => v !== undefined && v !== null && `${v}`.trim() !== "") ||
    !!String(body.description ?? "").trim() || !!String(body.sampleText ?? "").trim();

  try {
    // 结果缓存：同账号同输入短时间复用，避免 66s 重复诊断 + 二次触发限流
    const cacheKey = `clinic:${JSON.stringify({
      niche, contentType: body.contentType, platform: body.platform || "", account: body.account || "",
      followers: body.followers ?? "", engagementRate: body.engagementRate ?? "",
      avgPlays: body.avgPlays ?? "", description: body.description ? `${body.description}`.slice(0, 30) : "",
    }).replace(/\s+/g, "").slice(0, 200)}:${user.id}`;
    if (hasData) {
      const cached = await kvGet(cacheKey);
      if (cached) return NextResponse.json(JSON.parse(cached));
    }
    const dataSource = manualSnapshot({
      account: body.account ? String(body.account).trim().slice(0, 200) : undefined,
      platform: body.platform ? String(body.platform).trim() : undefined,
      niche,
      contentType: body.contentType as "sell" | "talk",
      followers: num(body.followers),
      engagementRate: num(body.engagementRate),
      avgPlays: num(body.avgPlays),
      avgLikes: num(body.avgLikes),
      avgComments: num(body.avgComments),
      avgShares: num(body.avgShares),
      description: body.description ? String(body.description).trim().slice(0, 500) : undefined,
      sampleText: body.sampleText ? String(body.sampleText).trim().slice(0, 800) : undefined,
    });
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
      avgShares: num(body.avgShares),
      description: body.description ? String(body.description).trim().slice(0, 500) : undefined,
      sampleText: body.sampleText ? String(body.sampleText).trim().slice(0, 800) : undefined,
      dataSource,
    });
    if (hasData) await kvSet(cacheKey, JSON.stringify(result)).catch(() => {});
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "诊断失败，请稍后重试" }, { status: 500 });
  }
}
