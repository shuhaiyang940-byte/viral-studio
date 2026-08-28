// 复现前端「签名URL PUT」：ali-oss 生成 PUT 预签名，Node 带 Content-Type PUT，看是否 403。
import fs from "node:fs";
import { createRequire } from "node:module";
const requireN = createRequire(import.meta.url);
const OSS = requireN("ali-oss");

const AK = process.env.OSS_AK, SK = process.env.OSS_SK, BUCKET = process.env.OSS_BUCKET || "shymax", REGION = process.env.OSS_REGION || "oss-cn-beijing";
if (!AK || !SK) { console.log("[FAIL] 无 AK/SK"); process.exit(2); }
const client = new OSS({ region: REGION, accessKeyId: AK, accessKeySecret: SK, bucket: BUCKET, secure: true });

let src = "/tmp/wbclip.mp4";
if (!fs.existsSync(src)) src = "/tmp/wbslice_00.mp4";
const contentType = "video/mp4";
const key = `_sigtest/clip_${Date.now()}.mp4`;
const putUrl = client.signatureUrl(key, { method: "PUT", expires: 3600 });
console.log("签名URL:", putUrl.slice(0, 110) + "…");

const res = await fetch(putUrl, { method: "PUT", body: fs.readFileSync(src), signal: AbortSignal.timeout(20000) });
console.log("PUT HTTP", res.status);
const txt = await res.text();
console.log("响应:", txt.slice(0, 300));
if (res.status === 200) {
  console.log("✅ 签名URL PUT 成功");
  const t0 = Date.now();
  const url = `https://${BUCKET}.${REGION}.aliyuncs.com/${key}`;
  const q = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.QWEN_PROBE_KEY || ""}` },
    body: JSON.stringify({ model: "qwen-vl-max", messages: [{ role: "user", content: [{ type: "text", text: "描述这个视频开头画面，15字内。" }, { type: "video_url", video_url: { url } }] }], max_tokens: 40 }),
    signal: AbortSignal.timeout(90000),
  });
  const qt = await q.text();
  console.log(`千问看(octet-stream) → HTTP ${q.status} 耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("响应:", qt.slice(0, 200));
}
