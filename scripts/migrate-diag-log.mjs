// 在生产 Neon 建 diagnosis_upload_logs 表并验证读写连通。
// 前置：vercel env pull --environment=production .env.prod.selfcheck
import fs from "node:fs";
process.loadEnvFile(new URL("../.env.prod.selfcheck", import.meta.url));
const { neon } = await import("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

await sql`CREATE TABLE IF NOT EXISTS diagnosis_upload_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  step TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  ok BOOLEAN,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS idx_diag_log_session ON diagnosis_upload_logs(session_id, created_at DESC)`;

// 写入一条自检日志再删除，验证读写链路
await sql.query(`DELETE FROM diagnosis_upload_logs WHERE step = 'selfcheck'`);
await sql.query(
  `INSERT INTO diagnosis_upload_logs (session_id, file_name, file_size, step, detail, ok)
   VALUES ($1, $2, $3, 'selfcheck', 'migrate 自检', true)`,
  ["selfcheck", "联动验证.txt", 12]
);
const sel = await sql.query(
  `SELECT id, step, detail FROM diagnosis_upload_logs WHERE session_id = $1 LIMIT 5`,
  ["selfcheck"]
);
console.log("[OK] 建表 + 读写连通。自检行:", JSON.stringify(sel[0]));
await sql.query(`DELETE FROM diagnosis_upload_logs WHERE session_id = $1`, ["selfcheck"]);
console.log("[OK] 自检日志已清理");
