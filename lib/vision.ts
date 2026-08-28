import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { chat, isConfigured } from "@/lib/llm";

const execFileP = promisify(execFile);

export interface ExtractedFrames {
  /** base64 data URL 列表（可直接作为 image_url 传给视觉模型） */
  frames: string[];
  meta: {
    durationSec: number;
    frameCount: number;
    width: number;
    engine: string;
  };
}

/**
 * 用 ffmpeg 从视频中均匀抽取 N 帧（JPEG base64）。
 * 依赖：本机已安装 ffmpeg（macOS: brew install ffmpeg）。
 * 失败返回 null（调用方降级为「无画面理解」）。
 */
export async function extractFrames(
  videoPath: string,
  opts: { count?: number; width?: number } = {}
): Promise<ExtractedFrames | null> {
  const count = Math.min(6, Math.max(3, opts.count ?? 4));
  const width = opts.width ?? 512;

  let durationSec = 0;
  try {
    const { stdout } = await execFileP("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      videoPath,
    ]);
    durationSec = parseFloat(stdout.trim()) || 0;
  } catch {
    return null;
  }
  if (durationSec < 0.5) return null;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsa-frames-"));
  try {
    const frames: string[] = [];
    const times: number[] = [];
    for (let i = 0; i < count; i++) {
      // 均匀采样：取每段的中间点，避开纯黑开场/结尾
      const t = Math.max(0.1, ((i + 0.5) / count) * durationSec);
      times.push(Math.min(t, Math.max(0.1, durationSec - 0.1)));
    }
    for (let i = 0; i < times.length; i++) {
      const out = path.join(dir, `f${i}.jpg`);
      await execFileP("ffmpeg", [
        "-ss", times[i].toFixed(2),
        "-i", videoPath,
        "-frames:v", "1",
        "-vf", `scale='min(${width},iw)':-2`,
        "-q:v", "3",
        "-y", out,
      ]);
      const buf = fs.readFileSync(out);
      frames.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
      fs.rmSync(out, { force: true });
    }
    return {
      frames,
      meta: { durationSec: Math.round(durationSec), frameCount: frames.length, width, engine: "ffmpeg" },
    };
  } catch (e) {
    console.warn("[vision] 抽帧失败：", e);
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 让 Qwen-VL 逐帧理解视频画面，返回视觉摘要。
 * - AI_VISION_MOCK=1 或未配置千问 Key 时返回确定性演示摘要（不烧额度）。
 * - 真实模式：多帧 base64 直传 DashScope 视觉模型。
 */
export async function describeFrames(
  frames: string[],
  title: string,
  refType?: string
): Promise<{ summary: string; mode: "real" | "mock" }> {
  const mock = process.env.AI_VISION_MOCK === "1" || !isConfigured("qwen");
  if (mock) {
    return {
      mode: "mock",
      summary:
        `（演示画面理解）已从视频中提取 ${frames.length} 帧进行分析。` +
        `视频标题：${title || "未提供"}，参考类型：${refType || "未指定"}。` +
        "当前为演示模式，未调用视觉模型；配置 QWEN_API_KEY 且 AI_VISION_MOCK=0 后将输出真实逐帧画面描述。",
    };
  }

  const prompt = `你是短视频画面分析专家。下面是一段短视频按时间顺序均匀抽取的 ${frames.length} 帧画面（第 1 帧接近开头，最后一帧接近结尾）。视频标题：${title || "未知"}，参考类型：${refType || "未知"}。
请逐帧描述并输出结构化文本（不要用 Markdown）：
1. 每帧：画面里有什么（场景/人物/物体）、有没有可见文字或字幕、镜头角度与景别（特写/中景/远景）、画面情绪；
2. 整体：镜头语言变化（如何运镜/转场）、内容节奏、画面里最抓人的视觉元素；
3. 结论：这条视频的画面上「为什么能留住人」（2-3 条）。
注意：只描述画面里真实看到的内容，不要脑补没有的信息。`;

  const content = [
    { type: "text" as const, text: prompt },
    ...frames.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
  const text = await chat("qwen", [{ role: "user", content }], {
    temperature: 0.3,
    maxTokens: 1200,
    timeoutMs: 90000,
  });
  return { mode: "real", summary: text.trim() };
}

/* ═══════════ 服务器化：视频 URL 直接理解（无需 ffmpeg） ═══════════ */

export interface UrlUnderstanding {
  summary: string;
  mode: "real" | "mock" | "none";
  frameCount: number;
  note: string;
  /** 语音转写文本（Qwen-Audio，AI_ASR=1 时尝试；失败为 undefined） */
  transcript?: string;
}

/**
 * 把视频的公网 URL 直接交给 Qwen-VL 理解（DashScope 兼容 OpenAI 协议，
 * content 支持 {"type":"video_url","video_url":{"url":...}}）。
 * 这是 Serverless 部署的主路径：不需要 ffmpeg、不落本地文件。
 * AI_VISION_MOCK=1 或未配置千问 Key 时返回演示摘要。
 */
export async function understandVideoUrl(
  videoUrl: string,
  title: string,
  refType?: string,
  frames?: string[] // 视频关键帧（base64 图片 dataURL）。有则用图片给千问，绕开"Vercel→千问看视频"跨境不可靠
): Promise<UrlUnderstanding> {
  const mock = process.env.AI_VISION_MOCK === "1" || !isConfigured("qwen");
  if (mock) {
    return {
      summary:
        `（演示画面理解）视频 URL：${videoUrl.slice(0, 120)}。` +
        `标题：${title || "未提供"}，参考类型：${refType || "未指定"}。` +
        "演示模式未调用视觉模型；配置 QWEN_API_KEY 且 AI_VISION_MOCK=0 后，将把视频 URL 直接交给 Qwen-VL 做真实逐帧理解。",
      mode: "mock",
      frameCount: 0,
      note: "演示模式：未调用视觉模型（配置 QWEN_API_KEY 且 AI_VISION_MOCK=0 后启用真实视频理解）",
      transcript: undefined,
    };
  }

  try {
    const prompt = `你是短视频画面分析专家。下面是一段短视频的公网文件：${videoUrl}
视频标题：${title || "未知"}，参考类型：${refType || "未知"}。
请观看视频并输出结构化文本（不要用 Markdown）：
1. 逐段描述画面：场景/人物/物体、可见文字或字幕、镜头角度与景别、画面情绪；
2. 镜头语言：运镜、转场、节奏变化；
3. 最抓人的视觉元素；
4. 结论：这条视频的画面上「为什么能留住人」（2-3 条）。
注意：只描述画面里真实看到的内容，不要脑补没有的信息。`;
    const content: any[] = [{ type: "text", text: prompt }];
    if (frames && frames.length) {
      // 关键帧图片给千问（图片调用在 Vercel 上稳定）
      for (const f of frames) content.push({ type: "image_url", image_url: { url: f } });
    } else if (videoUrl.startsWith("data:")) {
      content.push({ type: "video", video: videoUrl });
    } else {
      content.push({ type: "video_url", video_url: { url: videoUrl } });
    }
    const text = await chat(
      "qwen",
      [
        {
          role: "user",
          content,
        },
      ],
      { temperature: 0.3, maxTokens: 1500, timeoutMs: 240000 }
    );
    const transcript = (await transcribeWithQwenAudio(videoUrl)) ?? undefined;
    return {
      summary: text.trim(),
      mode: "real",
      frameCount: frames?.length || 0,
      note: transcript
        ? "已通过视频 URL 直接理解画面，并完成语音转写"
        : "已通过视频 URL 直接理解画面（语音转写未启用或失败）",
      transcript,
    };
  } catch (e) {
    console.warn("[vision] 视频 URL 理解失败：", e);
    return {
      summary: "",
      mode: "none",
      frameCount: 0,
      note: `视频 URL 理解失败（${e instanceof Error ? e.message.slice(0, 120) : "未知错误"}），报告基于标题与类型推断生成`,
      transcript: undefined,
    };
  }
}

/**
 * 语音转写（ASR）：优先 Qwen-Omni（原生支持音视频输入，可吃视频 URL），
 * 失败时对纯音频 URL 回退 Qwen-Audio。需要 AI_ASR=1 且配置 QWEN_API_KEY。
 * Serverless 友好：只传公网 URL，无本地文件。
 */
export async function transcribeWithQwenAudio(
  videoUrl: string
): Promise<string | undefined> {
  if (process.env.AI_ASR !== "1") return undefined;
  const key = process.env.QWEN_API_KEY || process.env.LLM_API_KEY;
  if (!key) return undefined;

  const PROMPT = "请把这段视频/音频中的语音完整转写为文字，只输出转写文本本身，不要任何解释。";
  const isAudio = /\.(mp3|wav|m4a|aac|ogg|flac|opus)(\?|$)/i.test(videoUrl);
  const tries: { model: string; content: unknown[] }[] = [
    // 1) Qwen-Omni：视频/音频都可（视频 URL 用 video 参数）
    { model: process.env.QWEN_AUDIO_MODEL || "qwen-omni-turbo", content: [{ text: PROMPT }, { video: videoUrl }] },
  ];
  // 2) 纯音频 URL 时，Qwen-Audio 更便宜更快
  if (isAudio) {
    tries.push({ model: "qwen-audio-turbo", content: [{ text: PROMPT }, { audio: videoUrl }] });
  }

  for (const t of tries) {
    try {
      const res = await fetch(
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: t.model,
            input: { messages: [{ role: "user", content: t.content }] },
          }),
          signal: AbortSignal.timeout(180000),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[asr] ${t.model} 转写失败（${res.status}）：${body.slice(0, 160)}`);
        continue;
      }
      const data = await res.json();
      const content = data?.output?.choices?.[0]?.message?.content;
      if (Array.isArray(content)) {
        const txt = content.map((c) => c?.text || "").join("").trim();
        if (txt) return txt;
      } else if (typeof content === "string" && content.trim()) {
        return content.trim();
      }
    } catch (e) {
      console.warn(`[asr] ${t.model} 转写异常：`, e);
    }
  }
  return undefined;
}

/** 用 ffmpeg 从本地视频提取音轨为 16k 单声道 wav，返回路径（失败返回 null）。 */
export async function extractAudio(
  videoPath: string,
  outWav: string
): Promise<string | null> {
  try {
    await execFileP("ffmpeg", [
      "-y", "-i", videoPath, "-vn",
      "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
      outWav,
    ]);
    return fs.existsSync(outWav) ? outWav : null;
  } catch (e) {
    console.warn("[asr] 提取音频失败：", e);
    return null;
  }
}

/**
 * 本地音频 → Qwen ASR（DashScope multimodal-generation，qwen-omni 支持 audio 数据 URL）。
 * 仅供上传路径：把 ffmpeg 提取的 wav 以 base64 data URL 送入。失败返回 undefined（绝不造假）。
 */
export async function transcribeLocalAudio(
  wavPath: string
): Promise<string | undefined> {
  if (process.env.AI_ASR !== "1") return undefined;
  const key = process.env.QWEN_API_KEY || process.env.LLM_API_KEY;
  if (!key) return undefined;
  try {
    const buf = fs.readFileSync(wavPath);
    const dataUrl = `data:audio/wav;base64,${buf.toString("base64")}`;
    const PROMPT = "请把这段音频中的语音完整转写为文字，只输出转写文本本身，不要任何解释。";
    const model = process.env.QWEN_AUDIO_MODEL || "qwen-omni-turbo";
    const res = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          input: { messages: [{ role: "user", content: [{ text: PROMPT }, { audio: dataUrl }] }] },
        }),
        signal: AbortSignal.timeout(90000),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[asr] 本地转写失败（${res.status}）：${body.slice(0, 200)}`);
      return undefined;
    }
    const data = await res.json();
    const content = data?.output?.choices?.[0]?.message?.content;
    if (Array.isArray(content)) return content.map((c) => c?.text || "").join("").trim() || undefined;
    if (typeof content === "string" && content.trim()) return content.trim();
    return undefined;
  } catch (e) {
    console.warn("[asr] 本地转写异常：", e);
    return undefined;
  }
}
