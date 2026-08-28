// 用 ali-oss SDK 验证 AK/SK 对 bucket 的读写（SDK 自动处理签名版本）
import { createRequire } from "node:module";
const requireN = createRequire(import.meta.url);
const OSS = requireN("ali-oss");

const AK = process.env.OSS_AK || "";
const SK = process.env.OSS_SK || "";
const BUCKET = process.env.OSS_BUCKET || "shymax";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";
if (!AK || !SK) { console.log("[FAIL] 无 AK/SK"); process.exit(2); }

const client = new OSS({
  region: REGION,
  accessKeyId: AK,
  accessKeySecret: SK,
  bucket: BUCKET,
  secure: true,
});

const key = `_probe/probe_${Date.now()}.txt`;
try {
  const put = await client.put(key, Buffer.from("oss-sdk-ok"));
  console.log("PUT ok:", put.url);
  const get = await client.get(key);
  console.log("GET ok:", get.content.toString());
  const del = await client.delete(key);
  console.log("DELETE ok:", del.res.status);
  console.log("✅ 该 AK/SK 可对该 bucket 读写:", BUCKET, "(", REGION, ")");
} catch (e) {
  console.log("❌ 失败:", e?.code, e?.message);
}
