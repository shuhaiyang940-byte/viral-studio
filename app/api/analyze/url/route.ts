import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo } from "@/lib/ai";
import { understandVideoUrl } from "@/lib/vision";
import { guardAiRequest } from "@/lib/ai-guard";
import { checkAnalyzeQuota } from "@/lib/quota-server";
import type { OnboardingProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 服务器化视频分析：前端把视频直传到对象存储后，带上公网 URL 来这里。
 * 服务端把 URL 直接交给 Qwen-VL（画面理解）+ Qwen-Audio（语音转写），
 * 全程不依赖本机 ffmpeg / 临时文件，Vercel Serverless 可用。
 */
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
  const videoUrl = String(body.videoUrl ?? "").trim();
  if (!/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json({ error: "缺少有效的视频 URL" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim().slice(0, 120);
  const refType = String(body.refType ?? "").trim();
  let profile: OnboardingProfile | undefined;
  try {
    const raw = String(body.profile ?? "");
    if (raw) profile = JSON.parse(raw) as OnboardingProfile;
  } catch {
    profile = undefined;
  }

  const u = await understandVideoUrl(videoUrl, title, refType);
  const report = await analyzeVideo({
    source: videoUrl,
    title,
    profile,
    refType,
    visualSummary: u.summary,
    transcript: u.transcript,
  });
  report.visual = {
    mode: u.mode,
    frameCount: u.frameCount,
    note: u.note,
    transcript: u.transcript,
  };
  return NextResponse.json(report);
}
