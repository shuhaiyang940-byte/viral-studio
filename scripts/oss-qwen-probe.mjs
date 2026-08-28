// 关键验证：把视频上传到 OSS，再让千问看 OSS URL，确认 DashScope 拉 OSS 是否快、不再跨云超时。
import fs from "node:fs";
import { createRequire } from "node:module";
const requireN = createRequire(import.meta.url);
const OSS = requireN("ali-oss");

const AK = process.env.OSS_AK, SK = process.env.OSS_SK, BUCKET = process.env.OSS_BUCKET || "shymax", REGION = process.env.OSS_REGION || "oss-cn-beijing";
const QK = process.env.QWEN_PROBE_KEY || "";
if (!AK || !SK || !QK) { console.log("[FAIL] 缺 AK/SK/QWEN key"); process.exit(2); }

// 找一个本地小视频（wbclip 或切片）
// 优先用时长足够的切片（避免"视频太短"），回退到小片段
let src = null;
const slices = fs.existsSync("/tmp") ? fs.readdirSync("/tmp").filter((f) => /^wbslice_\d+\.mp4$/.test(f)) : [];
if (slices.length) src = "/tmp/" + slices[0];
if (!src && fs.existsSync("/tmp/wbclip.mp4")) src = "/tmp/wbclip.mp4";
if (!src) { console.log("[FAIL] 无本地小视频"); process.exit(2); }
console.log("用小视频:", src, (fs.statSync(src).size / 1024).toFixed(0) + "KB");

const client = new OSS({ region: REGION, accessKeyId: AK, accessKeySecret: SK, bucket: BUCKET, secure: true });
const key = `_qwenprobe/clip_${Date.now()}.mp4`;
await client.put(key, fs.readFileSync(src), { mime: "video/mp4" });
const url = `https://${BUCKET}.${REGION}.aliyuncs.com/${key}`;
console.log("上传OSS成功, URL:", url.slice(0, 90));

const t0 = Date.now();
const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${QK}` },
  body: JSON.stringify({
    model: "qwen-vl-max",
    messages: [{ role: "user", content: [{ type: "text", text: "描述这个视频开头画面，15字内。" }, { type: "video_url", video_url: { url } }] }],
    max_tokens: 40,
  }),
  signal: AbortSignal.timeout(120000),
});
const text = await res.text();
console.log("千问看 OSS URL → HTTP", res.status, "耗时", ((Date.now() - t0) / 1000).toFixed(1) + "s");
console.log("响应:", text.slice(0, 220));

await client.delete(key);
console.log("已删除 OSS 测试对象");
