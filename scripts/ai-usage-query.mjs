// 查询生产 AI 调用记录（Qwen/DeepSeek token 用量、status、error）与视频分析消费。
import fs from "node:fs";
process.loadEnvFile(new URL("../.env.prod.selfcheck", import.meta.url));
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

console.log("=== 1. ai_usage 最近 20 条（含真实错误/用量）===");
try {
  const rows = await sql.query(
    `SELECT id, task, engine, model, endpoint, input_tokens, output_tokens, total_tokens, estimated_cost, status, error, created_at
     FROM ai_usage ORDER BY id DESC LIMIT 20`
  );
  for (const r of rows) {
    console.log(
      `  #${r.id} task=${r.task} engine=${r.engine} model=${r.model} in=${r.input_tokens} out=${r.output_tokens} total=${r.total_tokens} cost=${r.estimated_cost} status=${r.status} ${(r.error || "").slice(0, 110)} ${r.created_at}`
    );
  }
} catch (e) {
  console.log("  (ai_usage 查询异常)", e.message);
}

console.log("\n=== 2. usage_logs 最近 15 条（视频分析 consume/refund）===");
try {
  const rows = await sql.query(
    `SELECT id, user_id, quota_type, amount, action, status, request_id, error, created_at FROM usage_logs ORDER BY id DESC LIMIT 15`
  );
  for (const r of rows) {
    console.log(`  #${r.id} type=${r.quota_type} amt=${r.amount} action=${r.action} status=${r.status} req=${r.request_id} ${(r.error || "").slice(0, 60)} ${r.created_at}`);
  }
} catch (e) {
  console.log("  (usage_logs 查询异常)", e.message);
}
