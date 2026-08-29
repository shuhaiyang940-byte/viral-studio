import { NextRequest, NextResponse } from "next/server";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { extractContentEvidence, type ContentEvidence } from "@/lib/diagnosis/evidence";
import { runDiagnosis } from "@/lib/diagnosis/engine";
import type { AnalysisReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * PHASE1 账号证据诊断：
 * 前端把「用户上传的视频的分析报告」+「手填/截图的数据指标」传进来，
 * 后端提取内容证据 → 诊断引擎 → 返回针对性诊断（视频质量/增强/钩子）+ 证据链。
 * 诚实：未真实看视频的报告会标注 available=false，不编数据。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "creative");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "为了您的体验，请先登录", code: "UN_AUTHED" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const reports: AnalysisReport[] = Array.isArray(body.reports) ? body.reports : [];
  const evidences: ContentEvidence[] = reports.map(extractContentEvidence);

  const result = await runDiagnosis({
    evidences,
    manual: {
      followers: num(body.followers),
      engagementRate: num(body.engagementRate),
      avgPlays: num(body.avgPlays),
      avgLikes: num(body.avgLikes),
      avgComments: num(body.avgComments),
      avgShares: num(body.avgShares),
    },
  });

  return NextResponse.json({
    result,
    evidenceCount: evidences.length,
    visualRealCount: evidences.filter((e) => e.available).length,
  });
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || `${v}`.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
