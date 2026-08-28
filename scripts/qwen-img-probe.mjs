// 用 1x1 图片 data URL 测 qwen-vl-max，判断 key 对视觉模型是否基本可用（排除视频源拉取问题）。
const key = process.env.QWEN_PROBE_KEY || "";
if (!key) { console.log("[FAIL] 未传 QWEN_PROBE_KEY"); process.exit(2); }
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const dataUrl = `data:image/png;base64,${png}`;

for (const model of ["qwen-vl-max", "qwen-vl-max-latest", "qwen-vl-plus"]) {
  const url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  const body = {
    model,
    messages: [{ role: "user", content: [{ type: "text", text: "这是什么颜色？" }, { type: "image_url", image_url: { url: dataUrl } }] }],
    max_tokens: 20,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    console.log(`[${model}] HTTP ${res.status} → ${text.slice(0, 140)}`);
  } catch (e) {
    console.log(`[${model}] 异常: ${e?.message || e}`);
  }
}
