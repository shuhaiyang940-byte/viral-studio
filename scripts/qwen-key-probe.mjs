// 用传入的 QWEN_PROBE_KEY 实测 Qwen-VL 看视频（鉴权 + 模型能力），定位是否可正常分析。
import fs from "node:fs";
process.loadEnvFile(new URL("../.env.prod.selfcheck", import.meta.url));
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const key = process.env.QWEN_PROBE_KEY || ""; // 不打印 key 本身
const urlRows = await sql.query(
  `SELECT detail FROM diagnosis_upload_logs WHERE step='blob_upload_done' AND detail LIKE 'https%' ORDER BY id DESC LIMIT 1`
);
const videoUrl = urlRows[0]?.detail?.trim();

console.log("QWEN_PROBE_KEY 长度:", key.length ? String(key.length) : "(未提供)");
console.log("视频 URL:", videoUrl ? videoUrl.slice(0, 80) + "…" : "(无)");

if (!key) { console.log("[FAIL] 未传 QWEN_PROBE_KEY"); process.exit(2); }
if (!videoUrl) { console.log("[FAIL] 库里无 blob_upload_done URL"); process.exit(2); }

async function call(model) {
  // 与生产 understandVideoUrl 一致：OpenAI 兼容端点 + video_url
  const url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "用一句话描述这个视频的开头画面。" },
          { type: "video_url", video_url: { url: videoUrl } },
        ],
      },
    ],
    max_tokens: 60,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(200000),
    });
    const text = await res.text();
    console.log(`\n[Qwen ${model}] HTTP ${res.status}`);
    console.log("响应:", text.slice(0, 320));
    return res.status === 200;
  } catch (e) {
    console.log(`\n[Qwen ${model}] 调用异常:`, e?.message || e);
    return false;
  }
}

// 关键验证：只测 qwen-vl-max（该 key 有权限），拉长超时看是否只是慢
const models = ["qwen-vl-max"];
const seen = new Set();
let ok = false;
for (const m of models) {
  if (seen.has(m)) continue;
  seen.add(m);
  ok = await call(m);
  if (ok) break;
}
console.log("\n=== 结论:", ok ? "可用 ✔" : "不可用 �’（见上）", "===");
