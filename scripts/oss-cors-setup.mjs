// 给 bucket 配置 CORS（浏览器直传 OSS 需要），并读取现有 CORS 规则。
import { createRequire } from "node:module";
const requireN = createRequire(import.meta.url);
const OSS = requireN("ali-oss");

const AK = process.env.OSS_AK, SK = process.env.OSS_SK, BUCKET = process.env.OSS_BUCKET || "shymax", REGION = process.env.OSS_REGION || "oss-cn-beijing";
if (!AK || !SK) { console.log("[FAIL] 无 AK/SK"); process.exit(2); }
const client = new OSS({ region: REGION, accessKeyId: AK, accessKeySecret: SK, bucket: BUCKET, secure: true });

await client.putBucketCORS(BUCKET, [
  {
    allowedOrigin: ["*"],
    allowedMethod: ["PUT", "POST", "GET", "HEAD", "DELETE"],
    allowedHeader: ["*"],
    exposeHeader: ["ETag"],
    maxAgeSeconds: 3600,
  },
]);
console.log("✅ 已配置 CORS 规则");
try {
  const info = await client.getBucketCORS(BUCKET);
  console.log("当前 CORS:", JSON.stringify(info.rules?.[0] || info));
} catch (e) {
  console.log("读取 CORS:", e?.code, e?.message);
}
