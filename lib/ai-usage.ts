// AI 调用真实 token 使用记录（Phase 15-B）。
//
// 原则：只记录模型 API 真实返回的 usage（prompt/completion tokens）。
//  - API 返回了 usage → 写 token；estimated_cost 用「已知刊例价」估算，但算法里明确标注为 estimate。
//  - API 没返回 usage → token 与 estimated_cost 一律留空（NULL），绝不自己估算后冒充真实 token。
//
// 仅服务端引用（lib/llm.ts）。切勿在 'use client' 中 import。

import { hasDatabase, q } from "./db";

/** 已知模型的刊例价（元 / 百万 token）。未知模型返回 null，不强行估算。 */
const PRICES: Record<string, { in: number; out: number }> = {
  // DeepSeek（2026-08 峰谷价取「常规」一档做保守估计；真实成本依赖实际时段，故本就为估算）
  "deepseek-chat": { in: 3, out: 9 },
  "deepseek-reasoner": { in: 9, out: 27 },
  // 千问文本
  "qwen-plus": { in: 0.8, out: 2 },
  "qwen-max": { in: 2, out: 6 },
  "qwen-turbo": { in: 0.3, out: 0.6 },
  // 千问视觉
  "qwen-vl-max": { in: 5.871, out: 23.486 },
  "qwen-vl-max-latest": { in: 5.871, out: 23.486 },
  "qwen-vl-plus": { in: 1.541, out: 4.6 },
};

/** 根据 token 用量估算成本（元）。模型不在刊例价表 / 无 token 时返回 null。 */
export function estimateCost(
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined
): number | null {
  const p = PRICES[model.trim()];
  if (!p) return null;
  const i = inputTokens ?? 0;
  const o = outputTokens ?? 0;
  if (i === 0 && o === 0) return null;
  return Math.round(((i * p.in + o * p.out) / 1_000_000) * 1_000_000) / 1_000_000;
}

export interface AiUsageInput {
  /** 任务标签：用户任务用现有 scope（analyze/script/...），学习任务用 learning:*。 */
  task: string;
  /** 引擎（deepseek / qwen / openai / claude） */
  engine: string;
  /** 实际调用的模型名 */
  model: string;
  /** 请求端点（endpoint 路径，便于定位） */
  endpoint?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  status?: "ok" | "error";
  error?: string;
}

/** 写入一条 AI 用量记录。无数据库 / 写失败时静默降级（不影响主流程）。 */
export async function recordAiUsage(input: AiUsageInput): Promise<void> {
  if (!hasDatabase()) return;
  try {
    const cost = estimateCost(input.model, input.inputTokens, input.outputTokens);
    await q(
      `INSERT INTO ai_usage (task, engine, model, endpoint, input_tokens, output_tokens, total_tokens, estimated_cost, status, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        input.task ?? "",
        input.engine ?? "",
        input.model ?? "",
        input.endpoint ?? "",
        input.inputTokens ?? null,
        input.outputTokens ?? null,
        input.totalTokens ?? null,
        cost,
        input.status ?? "ok",
        input.error ?? null,
      ]
    );
  } catch (e) {
    // 仅记录失败，绝不因此中断 AI 主流程
    console.warn("[ai-usage] 记录失败（不影响主流程）：", e);
  }
}

/** 统计某任务当日的 AI 调用次数与 token（用于审计「今天实际调用了多少次 AI」）。 */
export async function aiUsageSummary(opts: {
  task?: string;
  since?: Date;
}): Promise<{ calls: number; totalTokens: number; estCost: number | null }> {
  if (!hasDatabase()) return { calls: 0, totalTokens: 0, estCost: null };
  const params: unknown[] = [];
  let where = "1=1";
  if (opts.task) {
    params.push(opts.task);
    where += ` AND task = $${params.length}`;
  }
  if (opts.since) {
    params.push(opts.since.toISOString());
    where += ` AND created_at >= $${params.length}`;
  }
  try {
    const rows = await q<{
      calls: string;
      total_tokens: string | null;
      est_cost: string | null;
    }>(
      `SELECT count(*)::int AS calls,
              COALESCE(sum(COALESCE(total_tokens, 0)), 0)::bigint AS total_tokens,
              sum(estimated_cost)::float8 AS est_cost
       FROM ai_usage WHERE ${where}`,
      params
    );
    const r = rows[0];
    return {
      calls: Number(r?.calls ?? 0),
      totalTokens: Number(r?.total_tokens ?? 0),
      estCost: r?.est_cost != null ? Number(r.est_cost) : null,
    };
  } catch (e) {
    console.warn("[ai-usage] 汇总失败：", e);
    return { calls: 0, totalTokens: 0, estCost: null };
  }
}
