import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { analyzeVideo } from "@/lib/ai";
import { extractFrames, describeFrames } from "@/lib/vision";
import { guardAiRequest } from "@/lib/ai-guard";
import { checkAnalyzeQuota } from "@/lib/quota-server";
import type { OnboardingProfile } from "@/lib/types";

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
  let profile: OnboardingProfile | undefined;
  try {
    const raw = String(form.get("profile") ?? "");
    if (raw) profile = JSON.parse(raw) as OnboardingProfile;
  } catch {
    profile = undefined;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsa-upload-"));
  const videoPath = path.join(dir, `input${ext}`);
  try {
    fs.writeFileSync(videoPath, Buffer.from(await file.arrayBuffer()));

    // 1) 抽帧
    const frames = await extractFrames(videoPath, { count: 6, width: 768 });

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
    const report = await analyzeVideo({
      source: file.name,
      title,
      profile,
      refType,
      visualSummary,
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
    return NextResponse.json(report);
  } catch (e: any) {
    console.warn("[api/analyze/upload] 分析失败：", e);
    return NextResponse.json({ error: e?.message || "分析失败，请重试" }, { status: 500 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
