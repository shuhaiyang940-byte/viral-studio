// 创作输入模型（Phase 16.7）：把「产品」从全局必填中解耦，允许主题/创作目标作为主输入。
// 纯函数，可单测。

export type ContentIntent = "commerce" | "knowledge" | "personal_ip" | "story" | "tutorial" | "review" | "brand" | "opinion" | "other";

export interface CreationInput {
  /** 内容主题（非产品场景下的主输入） */
  topic?: string;
  /** 产品 / 服务（可选，商业场景的补充上下文） */
  product?: string;
  /** 创作目标（涨粉 / 科普 / 建立专业度 / 带货…） */
  goal?: string;
  /** 内容意图 */
  intent?: ContentIntent;
}

/** 解析创作主输入：主题优先，产品兜底（绝不让"产品"成为非产品内容的前置）。 */
export function resolveCreationTopic(input: CreationInput | { product?: string; topic?: string }): string {
  const t = (input.topic ?? "").trim();
  const p = (input.product ?? "").trim();
  return t || p;
}

/** 判断内容意图：产品/品牌/带货 → commerce/brand；否则非商业。 */
export function contentIntentOf(g: { topic?: string; product?: string; goal?: string; content_type?: string }): ContentIntent {
  const s = `${g.goal} ${g.product} ${g.topic} ${g.content_type}`;
  if (/品牌|宣传|形象/.test(s)) return "brand";
  if (/带货|种草|卖|转化|产品|商品|好物/.test(s)) return "commerce";
  if (/知识|科普|教程|干货|涨知识|学习|方法|技巧|效率/.test(s)) return "knowledge";
  if (/人设|IP|个人/.test(s)) return "personal_ip";
  if (/故事|剧情|情感/.test(s)) return "story";
  if (/测评|测评|探店|评测/.test(s)) return "review";
  if (/观点|看法|评论|热点/.test(s)) return "opinion";
  return "other";
}

/** 从任意时长字符串解析秒数（"3分钟"/"180"/"00:03:00"/"3:00"）。 */
export function parseDurationSec(v: string | undefined | null): number | null {
  if (!v) return null;
  const s = v.trim();
  // "X分钟Y秒" / "X分Y秒"
  const mms = s.match(/(\d+(?:\.\d+)?)\s*(分钟|分)\s*(\d+(?:\.\d+)?)\s*秒/);
  if (mms) return Math.round(Number(mms[1]) * 60 + Number(mms[3]));
  if (/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.test(s)) {
    const p = s.split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  const m = s.match(/(\d+(?:\.\d+)?)\s*(分钟|分|min|m)?/i);
  if (m) {
    const n = Number(m[1]);
    if (/分钟|分|min/i.test(m[2] || "")) return Math.round(n * 60);
    return Math.round(n);
  }
  return null;
}

/** 选择分析端点：视频链接 → /api/analyze/url（真正读视频）；否则 /api/analyze。 */
export function selectAnalyzeEndpoint(mode: "upload" | "url"): string {
  return mode === "url" ? "/api/analyze/url" : "/api/analyze";
}

/** 语音转写覆盖率（0-100%）：转写覆盖时长 / 视频时长。 */
export function transcriptCoverage(videoSec: number | null | undefined, transcriptSec: number | null | undefined): number | null {
  if (!videoSec || videoSec <= 0 || transcriptSec == null) return null;
  return Math.round(Math.min(1, transcriptSec / videoSec) * 1000) / 10;
}

/** 分析完整度：有转写 → full；仅有画面 → partial；两者都无 → none。 */
export function analysisCompleteness(input: { vision: boolean; transcript: boolean }): "full" | "partial" | "none" {
  if (input.transcript) return "full";
  if (input.vision) return "partial";
  return "none";
}
