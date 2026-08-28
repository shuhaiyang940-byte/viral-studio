// 探测 Vercel Blob 对真实资源的跨域 PUT 预检（OPTIONS）响应头。
import fs from "node:fs";
import http from "node:http";
import { handleUpload, upload } from "@vercel/blob/client";
import { del } from "@vercel/blob";

const env = fs.readFileSync(new URL("../.env.prod.selfcheck", import.meta.url), "utf8");
const m = env.match(/^BLOB_READ_WRITE_TOKEN=(.+)$/m);
const TOKEN = m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
if (!TOKEN) { console.error("no token"); process.exit(2); }

const VIDEO_EXT = [".mp4", ".mov", ".webm", ".m4v"];
const extOf = (p) => { const c = p.split("?")[0].toLowerCase(); const i = c.lastIndexOf("."); return i >= 0 ? c.slice(i) : ""; };

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/blob/upload") {
    let raw = "";
    for await (const c of req) raw += c;
    let body; try { body = JSON.parse(raw); } catch { res.statusCode = 400; res.end("{}"); return; }
    try {
      const result = await handleUpload({ body, request: req, token: TOKEN,
        onBeforeGenerateToken: async (pathname) => {
          if (VIDEO_EXT.includes(extOf(pathname))) return { allowedContentTypes: ["video/mp4","video/quicktime","video/webm","video/x-m4v"], maximumSizeInBytes: 50*1024*1024, addRandomSuffix: true };
          return { allowedContentTypes: ["image/png","image/jpeg","image/webp","image/heic"], maximumSizeInBytes: 20*1024*1024, addRandomSuffix: true };
        }, onUploadCompleted: async () => {} });
      res.setHeader("content-type", "application/json"); res.end(JSON.stringify(result));
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e?.message })); }
  } else { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(3999, "127.0.0.1", r));

try {
  const file = new File([new Uint8Array(1024).fill(1)], "cors-probe.mp4", { type: "video/mp4" });
  const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "http://127.0.0.1:3999/api/blob/upload" });
  console.log("上传成功 →", blob.url);
  const res = await fetch(blob.url, { method: "OPTIONS", headers: { Origin: "https://viral-studio-ai-mu.vercel.app", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
  console.log("=== OPTIONS 预检响应头 ===");
  console.log("HTTP", res.status);
  const headers = Object.fromEntries(res.headers.entries());
  for (const k of Object.keys(headers).filter((h) => /access-control|allow|vary/i.test(h))) {
    console.log(`${k}: ${headers[k]}`);
  }
  if (blob.pathname) await del(blob.url, { token: TOKEN });
  console.log("已清理");
} catch (e) {
  console.error("[FAIL]", e?.message || e);
} finally {
  server.close();
}
