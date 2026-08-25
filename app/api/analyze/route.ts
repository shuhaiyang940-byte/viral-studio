import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo } from "@/lib/ai";
import { SAMPLE_REPORT } from "@/lib/mock-data";
import { guardAiRequest } from "@/lib/ai-guard";
import { checkAnalyzeQuota } from "@/lib/quota-server";
import { codeOf } from "@/lib/ai-fallback";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "analyze");
  if (!g.ok) return g.res;
  const quota = await checkAnalyzeQuota(req);
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: "今日免费分析次数已用完，升级会员可无限次分析。",
        code: "QUOTA_EXCEEDED",
        quota: { limit: quota.limit, remaining: quota.remaining },
      },
      { status: 429 }
    );
  }
  const body = await req.json().catch(() => ({}));
  try {
    const report = await analyzeVideo({
      source: typeof body.source === "string" ? body.source : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      profile:
        body.profile && typeof body.profile === "object" ? body.profile : undefined,
      refType: typeof body.refType === "string" ? body.refType : undefined,
    });
    return NextResponse.json(report);
  } catch (err) {
    // 真实 AI 失败（生产）：明确失败，绝不返回 Mock 报告
    const msg = err instanceof Error ? err.message : "AI 分析失败";
    return NextResponse.json({ error: msg, code: codeOf(err) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  // 返回示例报告，供报告页在无本地记录时回退展示
  const sample = req.nextUrl.searchParams.get("sample") === "1";
  return NextResponse.json(sample || true ? SAMPLE_REPORT : SAMPLE_REPORT);
}
