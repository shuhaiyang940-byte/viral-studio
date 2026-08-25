import { NextRequest, NextResponse } from "next/server";
import {
  generateCopy,
  checkLegal,
  type CopyBrief,
  type GeneratedCopy,
} from "@/lib/copywrite";
import { reasoningChat, isConfigured } from "@/lib/llm";
import { guardAiRequest } from "@/lib/ai-guard";
import { allowMockFallback, codeOf } from "@/lib/ai-fallback";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserEntitlements } from "@/lib/permissions";
import { consumeGenerationQuota, refundGenerationQuota, consumeAnonymousGenerate, refundQuota } from "@/lib/quota-server";
import { clientIp } from "@/lib/rate-limit";
import { beginGenerate, markGenerateDone, markGenerateFailed } from "@/lib/generate-guard";
import { kvGet, kvSet } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_GUIDE: Record<string, string> = {
  口播: "口语化、像面对面聊天，节奏自然",
  种草: "强感官描述、突出「用了真香」的获得感",
  剧情: "有起承转合与情绪曲线，结尾留钩子",
  知识: "反常识开场 + 底层逻辑，结尾给方法论",
  测评: "优缺点都讲、有结论，建立「说真话」人设",
  带货: "源头感 + 价格锚点 + 紧迫感，转化导向",
};

function buildSystemPrompt(b: CopyBrief): string {
  const t = b.type || "口播";
  const ctx = [
    b.topic ? `热点选题：${b.topic}` : "",
    b.style ? `创作风格：${b.style}` : "",
    b.audience ? `目标受众：${b.audience}` : "",
    b.tone ? `语气：${b.tone}` : "",
    b.constraints && b.constraints.length ? `拆解约束：${b.constraints.join(" / ")}` : "",
    b.reference?.trim() ? `参考原文风格：${b.reference.trim().slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "你是短视频爆款文案专家，擅长把「热点 / 方向」写成能直接拍的口播稿。",
    `文案类型：${t}（${TYPE_GUIDE[t] || "通用爆款结构"}）。`,
    "要求：",
    "1. 钩子必须在 3 秒内制造信息缺口或冲突，别废话。",
    "2. 正文 3 条要点，每条约 1-2 句，具体到画面而非空泛说教。",
    "3. 结尾给明确的行动号召（点赞 / 评论 / 点击 / 关注）。",
    "4. 说人话、口语化，避免书面腔和营销号味。",
    "5. 只返回 JSON，不要任何解释文字，结构为：",
    '{"hook":"开头钩子","body":["要点1","要点2","要点3"],"cta":"结尾行动号召"}',
    "",
    "【上下文】",
    ctx || "（无额外上下文，按方向自由发挥）",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "copy");
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as CopyBrief;

  // 无 DeepSeek Key → 直接走本地模板，保证永远可生成。
  if (!isConfigured("deepseek")) {
    const tpl = generateCopy(b);
    return NextResponse.json({ ...tpl, source: "template" as const });
  }

  // —— 服务端生成配额（登录 per-user；未登录 匿名 IP 每日）——
  let quotaConsumed = false;
  let anonKey: string | null = null;
  let quotaUser: Awaited<ReturnType<typeof getCurrentUser>> = null;
  if (isConfigured("deepseek")) {
    quotaUser = await getCurrentUser();
    const ent = await getUserEntitlements(quotaUser?.id ?? "");
    if (quotaUser) {
      const q = await consumeGenerationQuota(quotaUser.id, "copy", ent.tier);
      if (!q.ok) return NextResponse.json({ error: "今日生成次数已用完，升级会员可继续。", code: "QUOTA_EXCEEDED" }, { status: 429 });
    } else {
      const ip = clientIp(req);
      anonKey = `gen:anon:copy:ip:${ip}:`;
      const an = await consumeAnonymousGenerate(ip, "copy");
      if (!an.ok) return NextResponse.json({ error: "免费体验次数已用完，请明日再来或登录升级。", code: "ANON_QUOTA_EXCEEDED" }, { status: 429 });
    }
    quotaConsumed = true;
  }

  const reqId = typeof (b as any).requestId === "string" ? (b as any).requestId : undefined;
  const begin = await beginGenerate(reqId, quotaUser?.id);
  if (begin.doneAssetId && reqId) {
    const cached = await kvGet(`genreq:${reqId}:result`);
    if (cached) return NextResponse.json(JSON.parse(cached));
  }

  try {
    const content = await reasoningChat(
      [
        { role: "system", content: buildSystemPrompt(b) },
        {
          role: "user",
          content: `请为以下方向写一条${b.type || "口播"}文案：\n${
            b.topic || b.direction || "这个方向"
          }`,
        },
      ],
      { json: true, temperature: 0.8, maxTokens: 1200 }
    );

    const parsed = JSON.parse(content) as {
      hook?: string;
      body?: unknown;
      cta?: string;
    };
    const hook = (parsed.hook || "").toString().trim();
    const body = Array.isArray(parsed.body)
      ? parsed.body.map((x) => x?.toString?.().trim()).filter(Boolean).slice(0, 5)
      : [];
    const cta = (parsed.cta || "").toString().trim();

    if (!hook || body.length === 0) throw new Error("模型返回结构不完整");

    const ctx = [
      b.topic ? `（热点选题：${b.topic}）` : "",
      b.style ? `（文风：${b.style}）` : "",
      b.audience ? `（受众：${b.audience}）` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const legal = checkLegal([hook, ...body, cta].join(" "));
    const legalNote = legal.flagged
      ? `⚠️ 合规提示：检测到可能涉及${legal.hits.join("、")}的内容，请核实信息来源、遵守法律法规与平台规范。`
      : "";

    const full = [
      ctx ? `【上下文】${ctx}` : "",
      `【钩子】${hook}`,
      `【正文】`,
      ...body.map((x) => `· ${x}`),
      `【结尾】${cta}`,
      ``,
      `— 由 DeepSeek 生成 · 建议结合你的画面节奏微调`,
      legalNote,
    ]
      .filter(Boolean)
      .join("\n");

    const out: GeneratedCopy & { source: "llm" } = {
      hook,
      body,
      cta,
      full,
      legal,
      styleNote: b.style,
      source: "llm",
    };
    if (reqId) {
      await kvSet(`genreq:${reqId}:result`, JSON.stringify(out));
      await markGenerateDone(reqId, quotaUser?.id, "copy:done");
    }
    return NextResponse.json(out);
  } catch (err) {
    await markGenerateFailed(reqId);
    if (quotaConsumed) {
      if (quotaUser) await refundGenerationQuota(quotaUser.id, "copy");
      else if (anonKey) await refundQuota(anonKey);
    }
    if (!allowMockFallback()) {
      console.error("[api/copy] DeepSeek 真实生成失败（生产，不回退模板）：", err);
      return NextResponse.json(
        { error: "AI 生成失败，请稍后重试", code: codeOf(err) },
        { status: 502 }
      );
    }
    console.warn("[api/copy] DeepSeek 调用失败（开发回退本地模板）：", err);
    const tpl = generateCopy(b);
    return NextResponse.json({ ...tpl, source: "template" as const });
  }
}
