// 每日学习任务（Phase 15-B）。
//
// 诚实性：
//   - 只把「真实标题级热榜」当作候选样本（source_status = PARTIAL）。
//   - 绝不调用 AI 去「自己总结规律→ACTIVE」，本任务不调 LLM 生成规律。
//   - 只有当某个「平台-类目」信号在真实样本中重复出现，才可能生成一条 NEW 知识（低置信）。
//   - 维护大扫除：对长期未被最近信号支持的知识做轻度衰减 / 转移生命周期。
//
// 隔离：学习任务使用独立 learning_job 记录，绝不触碰用户 quota；优先级低于用户任务。

import { q, hasDatabase } from "../db";
import {
  computeWeight,
  nextLifecycle,
  type Lifecycle,
  type Role,
} from "../knowledge-logic";
import {
  createKnowledge,
  findKnowledgeByPattern,
  listKnowledge,
  recordObservation,
  reinforceKnowledge,
  applyKnowledgeUpdate,
} from "../knowledge";
import { fetchLearningSamples, type LearningSample } from "../sources/adapter";

const intEnv = (name: string, fallback: number): number => {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

/** 每日学习预算（环境变量可覆盖）。 */
export function learningBudget() {
  return {
    dailyLimit: intEnv("LEARNING_DAILY_LIMIT", 1),
    maxAiCalls: intEnv("LEARNING_MAX_AI_CALLS", 20),
    maxItems: intEnv("LEARNING_MAX_ITEMS", 10),
  };
}

/** 是否已达 AI 调用预算。 */
export function exceedsBudget(usedCalls: number, budgetAiCalls: number): boolean {
  if (budgetAiCalls <= 0) return false; // 0 表示不限
  return usedCalls >= budgetAiCalls;
}

const hashId = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "hs-" + h.toString(36);
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d) / 86_400_000));
}

function markJob(id: string, status: string, patch: Record<string, unknown> = {}): Promise<void> {
  const cols = Object.keys(patch);
  const set = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
  return q(
    `UPDATE learning_job SET status = $1${set ? ", " + set : ""} WHERE id = $${cols.length + 2}`,
    [status, ...cols.map((c) => patch[c]), id]
  ).then(() => undefined as void);
}

export interface RunLearningJobOpts {
  runDate?: string;
  maxItems?: number;
  budgetAiCalls?: number;
  idempotencyKey?: string;
  changedBy?: string;
  /** 测试 / 自定义采样源：默认复用真实标题级热榜。 */
  samplesProvider?: () => Promise<{ samples: LearningSample[] }>;
  /** 已消耗的 AI 调用数（测试预算用）；真实任务为 0。 */
  usedAiCalls?: number;
}

export interface RunLearningJobResult {
  jobId: string;
  status: "DONE" | "PAUSED" | "ALREADY_RAN";
  samples: number;
  valid: number;
  added: number;
  reinforced: number;
  downgraded: number;
  deprecated: number;
  usedAiCalls: number;
  message: string;
}

/**
 * 运行一次每日学习任务（幂等）。
 * 同一 (runDate, idempotencyKey) 只执行一次；再次触发返回 ALREADY_RAN，不去重重复学习。
 */
