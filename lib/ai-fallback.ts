// AI 真实性与失败回退的统一判断层。
//
// 原则（正式商业环境）：
//   - 真实 AI 分析失败，绝对不能无提示地返回 Mock / 模板结果。
//   - 生产环境默认禁止「真实 AI 失败 → 自动 Mock」；失败应上报明确错误。
//   - 开发 / 测试可以使用 Mock；显式 ALLOW_AI_MOCK=1 仅用于内测白名单。
//
// 仅服务端引用（/api/... 与 lib 生成层），切勿在 'use client' 中 import。

export const AI_ANALYSIS_FAILED = "AI_ANALYSIS_FAILED";
export const AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED";

export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/** 是否允许使用 Mock / 模板回退（开发/测试允许；生产默认禁止，除非显式白名单） */
export function allowMockFallback(): boolean {
  if (process.env.ALLOW_AI_MOCK === "1") return true;
  return !isProd();
}

/** 真实 AI 无法成功时，构造「明确失败」错误（message 前缀带错误码，便于前端识别） */
export function aiFailure(code: "AI_ANALYSIS_FAILED" | "AI_NOT_CONFIGURED", detail?: string): Error {
  return new Error(code + (detail ? `: ${detail}` : ""));
}

/** 从错误信息中提取错误码（用于路由层返回 code 字段） */
export function codeOf(err: unknown): string {
  const m = err instanceof Error ? err.message : "";
  if (m.startsWith(AI_ANALYSIS_FAILED)) return AI_ANALYSIS_FAILED;
  if (m.startsWith(AI_NOT_CONFIGURED)) return AI_NOT_CONFIGURED;
  return AI_ANALYSIS_FAILED;
}
