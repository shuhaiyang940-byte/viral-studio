// 用 AK/SK 探测阿里云 OSS bucket 列表（无依赖，手写签名）
import crypto from "node:crypto";

const AK = process.env.OSS_AK || "";
const SK = process.env.OSS_SK || "";
if (!AK || !SK) { console.log("[FAIL] 未传 OSS_AK / OSS_SK"); process.exit(2); }

const gmt = new Date().toUTCString();
const strToSign = `GET\n\n\n${gmt}\n/`;
const sig = crypto.createHmac("sha1", SK).update(strToSign).digest("base64");
const auth = `OSS ${AK}:${sig}`;

try {
  const res = await fetch("https://oss.aliyuncs.com/?list-type=2", {
    method: "GET",
    headers: { Date: gmt, Authorization: auth },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  console.log("HTTP", res.status);
  if (res.status !== 200) { console.log("响应:", text.slice(0, 400)); process.exit(0); }
  // 解析 XML 里的 bucket
  const names = [...text.matchAll(/<Name>([^<]+)<\/Name>/g)].map((m) => m[1]);
  const regions = [...text.matchAll(/<Region>([^<]+)<\/Region>/g)].map((m) => m[1]);
  const dates = [...text.matchAll(/<CreationDate>([^<]+)<\/CreationDate>/g)].map((m) => m[1]);
  console.log("Bucket 数量:", names.length);
  for (let i = 0; i < names.length; i++) {
    console.log(`  Bucket: ${names[i]}  Region: ${regions[i] || "?"}  创建: ${dates[i] || "?"}`);
  }
  if (!names.length) console.log("(还没有 bucket，需在控制台创建)");
} catch (e) {
  console.log("异常:", e?.message || e);
}
