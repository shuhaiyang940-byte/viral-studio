import type {
  AdaptedPlan,
  AnalysisReport,
  EmotionCurve,
  Golden3s,
  OnboardingProfile,
  ReportSection,
  ScoreBreakdown,
  ShotBlueprint,
  VideoMeta,
  ViralFormula,
} from "@/lib/types";
import { buildPrompt, randomId } from "./mock";
import { chat } from "@/lib/llm";

interface RawReport {
  meta: VideoMeta;
  score: ScoreBreakdown;
  section: ReportSection;
  golden3s?: Golden3s;
  emotionCurve?: EmotionCurve;
  formula?: ViralFormula;
  storyboard?: ShotBlueprint[];
  adaptedPlan?: AdaptedPlan;
}

/** 去除 {topic} 之类占位符残留与首尾空白 */
function cleanText(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/\{[^}]*\}/g, "").trim();
}

/** 生成的标题是否与原标题过近（含原标题 8+ 字连续片段即判为"套用原标题"） */
function titleTooClose(t: string, title?: string): boolean {
  if (!title || title.length < 8) return false;
  for (let i = 0; i + 8 <= title.length; i++) {
    if (t.includes(title.slice(i, i + 8))) return true;
  }
  return false;
}

/** 跨 provider 通用的报告清洗：过滤脏标题/空项，保证 UI 不会拿到占位符或套原标题的文案 */
function sanitizeReport(raw: RawReport, input: { title?: string }): RawReport {
  const title = input.title?.trim();
  if (raw.meta && typeof raw.meta === "object") {
    raw.meta.title = cleanText(raw.meta.title) || title || "未命名视频";
  }
  const sec = raw.section;
  if (sec) {
    if (Array.isArray(sec.titles)) {
      const seen = new Set<string>();
      sec.titles = sec.titles
        .map((t) => cleanText(t))
        .filter((t) => t.length >= 6 && t.length <= 40)
        .filter((t) => !titleTooClose(t, title))
        .filter((t) => {
          const k = t.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 10);
    }
    if (Array.isArray(sec.whyHot)) {
      sec.whyHot = sec.whyHot.map((w) => cleanText(w)).filter((w) => (w || "").length >= 4);
    }
  }
  // 分镜蓝图 / 主题适配：过滤结构不完整的条目，避免 UI 拿到脏数据
  if (Array.isArray(raw.storyboard)) {
    raw.storyboard = raw.storyboard
      .filter(
        (s) =>
          s &&
          typeof s === "object" &&
          typeof s.visual === "string" &&
          typeof s.line === "string"
      )
      .map((s, i) => ({ ...s, index: i + 1 }))
      .slice(0, 10);
    if (!raw.storyboard.length) delete raw.storyboard;
  }
  if (raw.adaptedPlan && typeof raw.adaptedPlan === "object") {
    const ap = raw.adaptedPlan as {
      userTopic?: unknown;
      note?: unknown;
      shots?: unknown[];
    };
    ap.shots = Array.isArray(ap.shots)
      ? ap.shots
          .filter(
            (s) =>
              s &&
              typeof s === "object" &&
              typeof (s as any).yourVersion === "string"
          )
          .map((s) => {
            const shot = s as any;
            return {
              ...shot,
              index: shot.index ?? 0,
              howToFilm: Array.isArray(shot.howToFilm)
                ? shot.howToFilm.filter((h: unknown) => typeof h === "string").slice(0, 4)
                : [],
            };
          })
          .slice(0, 10)
      : [];
    if (!ap.shots.length || typeof ap.userTopic !== "string") {
      delete raw.adaptedPlan;
    }
  }
  return raw;
}

/**
 * OpenAI 兼容接口（OpenAI / DeepSeek 等均为此格式）。
 * 真实接入时设置环境变量：AI_PROVIDER=openai|deepseek 以及对应 API Key。
 */
async function callOpenAICompat(
  baseURL: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<RawReport> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "你是短视频爆款分析专家，只返回 JSON，不要任何解释。" },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(150000),
      });
      if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Anthropic Claude 接口（使用 Messages API）。 */
async function callClaude(prompt: string): Promise<RawReport> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CLAUDE_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      system: "你是短视频爆款分析专家，只返回 JSON，不要任何解释文字。",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data.content?.map((b: { text?: string }) => b.text || "").join("") || "{}";
  return JSON.parse(text);
}

export async function analyzeWithProvider(
  provider: string,
  input: {
    source?: string;
    title?: string;
    profile?: OnboardingProfile;
    refType?: string;
    visualSummary?: string;
    transcript?: string;
    timelineText?: string;
  }
): Promise<AnalysisReport> {
  const prompt = buildPrompt(input);
  let raw: RawReport;

  switch (provider) {
    case "openai":
      raw = await callOpenAICompat(
        "https://api.openai.com/v1",
        process.env.OPENAI_API_KEY || "",
        process.env.OPENAI_MODEL || "gpt-4o",
        prompt
      );
      break;
    case "deepseek":
      raw = await callOpenAICompat(
        "https://api.deepseek.com/v1",
        process.env.DEEPSEEK_API_KEY || "",
        process.env.DEEPSEEK_MODEL || "deepseek-chat",
        prompt
      );
      break;
    case "qwen":
      // 感知 / 内容理解层（千问）：复用统一 LLM 客户端，json 模式直接拿结构化报告。
      raw = JSON.parse(
        await chat("qwen", [
          {
            role: "system",
            content: "你是短视频爆款分析专家，只返回 JSON，不要任何解释。",
          },
          { role: "user", content: prompt },
        ], { json: true, temperature: 0.7 })
      );
      break;
    case "claude":
      raw = await callClaude(prompt);
      break;
    default:
      throw new Error(`未知的 AI 提供商: ${provider}`);
  }

  return {
    id: randomId(),
    createdAt: new Date().toISOString(),
    ...sanitizeReport(raw, input),
  };
}
