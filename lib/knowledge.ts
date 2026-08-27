// 知识服务层（Phase 15-B）。把「观察→提炼→评分→权重→生命周期→版本」落到真实的 DB。
// 仅服务端引用；切勿在 'use client' 中 import。
//
// 硬边界：
//   - 有真实证据才升权；无证据 / 反例多则降权。
//   - 任何重要变化都写 knowledge_version + role_weight_log（可回滚、可审计）。
//   - DEPRECATED 只降权 / 标记，绝不删除历史。

import { randomUUID } from "node:crypto";
import { q, hasDatabase } from "./db";
import {
  learningValueScore,
  computeWeight,
  applyCounterExample,
  nextLifecycle,
  shouldVersion,
  recencyScore,
  type Lifecycle,
  type Role,
  type TrendType,
  type SourceStatus,
} from "./knowledge-logic";

const nid = () => randomUUID();

export interface Knowledge {
  id: string;
  role: Role;
  platform: string;
  content_type: string;
  category: string;
  pattern: string;
  description: string;
  why: string;
  action: string;
  source: string;
  source_status: SourceStatus;
  evidence_count: number;
  success_count: number;
  fail_count: number;
  confidence: number;
  learning_value: number;
  longevity: number;
  transferability: number;
  reproducibility: number;
  weight: number;
  lifecycle: Lifecycle;
  trend_type: TrendType;
  knowledge_type: string;
  knowledge_origin: string;
  evidence_level: string;
  scope: Record<string, unknown>;
  applies_when: string;
  not_applies_when: string;
  failure_mode: string;
  first_seen: string | null;
  last_seen: string | null;
  discovered_at: string;
  last_validated_at: string | null;
  last_signal_at: string | null;
  version: number;
  parent_knowledge_id: string | null;
  notes: string;
  is_deprecated: boolean;
  created_at: string;
  updated_at: string;
}

const K_COLS =
  "id, role, platform, content_type, category, pattern, description, why, action, source, source_status, evidence_count, success_count, fail_count, confidence, learning_value, longevity, transferability, reproducibility, weight, lifecycle, trend_type, knowledge_type, knowledge_origin, evidence_level, scope, applies_when, not_applies_when, failure_mode, first_seen, last_seen, discovered_at, last_validated_at, last_signal_at, version, parent_knowledge_id, notes, is_deprecated, created_at, updated_at";

