// 用生产 key 实测 Qwen-VL（DashScope）与 DeepSeek，判断是否鉴权/余额/网络导致视频分析失败。
import fs from "node:fs";
process.loadEnvFile(new URL("../.env.prod.selfcheck", import.meta.url));
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

// 取最新一条 blob_upload_done 的视频 URL 作为 Qwen-VL 的真实输入
const urlRows = await sql.query(
  `SELECT detail, created_at FROM diagnosis_upload_logs WHERE step='blob_upload_done' AND detail LIKE 'https%' ORDER BY id DESC LIMIT 1`
);
const videoUrl = urlRows[0]?.detail?.trim();

const qwenKey = process.env.QWEN_API_KEY || "";
const dsKey = process.env.DEEPSEEK_API_KEY || "";
console.log("QWEN_API_KEY 是否配置:", qwenKey ? "是(长度" + qwenKey.length + ")" : "否");
console.log("DEEPSEEK_API_KEY 是否配置:", dsKey ? "是(长度" + dsKey.length + ")" : "否");
console.log("视频 URL:", videoUrl ? videoUrl.slice(0, 90) + "…" : "(无)");

async function probeQwen() {
  if (!qwenKey || !videoUrl) {
    console.log("\n[Qwen-VL] 跳过：无 key 或无视频 URL");
    return;
  }
  console.log("\n=== Qwen-VL (DashScope) 调用 ===");
  const url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
  const body = {
    model: process.env.QWEN_VL_MODEL || "qwen-vl-max",
    input: { messages: [{ role: "user", content: [{ text: "描述这个视频开头1秒画面，20字内。" }, { video: videoUrl }] }] },
    parameters: { max_tokens: 60 },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${qwenKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    const text = await res.text();
    console.log("HTTP", res.status);
    console.log("响应:", text.slice(0, 260));
  } catch (e) {
    console.log("调用异常:", e?.message || e);
  }
}

async function probeDeepseek() {
  if (!dsKey) {
    console.log("\n[DeepSeek] 跳过：无 key");
    return;
  }
  console.log("\n=== DeepSeek 调用 ===");
  const url = "https://api.deepseek.com/chat/completions";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${dsKey}` },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || "deepseek-chat", messages: [{ role: "user", content: "你好" }], max_tokens: 5 }),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    console.log("HTTP", res.status);
    console.log("响应:", text.slice(0, 200));
  } catch (e) {
    console.log("调用异常:", e?.message || e);
  }
}

await probeQwen();
await probeDeepseek();
