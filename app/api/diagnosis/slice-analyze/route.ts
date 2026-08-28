import { NextRequest, NextResponse } from "next/server";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import fs from "node:fs";
import { guardAiRequest } from "@/lib/ai-guard";
import { checkAnalyzeQuota } from "@/lib/quota-server";
import { recordAiUsage } from "@/lib/ai-usage";
import { analyzeVideo } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 下载 + ffmpeg 切片 + 多次千问需要较长时长；Pro 支持 300s，Hobby 会按平台 clamp
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const requireN = createRequire(import.meta.url);

/** ffmpeg 可执行路径：优先 ffmpeg-static（Vercel build 时安装），没有则回退系统 ffmpeg */
function ffmpegBin(): string {
  try {
    const s = requireN("ffmpeg-static");
    const p = s && s.default ? s.default : s;
    if (typeof p === "string" && p.length) {
      // 验证二进制确实可执行（Vercel 上正常；本地沙箱可能被安全策略拦 → 回退系统 ffmpeg）
      try {
        execFileSync(p, ["-version"], { stdio: "ignore" });
        return p;
      } catch {
        /* fallthrough */
      }
    }
  } catch {
    /* fallthrough */
  }
  return "ffmpeg";
}

/** 读取视频时长（秒）：先 ffmpeg -i 解析，失败回退 ffprobe */
async function getDurationSec(ff: string, input: string): Promise<number> {
  const re = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/;
  try {
    const r = await execFileAsync(ff, ["-i", input]);
    const m = re.exec(r.stderr || "");
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  } catch (e: any) {
    const m = re.exec(e.stderr || "");
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  try {
    const r = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", input]);
    return parseFloat(JSON.parse(r.stdout).format.duration);
  } catch {
    return 30;
  }
}

/** 把视频切成若干段（压缩到小体积、去音保留画面），返回各段的 base64 data URL */
async function sliceToDataUrls(ff: string, input: string, outDir: string, want: number): Promise<{ i: number; dataUrl: string }[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const dur = await getDurationSec(ff, input);
  const seg = Math.max(2, dur / Math.max(1, want));
  try {
    await execFileAsync(ff, [
      "-y", "-i", input, "-f", "segment", "-segment_time", seg.toFixed(3),
      "-reset_timestamps", "1", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "34",
      "-vf", "scale=320:-2", "-an", `${outDir}/seg_%02d.mp4`,
    ]);
  } catch (e: any) {
    console.warn("[slice] ffmpeg 切片失败：", e?.message || e);
  }
  const files = fs.readdirSync(outDir).filter((f) => /^seg_\d+\.mp4$/.test(f)).sort().slice(0, want);
  return files.map((f, i) => {
    const b = fs.readFileSync(`${outDir}/${f}`);
    return { i: i + 1, dataUrl: `data:video/mp4;base64,${b.toString("base64")}` };
  });
}

/** 让千问看一段（base64 data URL），返回描述 */
async function qwenDescribe(key: string, dataUrl: string, idx: number): Promise<string> {
  const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.QWEN_VL_MODEL || "qwen-vl-max",
      messages: [{ role: "user", content: [
        { type: "text", text: `这是短视频的第 ${idx} 段。用两句话描述画面（人物/场景/动作/字幕/镜头情绪），不要脑补。` },
        { type: "video", video: dataUrl },
      ] }],
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  if (res.status !== 200) throw new Error(`第${idx}段千问失败(${res.status}): ${text.slice(0, 160)}`);
  const j = JSON.parse(text);
  return j?.choices?.[0]?.message?.content || "";
}

/**
 * 大视频过渡方案 B 的升级：上传到 Vercel Blob 的大视频，后端下载 → ffmpeg 切成若干份
 * → 每份 base64 直接交给千问（绕开跨云下载超时）→ 整合成整体分析。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "analyze");
  if (!g.ok) return g.res;
  const body = await req.json().catch(() => ({}));
  const isDiag = body.diag === true;
  const quota = await checkAnalyzeQuota(req, { mode: isDiag ? "diag" : "normal" });
  if (!quota.ok) {
    return NextResponse.json({ error: "今日额度已用完，请明日再试。", code: "QUOTA_EXCEEDED" }, { status: 429 });
  }

  const videoUrl = String(body.videoUrl ?? "").trim();
  if (!/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json({ error: "缺少有效的视频 URL" }, { status: 400 });
  }
  const qwenKey = process.env.QWEN_API_KEY || "";
  const runs = Math.max(1, Math.min(Number(body.slice || 5), 5));
  const title = String(body.title ?? "").trim();

  try {
    const tmpDir = `/tmp/slice_${Date.now()}`;
    const input = `${tmpDir}/input.mp4`;
    fs.mkdirSync(tmpDir, { recursive: true });

    // ① 下载 Vercel 上的视频（Vercel 函数 → Vercel 存储，快）
    const dl = await fetch(videoUrl, { signal: AbortSignal.timeout(120000) });
    if (!dl.ok) throw new Error("视频下载失败：" + dl.status);
    fs.writeFileSync(input, Buffer.from(await dl.arrayBuffer()));

    const ff = ffmpegBin();
    // ② 切成 runs 份
    const pieces = await sliceToDataUrls(ff, input, tmpDir, runs);
    if (!pieces.length) throw new Error("切片失败：未生成片段");

    // ③ 每份交给千问（并行）
    const summaries = await Promise.all(pieces.map((p) => qwenDescribe(qwenKey, p.dataUrl, p.i)));
    void recordAiUsage({
      task: "video_analysis:slice",
      engine: "qwen",
      model: process.env.QWEN_VL_MODEL || "qwen-vl-max",
      endpoint: "/api/diagnosis/slice-analyze",
      status: "ok",
    });

    // ④ 整合：把各段描述一起交给 LLM 生成整体报告
    const visualSummary =
      `（已按 ${pieces.length} 段切片理解）\n` +
      summaries.map((s, i) => `第${i + 1}段：${s}`).join("\n");
    const report: any = await analyzeVideo({
      source: videoUrl,
      title,
      refType: "auto",
      visualSummary,
      transcript: undefined,
      timelineText: "",
    });
    report.visual = {
      mode: "real",
      frameCount: pieces.length,
      note: `已切片 ${pieces.length} 段分析`,
      transcript: undefined,
    };
    return NextResponse.json(report);
  } catch (e: any) {
    const msg = e?.message || "大视频切片分析异常";
    void recordAiUsage({
      task: "video_analysis:slice",
      engine: "qwen",
      model: process.env.QWEN_VL_MODEL || "qwen-vl-max",
      endpoint: "/api/diagnosis/slice-analyze",
      status: "error",
      error: msg.slice(0, 500),
    });
    return NextResponse.json(
      { error: `大视频切片分析失败：${msg}`, code: "SLICE_ANALYZE_FAILED", detail: msg },
      { status: 500 }
    );
  }
}
