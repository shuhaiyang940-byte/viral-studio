import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * 说明：这里直接用 neon 的原生 SQL 客户端（不是 ORM）。
 * 泛型必须写死 <false, false>，否则 ReturnType<typeof neon> 会退化成
 * NeonQueryFunction<boolean, boolean>，返回值变成联合类型（连 .length 都取不到）。
 */
type Sql = NeonQueryFunction<false, false>;

let _sql: Sql | null = null;
let _schemaReady: Promise<void> | null = null;

/** 是否配置了数据库（未配置时页面/接口应优雅降级，而不是崩溃） */
export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 未配置（请在 .env.local 或 Vercel 环境变量中设置）");
  if (!_sql) {
    // 本地开发/联调可把 SQL 打到本地 Neon 代理（或自建 Postgres 的 neon-proxy）。
    // 线上留空即可，走 Neon 官方 https 端点。
    if (process.env.NEON_FETCH_ENDPOINT) {
      neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
    }
    _sql = neon(url);
  }
  return _sql;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  phone TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '全部',
  cover TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  is_seed BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS case_saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, case_id)
);
CREATE TABLE IF NOT EXISTS benchmarks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '抖音',
  idea_type TEXT NOT NULL DEFAULT 'other',
  styles JSONB NOT NULL DEFAULT '[]',
  effects JSONB NOT NULL DEFAULT '[]',
  face BOOLEAN NOT NULL DEFAULT true,
  product_type TEXT,
  followers INTEGER NOT NULL DEFAULT 0,
  engagement_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  sample_title TEXT NOT NULL DEFAULT '',
  is_seed BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS benchmark_tracks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id TEXT NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, benchmark_id)
);
CREATE TABLE IF NOT EXISTS ip_blocklist (
  ip TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quota_usage (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  quota_type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  action TEXT NOT NULL,
  status TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category);
CREATE INDEX IF NOT EXISTS idx_benchmarks_platform ON benchmarks(platform);
CREATE INDEX IF NOT EXISTS idx_benchmarks_ideatype ON benchmarks(idea_type);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tokens_type ON email_tokens(type);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  parent_asset_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_user_type ON assets(user_id, type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_parent ON assets(parent_asset_id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_asset_id TEXT;
CREATE TABLE IF NOT EXISTS gen_dedupe (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'processing',
  asset_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  event TEXT NOT NULL,
  asset_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
-- 旧库兼容：engagement_rate 从 INTEGER 升级为 DOUBLE PRECISION（种子数据为 6.4~11.2 的百分数）
ALTER TABLE benchmarks ALTER COLUMN engagement_rate TYPE DOUBLE PRECISION;

-- ═══ Phase 15-B：知识底座 + 真实学习基础设施 ═══
-- 每条「知识」属于某一个专业角色（DIRECTOR / PRODUCER / OPERATOR / EDITOR / COMMON）。
-- 生命周期：NEW → TESTING → ACTIVE → WEAKENING → DEPRECATED；可旁路 REJECTED。
-- DEPRECATED 不代表删除：历史必须保留，将来可能重新有效。
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'COMMON' CHECK (role IN ('DIRECTOR','PRODUCER','OPERATOR','EDITOR','AUDIENCE','COMMON')),
  platform TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  pattern TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  source_status TEXT NOT NULL DEFAULT 'OK' CHECK (source_status IN ('OK','PARTIAL','SOURCE_UNAVAILABLE','NO_DATA','DEMO')),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  learning_value REAL NOT NULL DEFAULT 0,
  longevity REAL NOT NULL DEFAULT 0,
  transferability REAL NOT NULL DEFAULT 0,
  reproducibility REAL NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 50,
  lifecycle TEXT NOT NULL DEFAULT 'NEW' CHECK (lifecycle IN ('NEW','TESTING','ACTIVE','WEAKENING','DEPRECATED','REJECTED')),
  trend_type TEXT NOT NULL DEFAULT 'LONG_TERM' CHECK (trend_type IN ('LONG_TERM','MID_TERM','SHORT_TERM','MEME')),
  applicability TEXT NOT NULL DEFAULT '{}',
  knowledge_type TEXT NOT NULL DEFAULT 'PATTERN' CHECK (knowledge_type IN ('PRINCIPLE','PATTERN','TECHNIQUE','CASE','COUNTER_EXAMPLE','FAILURE_MODE','CONSTRAINT','HEURISTIC','TREND','PLATFORM_RULE','PRODUCTION_RULE','AUDIENCE_SIGNAL')),
  knowledge_origin TEXT NOT NULL DEFAULT 'LEARNED' CHECK (knowledge_origin IN ('SYSTEM_DEFINED','LEARNED','OBSERVED','USER_PROVIDED','EXTERNAL_SOURCE','EXPERIMENTAL')),
  evidence_level TEXT NOT NULL DEFAULT 'LEVEL_1' CHECK (evidence_level IN ('LEVEL_0','LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5')),
  scope JSONB NOT NULL DEFAULT '{}',
  applies_when TEXT NOT NULL DEFAULT '',
  not_applies_when TEXT NOT NULL DEFAULT '',
  failure_mode TEXT NOT NULL DEFAULT '',
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_validated_at TIMESTAMPTZ,
  last_signal_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  parent_knowledge_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  is_deprecated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_role ON knowledge(role);
CREATE INDEX IF NOT EXISTS idx_knowledge_lifecycle ON knowledge(lifecycle);
CREATE INDEX IF NOT EXISTS idx_knowledge_platform ON knowledge(platform);
CREATE INDEX IF NOT EXISTS idx_knowledge_content_type ON knowledge(content_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_live ON knowledge(lifecycle, weight DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_pattern ON knowledge(role, pattern) WHERE pattern <> '';

-- 知识版本：权重 / 生命周期 / 置信度等任何重要变化都留痕，可回滚。
CREATE TABLE IF NOT EXISTS knowledge_version (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  weight REAL NOT NULL,
  lifecycle TEXT NOT NULL,
  learning_value REAL NOT NULL,
  confidence REAL NOT NULL,
  evidence_count INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (knowledge_id, version)
);
CREATE INDEX IF NOT EXISTS idx_kv_knowledge ON knowledge_version(knowledge_id, version DESC);

-- 每一次学习行为都留一条观察：这道知识来自哪、由哪个角色发现、有没有反例。
CREATE TABLE IF NOT EXISTS learning_observation (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT '',
  source_status TEXT NOT NULL DEFAULT 'OK' CHECK (source_status IN ('OK','PARTIAL','SOURCE_UNAVAILABLE','NO_DATA','DEMO')),
  platform TEXT NOT NULL DEFAULT '',
  sample_id TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  observed_signal TEXT NOT NULL DEFAULT '',
  extracted_pattern TEXT NOT NULL DEFAULT '',
  extracted_knowledge_id TEXT,
  evidence_strength REAL NOT NULL DEFAULT 0,
  polarity TEXT NOT NULL DEFAULT 'positive' CHECK (polarity IN ('positive','negative','uncertain')),
  counter_example TEXT NOT NULL DEFAULT '',
  is_candidate BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedupe_hash TEXT,
  UNIQUE (dedupe_hash)
);
CREATE INDEX IF NOT EXISTS idx_obs_role ON learning_observation(role);
CREATE INDEX IF NOT EXISTS idx_obs_source ON learning_observation(source);

-- 每日学习任务：预算 / 幂等 / 失败恢复，与用户生成任务彻底隔离。
CREATE TABLE IF NOT EXISTS learning_job (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IDLE' CHECK (status IN ('IDLE','RUNNING','PAUSED','FAILED','DONE')),
  samples INTEGER NOT NULL DEFAULT 0,
  valid INTEGER NOT NULL DEFAULT 0,
  added INTEGER NOT NULL DEFAULT 0,
  reinforced INTEGER NOT NULL DEFAULT 0,
  downgraded INTEGER NOT NULL DEFAULT 0,
  deprecated INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  budget_ai_calls INTEGER NOT NULL DEFAULT 0,
  used_ai_calls INTEGER NOT NULL DEFAULT 0,
  max_items INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  attempt INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_date, idempotency_key)
);

-- 权重变更日志：回答「这条知识为什么从 62 变成 81」。
CREATE TABLE IF NOT EXISTS role_weight_log (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  old_weight REAL NOT NULL,
  new_weight REAL NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rwl_knowledge ON role_weight_log(knowledge_id, created_at DESC);

-- 全部 AI 调用的真实 token 用量（含学习任务与用户任务）。
-- 仅当模型 API 返回 usage 才写 token；拿不到就写 status，绝不自己估算。
CREATE TABLE IF NOT EXISTS ai_usage (
  id BIGSERIAL PRIMARY KEY,
  task TEXT NOT NULL DEFAULT '',
  engine TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  endpoint TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost REAL,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_task ON ai_usage(task);

-- ═══ Phase 16：五人创作团队（dynamic role team）═══
-- 幂等：旧库 knowledge.role 补上 AUDIENCE（仅当约束名存在时 drop/re-add）。
-- 约束名为建表时自动生成（knowledge_role_check）。
ALTER TABLE knowledge DROP CONSTRAINT IF EXISTS knowledge_role_check;
ALTER TABLE knowledge ADD CONSTRAINT knowledge_role_check CHECK (role IN ('DIRECTOR','PRODUCER','OPERATOR','EDITOR','AUDIENCE','COMMON'));

-- 一次「创作任务」的运行与审计根记录。
CREATE TABLE IF NOT EXISTS creative_task (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  user_goal TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','activated','judged','arbitrated','intent','done','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_creative_task_created ON creative_task(created_at);

-- 角色激活结果（用了哪些 / 没调用哪些 / 权重 / 原因）。
CREATE TABLE IF NOT EXISTS role_activation (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES creative_task(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('required','optional','inactive')),
  weight REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_act_task ON role_activation(task_id);

-- 每个角色的结构化判断。
CREATE TABLE IF NOT EXISTS role_judgment (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES creative_task(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  conclusion TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  risks JSONB NOT NULL DEFAULT '[]',
  objections JSONB NOT NULL DEFAULT '[]',
  must_have JSONB NOT NULL DEFAULT '[]',
  should_have JSONB NOT NULL DEFAULT '[]',
  avoid JSONB NOT NULL DEFAULT '[]',
  questions JSONB NOT NULL DEFAULT '[]',
  knowledge_ids JSONB NOT NULL DEFAULT '[]',
  evidence_source TEXT NOT NULL DEFAULT 'fact',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_judge_task ON role_judgment(task_id);

-- 角色间的真实冲突。
CREATE TABLE IF NOT EXISTS creative_conflict (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES creative_task(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL DEFAULT '',
  roles JSONB NOT NULL DEFAULT '[]',
  evidence JSONB NOT NULL DEFAULT '[]',
  severity REAL NOT NULL DEFAULT 0,
  resolution TEXT NOT NULL DEFAULT '',
  winner TEXT,
  reason TEXT NOT NULL DEFAULT '',
  unresolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conflict_task ON creative_conflict(task_id);

-- 团队最终形成的 Creative Intent（单一产物，真正进入创作链）。
CREATE TABLE IF NOT EXISTS creative_intent (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES creative_task(id) ON DELETE CASCADE,
  goal TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  core_message TEXT NOT NULL DEFAULT '',
  narrative_intent TEXT NOT NULL DEFAULT '',
  market_intent TEXT NOT NULL DEFAULT '',
  execution_intent TEXT NOT NULL DEFAULT '',
  editing_intent TEXT NOT NULL DEFAULT '',
  audience_intent TEXT NOT NULL DEFAULT '',
  priority_rules JSONB NOT NULL DEFAULT '[]',
  hard_constraints JSONB NOT NULL DEFAULT '[]',
  soft_constraints JSONB NOT NULL DEFAULT '[]',
  risks JSONB NOT NULL DEFAULT '[]',
  unresolved_questions JSONB NOT NULL DEFAULT '[]',
  activated_roles JSONB NOT NULL DEFAULT '[]',
  role_weights JSONB NOT NULL DEFAULT '{}',
  evidence_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intent_task ON creative_intent(task_id);

-- 团队最终决策记录（用于回答「为什么系统建议这样做」）。
CREATE TABLE IF NOT EXISTS creative_decision (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES creative_task(id) ON DELETE CASCADE,
  final_decision TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  activated_roles JSONB NOT NULL DEFAULT '[]',
  role_weights JSONB NOT NULL DEFAULT '{}',
  conflicts JSONB NOT NULL DEFAULT '[]',
  knowledge_used JSONB NOT NULL DEFAULT '[]',
  creative_intent_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decision_task ON creative_decision(task_id);

-- 角色知识之间的关系（谁与谁协同/冲突），Phase 15-B 的 role_weight_log 已记录单条升降权。
CREATE TABLE IF NOT EXISTS role_knowledge_relation (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  other_knowledge_id TEXT,
  relation TEXT NOT NULL DEFAULT 'agree' CHECK (relation IN ('agree','conflict','independent')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rkr_knowledge ON role_knowledge_relation(knowledge_id);

-- ═══ Phase 16.10-P1：账号定位档案（策略顾问的地基）═══
-- 用户级：人设 / 资源 / 时机 / 已有数据 / 平台 / 人群 / 复盘沉淀。
CREATE TABLE IF NOT EXISTS persona_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  persona_tags TEXT NOT NULL DEFAULT '[]',
  resources TEXT NOT NULL DEFAULT '[]',
  timing TEXT NOT NULL DEFAULT '',
  account_data TEXT NOT NULL DEFAULT '{}',
  platform TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  learnings TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_persona_user ON persona_cards(user_id);

-- ═══ Phase 16.6：知识分类 / 来源 / 可信度 / scope（幂等兼容字段，仅追加不改结构）═══
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS knowledge_type TEXT NOT NULL DEFAULT 'PATTERN';
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS knowledge_origin TEXT NOT NULL DEFAULT 'LEARNED';
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS evidence_level TEXT NOT NULL DEFAULT 'LEVEL_1';
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}';
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS applies_when TEXT NOT NULL DEFAULT '';
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS not_applies_when TEXT NOT NULL DEFAULT '';
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS failure_mode TEXT NOT NULL DEFAULT '';
`;

/**
 * 带占位符（$1/$2...）的参数化查询。
 * 注意：不要用 sql.unsafe() 来跑查询——它只是「原样插值标记」，不会发请求。
 */
export async function q<T = Record<string, any>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const sql = getSql();
  const rows = await sql.query(text, params as any[]);
  return rows as unknown as T[];
}

/** 幂等建表：多次调用安全（IF NOT EXISTS）。缓存单次执行结果。 */
export function ensureSchema(): Promise<void> {
  if (!_schemaReady) {
    _schemaReady = (async () => {
      const sql = getSql();
      // Neon HTTP 单次请求只允许一条语句，必须逐条执行
      const statements = SCHEMA_SQL.split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await sql.query(stmt);
      }
    })().catch((e) => {
      _schemaReady = null;
      throw e;
    });
  }
  return _schemaReady;
}
