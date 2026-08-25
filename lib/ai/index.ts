import type { AnalysisReport, OnboardingProfile } from "@/lib/types";
import { generateMockReport } from "./mock";
import { analyzeWithProvider } from "./providers";
import { isProd, allowMockFallback, aiFailure, AI_NOT_CONFIGURED, AI_ANALYSIS_FAILED } from "@/lib/ai-fallback";

export interface AnalyzeInput {
  source?: string;
  title?: string;
  /** 真实视频理解产出的视觉摘要（上传模式），无则忽略 */
  visualSummary?: string;
  /** 语音转写文本（Qwen-Audio），无则忽略 */
  transcript?: string;
  /** 新手摸底档案，用于个性化建议；真实模型路径也会透传 */
  profile?: OnboardingProfile;
  /** 参考视频类型（演示模式由用户指定，让方向匹配判定确定可控；真实模型可由视频识别覆盖） */
  refType?: string;
}

/**
 * 统一分析入口。
 * 默认走 Mock（无需任何 API Key，保证 Demo 永远可跑）；
 * 设置环境变量 AI_PROVIDER=openai|deepseek|claude|qwen 且配置对应 Key 后，自动切换真实模型。
 *   - qwen（千问）= 感知/内容理解层；deepseek = 推理层。
 * 真实接口异常时回退 Mock，避免 Demo 崩坏。
 *
 * 真实接入推荐「国内模型分层栈」（2026-08 拍板）：
 * - 感知层（看视频 / 画面 / 音频）：阿里 Qwen3-VL（原生长视频理解、Apache-2.0 可自部署）或字节 Doubao-Seed-2.0；
 * - 推理层（拆解 / 建议 / 评分）：DeepSeek V4（文本 / 推理 / 代码强、极便宜，但视频弱，不用来"看"视频）。
 * 全链路国内，规避 Gemini 国外信号不稳 + 价格贵的问题。
 */
export async function analyzeVideo(input: AnalyzeInput): Promise<AnalysisReport> {
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();

  if (provider === "mock") {
    if (isProd() && !allowMockFallback()) {
      throw aiFailure(AI_NOT_CONFIGURED, "AI_PROVIDER=mock 不能用于生产");
    }
    return generateMockReport(input);
  }

  try {
    return await analyzeWithProvider(provider, input);
  } catch (err) {
    if (!allowMockFallback()) {
      console.error(`[ai] ${provider} 真实分析失败（生产，不回退 mock）：`, err);
      throw aiFailure(AI_ANALYSIS_FAILED, err instanceof Error ? err.message : "AI 分析失败");
    }
    console.warn(`[ai] ${provider} 分析失败（开发回退 mock）：`, err);
    return generateMockReport(input);
  }
}
