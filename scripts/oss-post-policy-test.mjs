// 验证 OSS POST 表单直传（calculatePostSignature policy）：本地 multipart POST，应 200 + 对象可读取。
import fs from "node:fs";
import { createRequire } from "node:module";
const requireN = createRequire(import.meta.url);
const OSS = requireN("ali-oss");

const AK = process.env.OSS_AK, SK = process.env.OSS_SK, BUCKET = process.env.OSS_BUCKET || "shymax", REGION = process.env.OSS_REGION || "oss-cn-beijing";
const QK = process.env.QWEN_PROBE_KEY || "";
const client = new OSS({ region: REGION, accessKeyId: AK, accessKeySecret: SK, bucket: BUCKET, secure: true });

const src = fs.existsSync("/tmp/wbslice_00.mp4") ? "/tmp/wbslice_00.mp4" : "/tmp/wbclip.mp4";
const dir = "videos";
const key = `${dir}/post_${Date.now()}.mp4`;
const expiration = new Date(Date.now() + 3600 * 1000).toISOString();
const policy = { expiration, conditions: [["content-length-range", 0, 105 * 1024 * 1024], ["starts-with", "$key", dir + "/"]] };
const sig = client.calculatePostSignature(policy);
const host = `https://${BUCKET}.${REGION}.aliyuncs.com`;

const fd = new FormData();
fd.append("key", key);
fd.append("policy", sig.policy);
fd.append("OSSAccessKeyId", sig.OSSAccessKeyId);
fd.append("signature", sig.Signature);
fd.append("success_action_status", "200");
fd.append("file", new File([fs.readFileSync(src)], "clip.mp4", { type: "video/mp4" }));

const res = await fetch(host, { method: "POST", body: fd, signal: AbortSignal.timeout(20000) });
console.log("POST HTTP", res.status);
const txt = await res.text();
console.log("响应:", txt.slice(0, 220));
if (res.status === 200) {
  const url = `${host}/${key}`;
  console.log("✅ POST 直传成功，URL:", url.slice(0, 90));
  if (QK) {
    const t0 = Date.now();
    const q = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${QK}` },
      body: JSON.stringify({ model: "qwen-vl-max", messages: [{ role: "user", content: [{ type: "text", text: "描述这个视频开头画面，15字内。" }, { type: "video_url", video_url: { url } }] }], max_tokens: 40 }),
      signal: AbortSignal.timeout(90000),
    });
    const qt = await q.text();
    console.log(`千问看(post直传) → HTTP ${q.status} 耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log("响应:", qt.slice(0, 200));
  }
}
