// 统一的 LLM 适配层（仅服务端使用 —— 含 API Key，禁止在客户端 import）。
//
// 分层约定（2026-08 拍板，与「千问 + DeepSeek」一致）：
//   - 感知 / 内容理解层（看视频、画面、长文本理解）：阿里 Qwen（千问），视觉用 qwen-vl。
//   - 推理 / 生成层（文案、分类、润色、报告推理）：DeepSeek（deepseek-chat）。
//
// 所有函数都「有 key才真调，无 key 由调用方降级」，不会因缺 key 崩应用。
// 注意：本文件只被服务端代码引用（/api/copy、lib/hotspots-server、lib/ai/providers），
// 切勿在 'use client' 组件中 import，否则会泄露 Key。

import { recordAiUsage } from "./ai-usage";

export type LlmProvider = "deepseek" | "qwen";

interface ProviderCfg {
  label: string;
  role: "reasoning" | "perception";
  baseURL: string;
  /** 文本/推理模型 */
  model: string;
  /** 视觉模型（仅 perception 层需用） */
  visionModel?: string;
  apiKey: () => string;
}

export const LLM: Record<LlmProvider, ProviderCfg> = {
  deepseek: {
    label: "DeepSeek",
    role: "reasoning",
    baseURL: "https://api.deepseek.com/v1",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    apiKey: () => process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "",
  },
  qwen: {
    label: "Qwen（千问）",
    role: "perception",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: process.env.QWEN_MODEL || "qwen-plus",
    visionModel: process.env.QWEN_VL_MODEL || "qwen-vl-max",
    apiKey: () => process.env.QWEN_API_KEY || process.env.LLM_API_KEY || "",
  },
};

export function isConfigured(p: LlmProvider): boolean {
  return LLM[p].apiKey().length > 0;
}

export type ChatRole = "system" | "user" | "assistant";

// 文本消息：content 为字符串。
// 视觉消息：content 为数组，元素 {type:"text",text} | {type:"image_url",image_url:{url}}。
export type ChatContent =
  | string
  | (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "video_url"; video_url: { url: string } }
    )[];

export interface ChatMessage {
  role: ChatRole;
  content: ChatContent;
}

export interface ChatOpts {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** 任务标记（用户任务填 scope，学习任务填 learning:*），用于 AI 用量审计。 */
  task?: string;
}

/**
 * 通用 OpenAI 兼容对话补全。命中 DashScope 兼容模式与 DeepSeek 官方接口。
 * 返回模型原始文本；json=true 时尝试 JSON.parse 后返回对象（解析失败抛错由调用方降级）。
 */
export async function chat(
  p: LlmProvider,
  messages: ChatMessage[],
  opts: ChatOpts = {}
): Promise<string> {
  const cfg = LLM[p];
  const key = cfg.apiKey();
  if (!key) throw new Error(`[llm] ${cfg.label} 未配置 API Key`);

  const usesVision = messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some(
        (c) => (c as any).type === "image_url" || (c as any).type === "video_url"
      )
  );
  const model = usesVision && cfg.visionModel ? cfg.visionModel : cfg.model;

  // 视觉模型回退链：部分账号未开通带 -latest 后缀的模型时，自动降级到稳定版
  const candidates = usesVision
    ? [...new Set([model, "qwen-vl-max", "qwen-vl-plus"])]
    : [model];
  let lastErr: unknown = null;
  for (const m of candidates) {
      // 每个候选模型独立超时：一个模型超时不会把整个回退链 abort（原共享 timer 导致第一个超时即全灭）。
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 120000);
      let res: Response;
      try {
        res = await fetch(`${cfg.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: m,
            messages,
            ...(opts.json ? { response_format: { type: "json_object" } } : {}),
            temperature: opts.temperature ?? 0.7,
            ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        lastErr = new Error(`[llm] ${cfg.label} API ${res.status}: ${txt.slice(0, 300)}`);
        continue;
      }
      const data = await res.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) {
        lastErr = new Error(`[llm] ${cfg.label} 返回为空`);
        continue;
      }
      // 真实 usage（仅当 API 返回才记录；拿不到就交给 recordAiUsage 留空，绝不自己估算）。
      const usage = data?.usage ?? null;
      void recordAiUsage({
        task: opts.task ?? "general",
        engine: p,
        model: m,
        endpoint: "chat/completions",
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        status: "ok",
      });
      return content;
    }
    void recordAiUsage({
      task: opts.task ?? "general",
      engine: p,
      model: candidates[candidates.length - 1] ?? cfg.model,
      endpoint: "chat/completions",
      status: "error",
      error: lastErr instanceof Error ? lastErr.message : "LLM 调用失败",
    });
    throw lastErr ?? new Error(`[llm] ${cfg.label} 调用失败`);
}

/** 推理层（DeepSeek）：写文案、分类、润色、报告推理。 */
export function reasoningChat(messages: ChatMessage[], opts?: ChatOpts): Promise<string> {
  return chat("deepseek", messages, opts);
}

/** 感知 / 内容理解层（Qwen，千问）：默认文本模型，带图时自动切视觉模型。 */
export function perceiveChat(messages: ChatMessage[], opts?: ChatOpts): Promise<string> {
  return chat("qwen", messages, opts);
}
