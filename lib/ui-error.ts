/**
 * 面向用户的友好错误文案。
 * 目的：前端绝不直接透传后端内部错误码（如 AI_ANALYSIS_FAILED: DeepSeek returned invalid JSON）、
 * 数据库字段、provider 错误或 stack trace；只给用户可理解的提示。
 *
 * 原则：不虚构错误原因；真实原因未知时给通用文案。
 */
export function friendlyError(raw?: string | null, code?: string | null): string {
  const c = code || "";
  if (c === "QUOTA_EXCEEDED" || c === "ANON_QUOTA_EXCEEDED" || (raw && /今日.*用完|免费额度已用完|次数已用完/.test(raw))) {
    return "今日免费额度已用完，明天会自动恢复，本次不会消耗额度。";
  }
  if (c === "DUPLICATE_REQUEST") {
    return "这条内容正在生成中，请稍候（请不要重复点击）。";
  }
  const s = raw || "";
  // 命中内部错误特征 → 统一友好文案，不暴露细节
  if (
    c.startsWith("AI_") ||
    /AI_ANALYSIS_FAILED|AI_GENERATION_FAILED|AI_NOT_CONFIGURED|DeepSeek|Qwen|invalid JSON|expected|JSON|TypeError|RangeError| at |Error:|stack/i.test(s)
  ) {
    return "本次生成没有完成，请稍后再试。此次失败不会消耗额度。";
  }
  if (!s || /undefined|\[object Object\]|Internal Server Error/i.test(s)) {
    return "操作没有完成，请稍后再试。";
  }
  return s;
}