function mapKnowledge(r: Record<string, any>): Knowledge {
  return {
    id: r.id, role: r.role, platform: r.platform, content_type: r.content_type,
    category: r.category, pattern: r.pattern, description: r.description, why: r.why,
    action: r.action, source: r.source, source_status: r.source_status,
    evidence_count: Number(r.evidence_count), success_count: Number(r.success_count),
    fail_count: Number(r.fail_count), confidence: Number(r.confidence),
    learning_value: Number(r.learning_value), longevity: Number(r.longevity),
    transferability: Number(r.transferability), reproducibility: Number(r.reproducibility),
    weight: Number(r.weight), lifecycle: r.lifecycle, trend_type: r.trend_type,
    knowledge_type: r.knowledge_type ?? "PATTERN", knowledge_origin: r.knowledge_origin ?? "LEARNED",
    evidence_level: r.evidence_level ?? "LEVEL_1",
    scope: typeof r.scope === "object" && r.scope ? r.scope : {},
    applies_when: r.applies_when ?? "", not_applies_when: r.not_applies_when ?? "",
    failure_mode: r.failure_mode ?? "",
    first_seen: r.first_seen, last_seen: r.last_seen, discovered_at: r.discovered_at,
    last_validated_at: r.last_validated_at, last_signal_at: r.last_signal_at,
    version: Number(r.version), parent_knowledge_id: r.parent_knowledge_id,
    notes: r.notes, is_deprecated: !!r.is_deprecated,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

export async function getKnowledge(id: string): Promise<Knowledge | null> {
  if (!hasDatabase()) return null;
  const rows = await q<Record<string, any>>(`SELECT ${K_COLS} FROM knowledge WHERE id = $1`, [id]);
  return rows[0] ? mapKnowledge(rows[0]) : null;
}

/** 查同角色、同 pattern 的已有知识（用于去重：命中则强化，不命中则新建）。 */
export async function findKnowledgeByPattern(role: Role, pattern: string): Promise<Knowledge | null> {
  if (!hasDatabase()) return null;
  const rows = await q<Record<string, any>>(
    `SELECT ${K_COLS} FROM knowledge WHERE role = $1 AND pattern = $2 LIMIT 1`,
    [role, pattern]
  );
  return rows[0] ? mapKnowledge(rows[0]) : null;
}

export interface CreateKnowledgeInput {
  role: Role;
  pattern: string;
  description?: string;
  why?: string;
  action?: string;
  platform?: string;
  content_type?: string;
  category?: string;
  source?: string;
  source_status?: SourceStatus;
  trend_type?: TrendType;
  knowledge_type?: string;
  knowledge_origin?: string;
  evidence_level?: string;
  scope?: Record<string, unknown>;
  applies_when?: string;
  not_applies_when?: string;
  failure_mode?: string;
  confidence?: number;
  weight?: number;
  lifecycle?: Lifecycle;
  longevity?: number;
  transferability?: number;
  reproducibility?: number;
  notes?: string;
  parent_knowledge_id?: string | null;
}

/** 新建一条知识：初始 lifecycle = NEW，weight = 50，并写入 v1 版本。 */
export async function createKnowledge(input: CreateKnowledgeInput): Promise<Knowledge | null> {
  if (!hasDatabase()) return null;
  const id = nid();
  const trend = input.trend_type ?? "LONG_TERM";
  const longevity = input.longevity ?? (trend === "MEME" || trend === "SHORT_TERM" ? 20 : trend === "MID_TERM" ? 45 : 70);
  const transferability = input.transferability ?? 50;
  const reproducibility = input.reproducibility ?? 40;
  const lvs = learningValueScore({
    evidence: 20, recency: recencyScore(0), confidence: 20, longevity,
    transferability, reproducibility, contradiction: 0,
    platformRelevance: 50, categoryRelevance: 50, userOutcome: 0,
  });
  const lifecycle: Lifecycle = input.lifecycle ?? "NEW";
  const confidence = input.confidence ?? 20;
  const weight = input.weight ?? 50;
  await q(
    `INSERT INTO knowledge (id, role, platform, content_type, category, pattern, description, why, action,
      source, source_status, evidence_count, success_count, fail_count, confidence, learning_value,
      longevity, transferability, reproducibility, weight, lifecycle, trend_type, first_seen, last_seen,
      last_validated_at, last_signal_at, version, parent_knowledge_id, notes, is_deprecated,
      knowledge_type, knowledge_origin, evidence_level, scope, applies_when, not_applies_when, failure_mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,now(),now(),now(),now(),1,$23,$24,false,$25,$26,$27,$28,$29,$30,$31)`,
    [
      id, input.role, input.platform ?? "", input.content_type ?? "", input.category ?? "",
      input.pattern, input.description ?? "", input.why ?? "", input.action ?? "",
      input.source ?? "", input.source_status ?? "OK", 0, 0, 0, confidence, lvs,
      longevity, transferability, reproducibility, weight, lifecycle, trend,
      input.parent_knowledge_id ?? null, input.notes ?? "",
      input.knowledge_type ?? "PATTERN", input.knowledge_origin ?? "LEARNED",
      input.evidence_level ?? "LEVEL_1", JSON.stringify(input.scope ?? {}),
      input.applies_when ?? "", input.not_applies_when ?? "", input.failure_mode ?? "",
    ]
  );
  await q(
    `INSERT INTO knowledge_version (id, knowledge_id, version, weight, lifecycle, learning_value, confidence, evidence_count, reason, evidence, changed_by)
     VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [nid(), id, weight, lifecycle, lvs, confidence, 0, "初始创建", input.source ?? "", "system"]
  );
  return getKnowledge(id);
}

/** 记录一条观察（知识从哪来、由谁发现、有没有反例）。dedupe_hash 唯一，避免重复学习。 */
export async function recordObservation(input: {
  source: string;
  source_status: SourceStatus;
  platform: string;
  sample_id: string;
  role: string;
  observed_signal: string;
  extracted_pattern: string;
  extracted_knowledge_id?: string | null;
  evidence_strength?: number;
  polarity?: "positive" | "negative" | "uncertain";
  counter_example?: string;
  dedupe_hash?: string;
}): Promise<string | null> {
  if (!hasDatabase()) return null;
  const id = nid();
  try {
    await q(
      `INSERT INTO learning_observation (id, source, source_status, platform, sample_id, role,
        observed_signal, extracted_pattern, extracted_knowledge_id, evidence_strength, polarity,
        counter_example, is_candidate, dedupe_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13)
       ON CONFLICT (dedupe_hash) DO NOTHING`,
      [
        id, input.source, input.source_status, input.platform, input.sample_id, input.role,
        input.observed_signal, input.extracted_pattern, input.extracted_knowledge_id ?? null,
        input.evidence_strength ?? 0, input.polarity ?? "positive", input.counter_example ?? "",
        input.dedupe_hash ?? null,
      ]
    );
    return id;
  } catch (e) {
    console.warn("[knowledge] recordObservation 失败：", e);
    return null;
  }
}

export interface KnowledgeUpdateMeta {
  reason: string;
  evidence: string;
  changed_by: string;
}

/** 集中式写权重变化：更新 knowledge + 写 version（如需）+ 写 role_weight_log。 */
export async function applyKnowledgeUpdate(
  id: string,
  patch: {
    weight: number;
    confidence: number;
    learning_value: number;
    lifecycle: Lifecycle;
    evidence_count?: number;
    success_count?: number;
    fail_count?: number;
    trend_type?: TrendType;
    is_deprecated?: boolean;
  },
  meta: KnowledgeUpdateMeta
): Promise<Knowledge | null> {
  if (!hasDatabase()) return null;
  const cur = await getKnowledge(id);
  if (!cur) return null;

  const prev = {
    weight: cur.weight,
    lifecycle: cur.lifecycle,
    confidence: cur.confidence,
    version: cur.version,
  };
  const next = {
    weight: patch.weight,
    lifecycle: patch.lifecycle,
    confidence: patch.confidence,
  };
  const needsVersion = shouldVersion(prev, next);
  const newVersion = needsVersion ? prev.version + 1 : prev.version;

  if (needsVersion) {
    await q(
      `INSERT INTO knowledge_version (id, knowledge_id, version, weight, lifecycle, learning_value, confidence, evidence_count, reason, evidence, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [nid(), id, newVersion, patch.weight, patch.lifecycle, patch.learning_value,
       patch.confidence, patch.evidence_count ?? cur.evidence_count, meta.reason, meta.evidence, meta.changed_by]
    );
  }
  await q(
    `INSERT INTO role_weight_log (id, knowledge_id, old_weight, new_weight, reason, evidence, changed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [nid(), id, cur.weight, patch.weight, meta.reason, meta.evidence, meta.changed_by]
  );
  await q(
    `UPDATE knowledge SET weight=$2, confidence=$3, learning_value=$4, lifecycle=$5,
      evidence_count=$6, success_count=$7, fail_count=$8, trend_type=$9,
      is_deprecated=$10, version=$11, last_validated_at=now(), last_signal_at=now(), updated_at=now()
     WHERE id=$1`,
    [
      id, patch.weight, patch.confidence, patch.learning_value, patch.lifecycle,
      patch.evidence_count ?? cur.evidence_count, patch.success_count ?? cur.success_count,
      patch.fail_count ?? cur.fail_count, patch.trend_type ?? cur.trend_type,
      patch.is_deprecated ?? cur.is_deprecated, newVersion,
    ]
  );
  return getKnowledge(id);
}

/** 强化：新增正面证据 → 重新计算权重 / 生命周期 / 版本。 */
export async function reinforceKnowledge(
  id: string,
  opts: { source?: string; evidence_note?: string; changed_by?: string }
): Promise<Knowledge | null> {
  const cur = await getKnowledge(id);
  if (!cur) return null;
  const evidenceCount = cur.evidence_count + 1;
  const successCount = cur.success_count + 1;
  const weight = computeWeight({
    currentWeight: cur.weight, evidenceCount, successCount, failCount: cur.fail_count,
    confidence: cur.confidence, learningValue: cur.learning_value,
    transferability: cur.transferability, recentSignalDays: 0,
  });
  const newLvs = learningValueScore({
    evidence: Math.min(100, evidenceCount * 20), recency: 100, confidence: cur.confidence,
    longevity: cur.longevity, transferability: cur.transferability,
    reproducibility: cur.reproducibility, contradiction: cur.fail_count * 5,
    platformRelevance: cur.platform ? 70 : 40, categoryRelevance: cur.category ? 70 : 40,
    userOutcome: 60,
  });
  const lifecycle = nextLifecycle({
    current: cur.lifecycle, weight, confidence: cur.confidence, evidenceCount, recentSignalDays: 0,
  });
  return applyKnowledgeUpdate(id, {
    weight, confidence: Math.min(100, cur.confidence + 2), learning_value: newLvs,
    lifecycle, evidence_count: evidenceCount, success_count: successCount,
  }, {
    reason: "强化：新增正面观察",
    evidence: opts.evidence_note || opts.source || "新增样本支持",
    changed_by: opts.changed_by || "system",
  });
}

/** 反例：加入一个反例 → 置信度与权重必须下降（而不是继续增加）。 */
export async function addCounterExample(
  id: string,
  opts: { counter_example?: string; severity?: number; changed_by?: string }
): Promise<Knowledge | null> {
  const cur = await getKnowledge(id);
  if (!cur) return null;
  const { weight, confidence } = applyCounterExample(cur.weight, cur.confidence, opts.severity ?? 1);
  const failCount = cur.fail_count + 1;
  const lifecycle = nextLifecycle({
    current: cur.lifecycle, weight, confidence, evidenceCount: cur.evidence_count,
    recentSignalDays: 0,
  });
  const newLvs = learningValueScore({
    evidence: Math.min(100, cur.evidence_count * 20), recency: 100, confidence,
    longevity: cur.longevity, transferability: cur.transferability,
    reproducibility: cur.reproducibility, contradiction: failCount * 10,
    platformRelevance: 40, categoryRelevance: 40, userOutcome: 10,
  });
  return applyKnowledgeUpdate(id, {
    weight, confidence, learning_value: newLvs, lifecycle,
    evidence_count: cur.evidence_count, success_count: cur.success_count, fail_count: failCount,
  }, {
    reason: "反例：出现不适用/失效证据",
    evidence: opts.counter_example || "出现反例",
    changed_by: opts.changed_by || "system",
  });
}

/** 过期：进入 DEPRECATED，不删除数据，写版本。 */
export async function deprecateKnowledge(
  id: string,
  opts: { reason?: string; changed_by?: string }
): Promise<Knowledge | null> {
  const cur = await getKnowledge(id);
  if (!cur) return null;
  return applyKnowledgeUpdate(id, {
    weight: Math.min(cur.weight, 20), confidence: Math.min(cur.confidence, 20),
    learning_value: cur.learning_value, lifecycle: "DEPRECATED", is_deprecated: true,
  }, {
    reason: opts.reason || "进入 DEPRECATED",
    evidence: "长期未验证 / 已过时",
    changed_by: opts.changed_by || "system",
  });
}

/** 回滚：读回某版本，把 weight / lifecycle / confidence / learning_value / evidence_count 恢复到 knowledge。 */
export async function rollbackKnowledge(id: string, targetVersion: number): Promise<Knowledge | null> {
  if (!hasDatabase()) return null;
  const cur = await getKnowledge(id);
  if (!cur) return null;
  const rows = await q<Record<string, any>>(
    `SELECT weight, lifecycle, learning_value, confidence, evidence_count FROM knowledge_version
     WHERE knowledge_id=$1 AND version=$2 LIMIT 1`,
    [id, targetVersion]
  );
  if (!rows[0]) return null;
  const v = rows[0];
  await q(
    `INSERT INTO knowledge_version (id, knowledge_id, version, weight, lifecycle, learning_value, confidence, evidence_count, reason, evidence, changed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [nid(), id, cur.version + 1, Number(v.weight), v.lifecycle, Number(v.learning_value),
     Number(v.confidence), Number(v.evidence_count), "回滚", `回滚到 version ${targetVersion}`, "system"]
  );
  await q(
    `INSERT INTO role_weight_log (id, knowledge_id, old_weight, new_weight, reason, evidence, changed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [nid(), id, cur.weight, Number(v.weight), "回滚", `回滚到 version ${targetVersion}`, "system"]
  );
  await q(
    `UPDATE knowledge SET weight=$2, lifecycle=$3, learning_value=$4, confidence=$5,
      evidence_count=$6, is_deprecated=$7, version=$8, updated_at=now() WHERE id=$1`,
    [id, Number(v.weight), v.lifecycle, Number(v.learning_value), Number(v.confidence),
     Number(v.evidence_count), v.lifecycle === "DEPRECATED", cur.version + 1]
  );
  return getKnowledge(id);
}

export interface RecallOpts {
  platform?: string;
  content_type?: string;
  limit?: number;
  maxTokens?: number;
}

/** 召回：只取 ACTIVE / TESTING、未 DEPRECATED 的知识，按 role 加权分排序。 */
export async function recallKnowledge(role: Role | "ALL", opts: RecallOpts = {}): Promise<Knowledge[]> {
  if (!hasDatabase()) return [];
  const params: unknown[] = [];
  let where = "is_deprecated = false AND lifecycle IN ('ACTIVE','TESTING')";
  if (role !== "ALL") {
    params.push(role);
    where += ` AND role = $${params.length}`;
  }
  if (opts.platform) {
    params.push(opts.platform);
    where += ` AND (platform = $${params.length} OR platform = '')`;
  }
  if (opts.content_type) {
    params.push(opts.content_type);
    where += ` AND (content_type = $${params.length} OR content_type = '')`;
  }
  const limit = Math.min(Math.max(opts.limit ?? 6, 1), 50);
  params.push(limit);
  const rows = await q<Record<string, any>>(
    `SELECT ${K_COLS} FROM knowledge WHERE ${where}
     ORDER BY (weight * 0.6 + learning_value * 0.4) DESC LIMIT $${params.length}`,
    params
  );
  const out = rows.map(mapKnowledge);
  // scope 后过滤（防跨平台/跨内容污染）：若知识声明了 scope.platform / scope.content_type 且与请求不符，则排除。
  if (opts.platform || opts.content_type) {
    return out.filter((k) => {
      const s = k.scope as { platform?: string; content_type?: string };
      if (opts.platform && s.platform && s.platform !== opts.platform) return false;
      if (opts.content_type && s.content_type && s.content_type !== opts.content_type) return false;
      return true;
    });
  }
  return out;
}

export async function listKnowledge(opts: {
  role?: Role;
  lifecycle?: Lifecycle;
  limit?: number;
}): Promise<Knowledge[]> {
  if (!hasDatabase()) return [];
  const params: unknown[] = [];
  let where = "1=1";
  if (opts.role) { params.push(opts.role); where += ` AND role = $${params.length}`; }
  if (opts.lifecycle) { params.push(opts.lifecycle); where += ` AND lifecycle = $${params.length}`; }
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  params.push(limit);
  const rows = await q<Record<string, any>>(
    `SELECT ${K_COLS} FROM knowledge WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length}`,
    params
  );
  return rows.map(mapKnowledge);
}

/** 版本历史（用于审计 / 回滚）。 */
export async function knowledgeVersions(id: string): Promise<Record<string, any>[]> {
  if (!hasDatabase()) return [];
  return q<Record<string, any>>(
    `SELECT version, weight, lifecycle, learning_value, confidence, evidence_count, reason, created_at
     FROM knowledge_version WHERE knowledge_id=$1 ORDER BY version DESC`,
    [id]
  );
}
