// 复现 route 的「下载视频 + ffmpeg 切片」：拿最新 blob_upload_done 的 URL，下载后用系统 ffmpeg 切，
// 判断是逻辑问题还是 Vercel 上 ffmpeg-static 环境问题。
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
process.loadEnvFile(new URL("../.env.prod.selfcheck", import.meta.url));
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
const execFileAsync = promisify(execFile);

const rows = await sql.query(
  `SELECT detail FROM diagnosis_upload_logs WHERE step='blob_upload_done' AND detail LIKE 'https%' ORDER BY id DESC LIMIT 1`
);
const url = rows[0]?.detail?.trim();
if (!url) { console.log("[FAIL] 无 blob URL"); process.exit(2); }
console.log("[1] 视频 URL:", url.slice(0, 80) + "…");

const dl = await fetch(url, { signal: AbortSignal.timeout(60000) });
console.log("[2] 下载 HTTP", dl.status, " size(MB)", (Number(dl.headers.get("content-length")) / 1024 / 1024).toFixed(2));
if (!dl.ok) { console.log("[FAIL] 下载失败"); process.exit(2); }
const buf = Buffer.from(await dl.arrayBuffer());
fs.writeFileSync("/tmp/slicetest.mp4", buf);
console.log("[3] 已写入 /tmp/slicetest.mp4, 实际字节", buf.length);

// 复刻 route 的切片命令（系统 ffmpeg）
const ff = "ffmpeg";
const durRe = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/;
let dur = 30;
try {
  const r = await execFileAsync(ff, ["-i", "/tmp/slicetest.mp4"]);
  const m = durRe.exec(r.stderr || ""); if (m) dur = +m[1]*3600 + +m[2]*60 + +m[3];
} catch (e) {
  const m = durRe.exec(e.stderr || ""); if (m) dur = +m[1]*3600 + +m[2]*60 + +m[3];
}
console.log("[4] 时长(秒):", dur.toFixed(1));
const seg = Math.max(2, dur / 5);
fs.rmSync("/tmp/slicetest_out", { recursive: true, force: true });
fs.mkdirSync("/tmp/slicetest_out", { recursive: true });
try {
  await execFileAsync(ff, ["-y", "-i", "/tmp/slicetest.mp4", "-f", "segment", "-segment_time", seg.toFixed(3),
    "-reset_timestamps", "1", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "34",
    "-vf", "scale=320:-2", "-an", "/tmp/slicetest_out/seg_%02d.mp4"]);
  const files = fs.readdirSync("/tmp/slicetest_out").filter((f) => /^seg_\d+\.mp4$/.test(f)).sort();
  console.log("[5] 切片成功，片段数:", files.length, " 大小(MB):", files.map((f) => (fs.statSync("/tmp/slicetest_out/" + f).size / 1024 / 1024).toFixed(2)).join(", "));
} catch (e) {
  console.log("[FAIL] 切片异常:", (e.stderr || e.message || e).slice(0, 600));
}
