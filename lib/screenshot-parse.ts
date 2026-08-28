// 截图内容理解：把用户上传的账号截图（数据页/主页）交给 Qwen-VL，
// 让 AI 读出「粉丝量 / 播放 / 点赞 / 评论 / 转发」等真实数据，回填到诊断输入。
// 诚实边界：读取结果来自截图，可能存在截图外的数据缺失或识别误差，需标注来源=screen。

import { chat, isConfigured } from "@/lib/llm";
import { aiFailure, AI_ANALYSIS_FAILED } from "@/lib/ai-fallback";

export interface ScreenshotParseResult {
  ok: boolean;
  /** AI 读出的结构化数据（可能只有部分） */
  data: {
    followers?: number;
    engagementRate?: number;
    avgPlays?: number;
    avgLikes?: number;
    avgComments?: number;
    avgShares?: number;
    appName?: string;
  };
  /** AI 对截图的口头描述（供核对） */
  rawText: string;
  note: string;
}

/** 用 Qwen-VL 从截图 URL 读取账号数据 */
export async function parseScreenshot(url: string, platform?: string): Promise<ScreenshotParseResult> {
  if (!isConfigured("qwen")) {
    throw aiFailure(AI_ANALYSIS_FAILED, "未配置视觉模型，无法读取截图");
  }
  const sys =
    "你是账号数据识别助手。用户上传的是一张短视频/内容平台的账号或数据页截图。" +
    "请从中读取并返回 JSON：{\"followers\":\"粉丝数(万,数字)\",\"engagementRate\":\"互动率(%)\"," +
    "\"avgPlays\":\"平均播放/观看\",\"avgLikes\":\"平均点赞\",\"avgComments\":\"平均评论\",\"avgShares\":\"平均转发\"," +
    "\"appName\":\"平台名\",\"rawText\":\"对截图的一句话描述\"}。" +
    "规则：只读截图里真实出现的数字，没看到的字段返回 null，绝不编造。";
  const user =
    `请读取这张${platform ? (platform + " ") : ""}账号/数据截图。` +
    "只返回 JSON。";
  const raw = await chat("qwen", [
    { role: "system", content: sys },
    {
      role: "user",
      content: [
        { type: "text", text: user },
        { type: "image_url", image_url: { url } },
      ],
    },
  ], { json: true, temperature: 0.2, maxTokens: 800 });
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null) return undefined;
    const n = Number(String(v).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const hasAny =
    ["followers", "engagementRate", "avgPlays", "avgLikes", "avgComments", "avgShares"]
      .some((k) => parsed?.[k] != null && String(parsed[k]).trim() !== "" && String(parsed[k]) !== "null");
  return {
    ok: hasAny,
    data: {
      followers: num(parsed?.followers),
      engagementRate: num(parsed?.engagementRate),
      avgPlays: num(parsed?.avgPlays),
      avgLikes: num(parsed?.avgLikes),
      avgComments: num(parsed?.avgComments),
      avgShares: num(parsed?.avgShares),
      appName: parsed?.appName ? String(parsed.appName) : undefined,
    },
    rawText: parsed?.rawText ? String(parsed.rawText) : "",
    note: hasAny
      ? "已从截图读取部分账号数据，请核对后继续。截图数据仍需你确认是否准确。"
      : "未从截图识别到明确数字。建议上传更清晰的账号数据页截图。",
  };
}
