import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo } from "@/lib/ai";
import { SAMPLE_REPORT } from "@/lib/mock-data";
import { guardAiRequest } from "@/lib/ai-guard";
import { getQuotaForReq, consumeQuota, refundQuota, logUsage } from "@/lib/quota-server";
import { getCurrentUser } from "@/lib/auth/session";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { codeOf } from "@/lib/ai-fallback";
import { saveAsset } from "@/lib/assets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "analyze");
  if (!g.ok) return g.res;

  const body = await req.json().catch(() => ({}));
  const user = await getCurrentUser();
  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;

  // 重复提交保护（requestId 幂等）：同 requestId 在 5 分钟内正在处理 → 拒绝
  let reqKey: string | null = null;
  if (requestId) {
    reqKey = `analyze:req:${requestId}`;
    const cur = await kvGet(reqKey);
    if (cur) {
      try {
        const o = JSON.parse(cur);
        if (Date.now() - Number(o.t || 0) < 5 * 60_000) {
          return NextResponse.json({ error: "请勿重复提交", code: "DUPLICATE_REQUEST" }, { status: 409 });
        }
      } catch {
        // 旧格式忽略
      }
    }
    await kvSet(reqKey, JSON.stringify({ status: "processing", t: Date.now() }));
  }

  // —— 额度：预扣（原子）→ 执行 → 成功保留 / 失败回滚 ——
  const q = await getQuotaForReq(req);
  let quotaKey: string | null = null;
  if (q.limit !== null) {
    quotaKey = q.userKey ?? q.ipKey;
    const count = await consumeQuota(quotaKey);
    await logUsage({ userId: user?.id, quotaType: "video_analysis", amount: 1, action: "consume", status: "ok", requestId });
    if (count > q.limit) {
      await refundQuota(quotaKey);
      await logUsage({ userId: user?.id, quotaType: "video_analysis", amount: 1, action: "refund", status: "failed", requestId });
      if (reqKey) await kvDel(reqKey);
      return NextResponse.json(
        {
          error: "今日免费分析次数已用完，升级会员可无限次分析。",
          code: "QUOTA_EXCEEDED",
          quota: { limit: q.limit, remaining: 0 },
        },
        { status: 429 }
      );
    }
  }

  try {
    const report = await analyzeVideo({
      source: typeof body.source === "string" ? body.source : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      profile:
        body.profile && typeof body.profile === "object" ? body.profile : undefined,
      refType: typeof body.refType === "string" ? body.refType : undefined,
    });
    // 分析成功：落库为正式创作资产（失败不写 completed，绝不伪装成功）
    if (user) {
      await saveAsset({
        userId: user.id,
        type: "analysis",
        assetId: report.id,
        title: (report as any).meta?.title || body.title || "视频爆款分析",
        status: "completed",
        payload: report,
      });
    }
    await logUsage({ userId: user?.id, quotaType: "video_analysis", amount: 0, action: "success", status: "ok", requestId });
    if (reqKey) await kvDel(reqKey);
    return NextResponse.json(report);
  } catch (err) {
    // 真实 AI 失败：退回刚才预扣的额度，绝不永久消耗
    if (quotaKey) {
      await refundQuota(quotaKey);
      await logUsage({ userId: user?.id, quotaType: "video_analysis", amount: 1, action: "refund", status: "failed", requestId });
    } else {
      await logUsage({ userId: user?.id, quotaType: "video_analysis", amount: 0, action: "failed", status: "failed", requestId });
    }
    if (reqKey) await kvDel(reqKey);
    const msg = err instanceof Error ? err.message : "AI 分析失败";
    return NextResponse.json({ error: msg, code: codeOf(err) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  // 返回示例报告，供报告页在无本地记录时回退展示
  const sample = req.nextUrl.searchParams.get("sample") === "1";
  return NextResponse.json(sample || true ? SAMPLE_REPORT : SAMPLE_REPORT);
}
