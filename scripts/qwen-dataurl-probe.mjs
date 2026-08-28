// 验证 DashScope 能否直接接收 base64 视频数据（data:video URL），避免跨云下载超时。
import fs from "node:fs";
const key = process.env.QWEN_PROBE_KEY || "";
if (!key) { console.log("[FAIL] 未传 QWEN_PROBE_KEY"); process.exit(2); }

const file = fs.readFileSync("/tmp/wbclip.mp4");
const dataUrl = `data:video/mp4;base64,${file.toString("base64")}`;
console.log("视频 base64 data url 长度:", dataUrl.length, `(~${(dataUrl.length/1024).toFixed(0)}KB)`);

// 试几种 DashScope 收视频的字段写法
const tries = [
  { label: "video_url + data url", content: [{ type: "text", text: "描述这个视频开头画面，15字内。" }, { type: "video_url", video_url: { url: dataUrl } }] },
  { label: "video + data url", content: [{ type: "text", text: "描述这个视频开头画面，15字内。" }, { type: "video", video: dataUrl }] },
];

for (const t of tries) {
  const url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  const body = { model: "qwen-vl-max", messages: [{ role: "user", content: t.content }], max_tokens: 40 };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    console.log(`\n[${t.label}] HTTP ${res.status}`);
    console.log("  响应:", text.slice(0, 260));
    if (res.status === 200) { console.log("  ✅ 可行"); process.exit(0); }
  } catch (e) {
    console.log(`\n[${t.label}] 异常:`, e?.message || e);
  }
}
console.log("\n=== 两种写法都不可行，考虑 DashScope Files 上传 API ===");
