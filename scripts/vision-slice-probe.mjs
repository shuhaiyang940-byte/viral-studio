// 验证「大视频→切成N份→每份base64喂千问→整合」链路：用真实视频切5份并逐份分析。
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const key = process.env.QWEN_PROBE_KEY || "";
if (!key) { console.log("[FAIL] 未传 QWEN_PROBE_KEY"); process.exit(2); }
const INPUT = "/Volumes/Elements/视频素材/AI/001 - 3分钟，让你在镜头面前横扫紧张，做回自己！ - 01.mp4";
const N = 5;

// 1. 时长（秒）
const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", INPUT], { encoding: "utf8" });
const dur = parseFloat(JSON.parse(probe).format.duration);
console.log("原视频时长:", dur.toFixed(1), "秒");
const segTime = Math.max(2, dur / N);

// 2. 切成 N 段（低码率保视觉，去音，确保每段 base64 后 < 4.5MB）
execFileSync("ffmpeg", ["-y", "-i", INPUT, "-f", "segment", "-segment_time", String(segTime),
  "-reset_timestamps", "1", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "34",
  "-vf", "scale=320:-2", "-an", "/tmp/wbslice_%02d.mp4"], { stdio: "ignore" });
const files = fs.readdirSync("/tmp").filter((f) => /^wbslice_\d+\.mp4$/.test(f)).sort();
console.log("切片数:", files.length, " 每片大小(MB):", files.map((f) => (fs.statSync("/tmp/" + f).size / 1024 / 1024).toFixed(2)).join(", "));

// 3. 每片 base64 data url → 千问
const summaries = [];
for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const buf = fs.readFileSync("/tmp/" + f);
  const dataUrl = `data:video/mp4;base64,${buf.toString("base64")}`;
  const body = {
    model: "qwen-vl-max",
    messages: [{ role: "user", content: [
      { type: "text", text: "这是短视频的第几段。用两三句话描述画面：人物/场景/动作/字幕/镜头情绪，不要脑补。" },
      { type: "video", video: dataUrl },
    ] }],
    max_tokens: 200,
  };
  try {
    const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    const text = await res.text();
    let content = "";
    if (res.status === 200) {
      content = JSON.parse(text)?.choices?.[0]?.message?.content || "";
    }
    console.log(`  [第${i + 1}片] HTTP ${res.status} ${(buf.length / 1024).toFixed(0)}KB → ${content.slice(0, 80) || text.slice(0, 120)}`);
    summaries.push(content);
  } catch (e) {
    console.log(`  [第${i + 1}片] 异常: ${e?.message || e}`);
  }
}

console.log("\n=== 5 片视觉摘要（整合前）===");
summaries.forEach((s, i) => console.log(`第${i + 1}片: ${(s || "").slice(0, 160)}`));
console.log("\n可用于整合的片段数:", summaries.filter(Boolean).length, "/", files.length);
