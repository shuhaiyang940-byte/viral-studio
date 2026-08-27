// 学习审计报告聚合（Phase 15-B）。

import { q, hasDatabase } from "../db";
import { aiUsageSummary } from "../ai-usage";
import { sourceStatusReport } from "../sources/adapter";

export async function getLearningReport() {
  if (!hasDatabase()) {
    return { hasDb: false, message: "NO DATA: DATABASE_URL 未配置" };
  }

  const [latestJob] = await q<Record<string, any>>(
    `SELECT id, run_date, status, samples, valid, added, reinforced, downgraded, deprecated,
            budget_ai_calls, used_ai_calls, started_at, finished_at, attempt, error, created_at
     FROM learning_job ORDER BY created_at DESC LIMIT 1`
  ).catch((e) => (console.warn("[report] 任务查询失败：", e), []));

  const knowledgeByRole = await q<{ role: string; n: string }>(
    `SELECT role, count(*)::int AS n FROM knowledge GROUP BY role ORDER BY role`
  ).catch(() => []);
  const knowledgeByLifecycle = await q<{ lifecycle: string; n: string }>(
    `SELECT lifecycle, count(*)::int AS n FROM knowledge GROUP BY lifecycle ORDER BY lifecycle`
  ).catch(() => []);

  const recentObs = await q<Record<string, any>>(
    `SELECT id, source, source_status, platform, sample_id, role, extracted_pattern,
            extracted_knowledge_id, evidence_strength, polarity, counter_example, created_at
     FROM learning_observation ORDER BY created_at DESC LIMIT 30`
  ).catch(() => []);

  const usage = await aiUsageSummary({ task: "learning" });
  const userUsage = await aiUsageSummary({ task: "general" });

  return {
    hasDb: true,
    latestJob: latestJob ?? null,
    knowledgeByRole: knowledgeByRole.map((r) => ({ role: r.role, count: Number(r.n) })),
    knowledgeByLifecycle: knowledgeByLifecycle.map((r) => ({ lifecycle: r.lifecycle, count: Number(r.n) })),
    recentObservations: recentObs,
    learningAiUsage: usage,
    userTaskAiUsage: userUsage,
    sources: sourceStatusReport(),
    honestyNote:
      "当前学习源为标题级热榜（PARTIAL），视频正文/评论/弹幕/互动均为 SOURCE_UNAVAILABLE；本系统不生成/不伪造这些数据。",
  };
}
