// 真实文件上传自测：用生产 BLOB_READ_WRITE_TOKEN + 用户指定的视频文件，
// 完整复刻前端 upload() 协议（handleUpload 握手 → PUT 到真实 Blob 存储 → HEAD 验证 → 清理）。
// 前置：vercel env pull --environment=production .env.prod.selfcheck
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { handleUpload, upload } from "@vercel/blob/client";
import { del } from "@vercel/blob";

const ENV_FILE = new URL("../.env.prod.selfcheck", import.meta.url);
const FILE = "/Volumes/Elements/视频素材/AI/002 - 从今天起，狂热地爱自己！.mp4";

const env = fs.readFileSync(ENV_FILE, "utf8");
const m = env.match(/^BLOB_READ_WRITE_TOKEN=(.+)$/m);
const TOKEN = m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
if (!TOKEN) {
  console.error("[FAIL] .env.prod.selfcheck 中未找到 BLOB_READ_WRITE_TOKEN，请先运行: vercel env pull --environment=production .env.prod.selfcheck");
  process.exit(2);
}

const VIDEO_EXT = [".mp4", ".mov", ".webm", ".m4v"];
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".heic"];
const extOf = (p) => {
  const c = p.split("?")[0].toLowerCase();
  const i = c.lastIndexOf(".");
  return i >= 0 ? c.slice(i) : "";
};

async function onBeforeGenerateToken(pathname) {
  const ext = extOf(pathname);
  if (VIDEO_EXT.includes(ext)) {
    return {
      allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
      maximumSizeInBytes: 50 * 1024 * 1024,
      addRandomSuffix: true,
    };
  }
  if (IMAGE_EXT.includes(ext)) {
    return {
      allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/heic"],
      maximumSizeInBytes: 20 * 1024 * 1024,
      addRandomSuffix: true,
    };
  }
  throw new Error("不支持的文件类型");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/blob/upload") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "bad json" }));
      return;
    }
    try {
      const result = await handleUpload({ body, request: req, token: TOKEN, onBeforeGenerateToken, onUploadCompleted: async () => {} });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "服务端 handleUpload 失败: " + (e?.message || e) }));
    }
  } else {
    res.statusCode = 404;
    res.end();
  }
});

const PORT = 3999;
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const base = `http://127.0.0.1:${PORT}`;

const buf = fs.readFileSync(FILE);
const name = path.basename(FILE);
console.log(`[1] 读取真实文件: ${name}  (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
const file = new File([buf], name, { type: "video/mp4" });

try {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: `${base}/api/blob/upload`,
  });
  console.log("[2] upload() 成功 →");
  console.log("    url:", blob.url);
  console.log("    pathname:", blob.pathname);

  const head = await fetch(blob.url, { method: "HEAD" });
  console.log("[3] HEAD blob.url → HTTP", head.status, `size=${head.headers.get("content-length")}`);
  if (head.status !== 200) {
    console.error("[FAIL] 上传后 URL 不可访问");
    process.exitCode = 1;
  } else {
    console.log("[PASS] 真实文件上传成功且公网可访问 ✅");
  }

  if (blob.pathname) {
    await del(blob.url, { token: TOKEN });
    console.log("[4] 已删除测试上传的公网副本（不留用户素材）");
  }
} catch (e) {
  console.error("[FAIL] upload() 异常:", e?.message || e);
  process.exitCode = 1;
} finally {
  server.close();
}
