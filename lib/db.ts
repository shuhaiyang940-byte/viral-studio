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
-- 旧库兼容：engagement_rate 从 INTEGER 升级为 DOUBLE PRECISION（种子数据为 6.4~11.2 的百分数）
ALTER TABLE benchmarks ALTER COLUMN engagement_rate TYPE DOUBLE PRECISION;
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
