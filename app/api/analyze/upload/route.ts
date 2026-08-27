import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { analyzeVideo } from "@/lib/ai";
import { extractFrames, describeFrames, extractAudio, transcribeLocalAudio } from "@/lib/vision";
import { guardAiRequest } from "@/lib/ai-guard";
import { getQuotaForReq, consumeQuota, refundQuota, logUsage } from "@/lib/quota-server";
import { getCurrentUser } from "@/lib/auth/session";
import { codeOf } from "@/lib/ai-fallback";
import { saveAsset } from "@/lib/assets";
import type { OnboardingProfile } from "@/lib/types";
import { buildUnderstanding, timelineFactBlock } from "@/lib/video-fact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_EXT = [".mp4", ".mov", ".webm", ".m4v"];

/**
 * 真实视频理解分析：上传视频 → 抽帧 → Qwen-VL 逐帧理解 → 生成报告。
 *
 * 边界（诚实说明）：
 * - 需要本机 / 运行环境安装 ffmpeg；Vercel Serverless 需换云存储 + 云函数抽帧。
 * - 视觉模型需要 QWEN_API_KEY；未配置或 AI_VISION_MOCK=1 时返回演示摘要（不烧额度）。
 * - 音频转写（ASR）依赖部署环境安装 whisper，本环境未安装时自动跳过。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "analyze");
  if (!g.ok) return g.res;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请使用 multipart/form-data 上传" }, { status: 400 });
  }

  const file = form.get("video");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少视频文件（字段名 video）" }, { status: 400 });
  }
  if (file.size <= 0) return NextResponse.json({ error: "视频文件为空" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "视频超过 200MB 限制" }, { status: 413 });
  }
  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: "仅支持 mp4 / mov / webm / m4v" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const refType = String(form.get("refType") ?? "").trim();
  const requestId = typeof form.get("requestId") === "string" ? String(form.get("requestId")) : undefined;
  let profile: OnboardingProfile | undefined;
  try {
    const raw = String(form.get("profile") ?? "");
    if (raw) profile = JSON.parse(raw) as OnboardingProfile;
  } catch {
    profile = undefined;
  }

  // —— 预扣（原子）：校验全通过后才消耗，超限回退并 429，AI 失败再回退 ——
  const user = await getCurrentUser();
  const q = await getQuotaForReq(req);
  let quotaKey: string | null = null;
  if (q.limit !== null) {
    quotaKey = q.userKey ?? q.ipKey;
    const count = await consumeQuota(quotaKey);
    await logUsage({ userId: user?.id, quotaType: "video_analysis", amount: 1, action: "consume", status: "ok", requestId });
    if (count > q.limit) {
      await refundQuota(quotaKey);
      await logUsage({ userId: user?.id, quotaType: "video_analysis", amount: 1, action: "refund", status: "failed", requestId });
      return NextResponse.json(
        { error: "今日免费额度已用完，请明日再试。", code: "QUOTA_EXCEEDED", quota: { limit: q.limit, remaining: 0 } },
        { status: 429 }
      );
    }
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsa-upload-"));
  const videoPath = path.join(dir, `input${ext}`);
  try {
    fs.writeFileSync(videoPath, Buffer.from(await file.arrayBuffer()));

    // 1) 抽帧
    const frames = await extractFrames(videoPath, { count: 4, width: 512 });

    // 2) 视觉理解（真实 Qwen-VL 或演示摘要）
    let visualSummary: string | undefined;
    let visualMode: "real" | "mock" | "none" = "none";
    let frameCount = 0;
    if (frames) {
      frameCount = frames.frames.length;
      const res = await describeFrames(frames.frames, title, refType);
      visualSummary = res.summary;
      visualMode = res.mode;
    }

    // 3) 生成报告（含视觉摘要）
    const durationSec = frames?.meta.durationSec ?? null;
    // 3.1) 真实 ASR：提取音轨 → 本地 Qwen ASR（仅 AI_ASR=1 时执行；失败不造假）
    let transcript: string | undefined;
    const wavPath = path.join(dir, "audio.wav");
    const audioOk = await extractAudio(videoPath, wavPath);
    if (audioOk) transcript = await transcribeLocalAudio(wavPath);
    const understanding = buildUnderstanding({
      durationSec,
      hasTranscript: !!transcript,
      hasVision: visualMode === "real",
      hasOcr: false,
      visualCoverageSec: visualMode === "real" ? durationSec : null,
    });
    const timelineText = timelineFactBlock(understanding);
    const report = await analyzeVideo({
      source: file.name,
      title,
      profile,
      refType,
      visualSummary,
      transcript,
      timelineText,
    });
    report.visual = {
      mode: visualMode,
      frameCount,
      note:
        visualMode === "real"
          ? `已从视频中提取 ${frameCount} 帧画面并由视觉模型逐帧理解`
          : visualMode === "mock"
            ? `已提取 ${frameCount} 帧画面，但当前为演示模式（未调用视觉模型）`
            : "未能提取画面帧（请确认运行环境已安装 ffmpeg）",
    };
    report.understanding = understanding;
    // 分析成功：落库为正式创作资产（失败不写 completed）
    if (user) {
      await saveAsset({
        userId: user.id,
        type: "analysis",
        assetId: report.id,
        title: (report as any).meta?.title || title || "视频爆款分析",
        status: "completed",
        payload: report,
      });
    }
    return NextResponse.json(report);
  } catch (e: any) {
    console.warn("[api/analyze/upload] 分析失败：", e);
    if (quotaKey) {
      await refundQuota(quotaKey);
      await logUsage({ userId: user?.id, quotaType: "video_analysis", amount: 1, action: "refund", status: "failed", requestId });
    }
    return NextResponse.json({ error: e?.message || "分析失败，请重试", code: codeOf(e) }, { status: 502 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
