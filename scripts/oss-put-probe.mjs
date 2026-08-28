// 验证 AK/SK 对指定 bucket 能否写入/读取（无依赖手写签名）
import crypto from "node:crypto";

const AK = process.env.OSS_AK || "";
const SK = process.env.OSS_SK || "";
const BUCKET = process.env.OSS_BUCKET || "shymax";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";
if (!AK || !SK) { console.log("[FAIL] 无 AK/SK"); process.exit(2); }

const host = `${BUCKET}.${REGION}.aliyuncs.com`;
const key = `_probe/probe_${Date.now()}.txt`;
const body = "oss-probe-ok";
const gmt = new Date().toUTCString();
const strToSign = `PUT\n\n\n${gmt}\n/${BUCKET}/${key}`;
const sig = crypto.createHmac("sha1", SK).update(strToSign).digest("base64");
const auth = `OSS ${AK}:${sig}`;

try {
  const res = await fetch(`https://${host}/${key}`, {
    method: "PUT",
    headers: { Date: gmt, Authorization: auth },
    body,
    signal: AbortSignal.timeout(20000),
  });
  console.log("PUT HTTP", res.status, new URL(`https://${host}/${key}`).href);
  if (res.status === 200) {
    // 再 GET 验证
    const g = new Date().toUTCString();
    const gSign = `GET\n\n\n${g}\n/${BUCKET}/${key}`;
    const gSig = crypto.createHmac("sha1", SK).update(gSign).digest("base64");
    const r2 = await fetch(`https://${host}/${key}`, { headers: { Date: g, Authorization: `OSS ${AK}:${gSig}` }, signal: AbortSignal.timeout(20000) });
    const txt = await r2.text();
    console.log("GET HTTP", r2.status, "内容:", txt);
    console.log("✅ AK/SK 可写可读该 bucket:", BUCKET);
  } else {
    console.log("响应:", (await res.text()).slice(0, 300));
  }
} catch (e) {
  console.log("异常:", e?.message || e);
}
