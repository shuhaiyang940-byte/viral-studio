// 查询生产 diagnosis_upload_logs，按 session 分组的最近动作，定位上传卡在哪一步。
import fs from "node:fs";
process.loadEnvFile(new URL("../.env.prod.selfcheck", import.meta.url));
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const rows = await sql.query(
  `SELECT id, session_id, file_name, file_size, step, detail, ok, created_at
   FROM diagnosis_upload_logs
   ORDER BY id DESC
   LIMIT 120`
);

if (!rows.length) {
  console.log("（无日志）");
  process.exit(0);
}

// 按 session 排序打印（日志倒序取回，这里正序查看每个 session 的时序）
const bySession = {};
for (const r of rows) {
  if (!bySession[r.session_id]) bySession[r.session_id] = [];
  bySession[r.session_id].push(r);
}

let idx = 0;
for (const [sid, list] of Object.entries(bySession)) {
  console.log(`\n═══ session ${sid}（${list.length} 条）═══`);
  for (const r of list.reverse()) {
    console.log(
      `  ${new Date(r.created_at).toLocaleTimeString("zh-CN")}  ${r.step.padEnd(22)} ok=${r.ok === null ? "-" : r.ok}  ${(r.file_name || "").slice(0, 30)}  ${(r.file_size / 1024 / 1024).toFixed(2)}MB  ${(r.detail || "").slice(0, 90)}`
    );
  }
  idx++;
  if (idx >= 12) break;
}
