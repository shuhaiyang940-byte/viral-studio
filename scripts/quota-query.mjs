// 查询生产配额消费与最近分析日志，定位"额度用完"原因。
import fs from "node:fs";
process.loadEnvFile(new URL("../.env.prod.selfcheck", import.meta.url));
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

console.log("=== 1. quota_usage 中 analyze 相关（今日/近期）===");
const q = await sql.query(
  `SELECT key, count, day FROM quota_usage WHERE key LIKE 'analyze:%' ORDER BY day DESC, count DESC LIMIT 20`
);
for (const r of q) console.log(`  ${r.key}  count=${r.count}  day=${r.day}`);

console.log("\n=== 2. usage_logs 最近 12 条 ===");
try {
  const ul = await sql.query(
    `SELECT id, user_id, quota_type, amount, action, status, request_id, created_at FROM usage_logs ORDER BY id DESC LIMIT 12`
  );
  for (const r of ul) console.log(`  #${r.id} user=${r.user_id} type=${r.quota_type} amt=${r.amount} action=${r.action} status=${r.status} req=${r.request_id} ${r.created_at}`);
} catch (e) {
  console.log("  (usage_logs 查询异常)", e.message);
}

console.log("\n=== 3. 最新 diagnosis_upload_logs 里 analyze 相关步骤 ===");
const al = await sql.query(
  `SELECT id, session_id, file_name, step, detail, ok, created_at FROM diagnosis_upload_logs WHERE step LIKE 'analyze%' OR step='blob_upload_done' ORDER BY id DESC LIMIT 15`
);
for (const r of al) console.log(`  #${r.id} ${r.step} ok=${r.ok === null ? "-" : r.ok} ${(r.file_name || "").slice(0, 26)} ${(r.detail || "").slice(0, 60)} ${r.created_at}`);