export async function runLearningJob(opts: RunLearningJobOpts = {}): Promise<RunLearningJobResult> {
  const budget = learningBudget();
  const runDate = opts.runDate ?? new Date().toISOString().slice(0, 10);
  const idemKey = opts.idempotencyKey ?? "daily";
  const maxItems = Math.min(Math.max(opts.maxItems ?? budget.maxItems, 1), 100);
  const budgetAiCalls = opts.budgetAiCalls ?? budget.maxAiCalls;
  const changedBy = opts.changedBy ?? "system";
  const samplesProvider = opts.samplesProvider ?? (() => fetchLearningSamples({ maxItems }));
  let usedAiCalls = opts.usedAiCalls ?? 0;

  if (!hasDatabase()) {
    return { jobId: "", status: "PAUSED", samples: 0, valid: 0, added: 0, reinforced: 0, downgraded: 0, deprecated: 0, usedAiCalls: budgetAiCalls, message: "NO DATA: DATABASE_URL 未配置，无法执行学习任务" };
  }

  // 确定性 jobId：同 (run_date, idempotency_key) 稳定映射到同一行，天然幂等。
  const jobId = `lj-${hashId(`${runDate}::${idemKey}`)}`;
  try {
    const ins = await q<{ id: string; status: string }>(
      `INSERT INTO learning_job (id, run_date, status, attempt, idempotency_key)
       VALUES ($1, $2, 'RUNNING', 1, $3)
       ON CONFLICT (run_date, idempotency_key) DO UPDATE SET
         attempt = learning_job.attempt + 1,
         status = CASE WHEN learning_job.status = 'DONE' THEN learning_job.status ELSE 'RUNNING' END
       RETURNING id, status`,
      [jobId, runDate, idemKey]
    );
    const row = ins[0];
    if (!row) {
      await markJob(jobId, "PAUSED", { error: "job 创建失败" });
      return { jobId, status: "PAUSED", samples: 0, valid: 0, added: 0, reinforced: 0, downgraded: 0, deprecated: 0, usedAiCalls: budgetAiCalls, message: "job 创建失败" };
    }
    if (row.status === "DONE") {
      const st = await q<{ samples: number; valid: number; added: number; reinforced: number; downgraded: number; deprecated: number }>(
        `SELECT samples, valid, added, reinforced, downgraded, deprecated FROM learning_job WHERE id = $1`, [row.id]
      );
      const s = st[0] ?? {};
      return {
        jobId: row.id, status: "ALREADY_RAN",
        samples: Number(s.samples || 0), valid: Number(s.valid || 0), added: Number(s.added || 0),
        reinforced: Number(s.reinforced || 0), downgraded: Number(s.downgraded || 0),
        deprecated: Number(s.deprecated || 0), usedAiCalls: budgetAiCalls, message: "当天任务已执行，未重复学习",
      };
    }

    // 预算保护：已达到 AI 调用上限则停止（不继续调用）。
    if (exceedsBudget(usedAiCalls, budgetAiCalls)) {
      await markJob(jobId, "PAUSED", {
        used_ai_calls: usedAiCalls,
        error: "已达 LEARNING_MAX_AI_CALLS 上限，自动停止",
      });
      return {
        jobId, status: "PAUSED", samples: 0, valid: 0, added: 0, reinforced: 0,
        downgraded: 0, deprecated: 0, usedAiCalls, message: "预算已用完，任务自动停止",
      };
    }

    // ── 采样：真实标题级候选样本 ──
    const { samples: candidates } = await samplesProvider();
    let samples = 0, valid = 0, added = 0, reinforced = 0, downgraded = 0, deprecated = 0;

    // 1) 候选观察（真实，标题级）
    for (const s of candidates.slice(0, maxItems)) {
      samples += 1;
      if (s.source_status === "SOURCE_UNAVAILABLE" || !s.title) continue;
      valid += 1;
      const pattern = `平台${s.platform}「${s.category}」类目出现高热标题`;
      await recordObservation({
        source: s.source,
        source_status: s.source_status,
        platform: s.platform,
        sample_id: s.id,
        role: "OPERATOR",
        observed_signal: `标题「${String(s.title).slice(0, 40)}」热度 ${s.heat}`,
        extracted_pattern: pattern,
        evidence_strength: 0.3,
        polarity: "positive",
        dedupe_hash: hashId(`${s.source}|${s.platform}|${s.id}|title`),
      });
    }

    // 2) 仅当「平台-类目」在候选里重复出现≥2 次，才可能形成一条 NEW 知识（低置信，绝不 ACTIVE）
    const catCount = new Map<string, { platform: string; category: string; n: number }>();
    for (const s of candidates) {
      const k = `${s.platform}::${s.category}`;
      if (!catCount.has(k)) catCount.set(k, { platform: s.platform, category: s.category, n: 0 });
      catCount.get(k)!.n += 1;
    }
    for (const item of catCount.values()) {
      if (item.n < 2) continue;
      const role: Role = "OPERATOR";
      const pattern = `平台${item.platform}「${item.category}」类目出现高热标题`;
      const existing = await findKnowledgeByPattern(role, pattern);
      if (existing) {
        const r = await reinforceKnowledge(existing.id, { source: "hotlist", changed_by: changedBy });
        if (r) reinforced += 1;
      } else {
        const k = await createKnowledge({
          role,
          pattern,
          description: `${item.platform} 的 ${item.category} 类目在标题级热榜出现 ${item.n} 次`,
          why: "观察样本来自真实标题热榜，仅作为弱信号，尚不足以证明创作规律。",
          action: "可作为选题方向候选，不代表稳定爆款公式。",
          platform: item.platform,
          category: item.category,
          source: "hotlist",
          source_status: "PARTIAL",
          trend_type: "SHORT_TERM",
          longevity: 20,
        });
        if (k) {
          added += 1;
          await recordObservation({
            source: "hotlist", source_status: "PARTIAL", platform: item.platform,
            sample_id: k.id, role: "OPERATOR",
            observed_signal: `平台-类目重复信号 x${item.n}`,
            extracted_pattern: pattern, extracted_knowledge_id: k.id, evidence_strength: 0.3,
            dedupe_hash: hashId(`signal|${pattern}`),
          });
        }
      }
    }

    // 3) 维护大扫除：长期无最近信号的知识做轻度衰减 / 过期（不删除）
    const allKnowledge = await listKnowledge({ limit: 100 });
    for (const k of allKnowledge) {
      if (k.lifecycle === "DEPRECATED" || k.lifecycle === "REJECTED") continue;
      const days = daysSince(k.last_signal_at);
      if (days == null || days <= 30) continue;
      const weight = computeWeight({
        currentWeight: k.weight, evidenceCount: k.evidence_count, successCount: k.success_count,
        failCount: k.fail_count, confidence: k.confidence, learningValue: k.learning_value,
        transferability: k.transferability, recentSignalDays: days,
      });
      const lifecycle: Lifecycle = nextLifecycle({
        current: k.lifecycle, weight, confidence: k.confidence,
        evidenceCount: k.evidence_count, recentSignalDays: days,
      });
      if (Math.abs(weight - k.weight) >= 1 || lifecycle !== k.lifecycle) {
        await applyKnowledgeUpdate(k.id, {
          weight,
          confidence: k.confidence,
          learning_value: k.learning_value,
          lifecycle,
          is_deprecated: lifecycle === "DEPRECATED",
        }, {
          reason: "维护：长期无最近信号，衰减权重 / 转移生命周期",
          evidence: `last_signal_at ${days} 天前`,
          changed_by: changedBy,
        });
        if (lifecycle === "DEPRECATED") deprecated += 1;
        else downgraded += 1;
      }
    }

    await markJob(jobId, "DONE", {
      samples, valid, added, reinforced, downgraded, deprecated,
      used_ai_calls: usedAiCalls, finished_at: new Date().toISOString(),
    });
    return {
      jobId, status: "DONE", samples, valid, added, reinforced, downgraded, deprecated,
      usedAiCalls,
      message: `已采样 ${samples} 条真实标题级候选；新增 ${added} 条 NEW 知识；强化 ${reinforced} 条；降权 ${downgraded} 条；过期 ${deprecated} 条`,
    };
  } catch (e) {
    console.error("[learning] 学习任务失败：", e);
    await markJob(jobId, "FAILED", { error: e instanceof Error ? e.message : String(e) });
    return {
      jobId, status: "PAUSED", samples: 0, valid: 0, added: 0, reinforced: 0,
      downgraded: 0, deprecated: 0, usedAiCalls,
      message: `FAILED: ${e instanceof Error ? e.message : "未知错误"}`,
    };
  }
}
