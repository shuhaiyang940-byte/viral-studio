// 阿里云 OSS 接入（服务端）：视频/截图上传走 OSS，千问内网直拉 OSS URL，解决跨云下载超时。
import { createRequire } from "node:module";

const requireN = createRequire(import.meta.url);

let _client: any = null;

export function ossConfigured(): boolean {
  return !!(
    process.env.OSS_ACCESS_KEY_ID &&
    process.env.OSS_ACCESS_KEY_SECRET &&
    process.env.OSS_BUCKET &&
    process.env.OSS_REGION
  );
}

export function ossClient(): any {
  if (!_client) {
    const OSS = requireN("ali-oss");
    _client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true,
    });
  }
  return _client;
}

export function ossHost(): string {
  return `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com`;
}

/** 生成 PUT 预签名 URL（前端直接 PUT 到 OSS，绕开 Vercel 4.5MB body 限制） */
export async function putSignatureUrl(key: string, contentType: string): Promise<{ putUrl: string; publicUrl: string }> {
  const client = ossClient();
  const putUrl = client.signatureUrl(key, {
    method: "PUT",
    expires: 3600,
    headers: contentType ? { "Content-Type": contentType } : {},
  } as any);
  return { putUrl, publicUrl: `${ossHost()}/${key}` };
}

/** 幂等配置 bucket 跨域（浏览器直传 OSS 需要）。失败静默（只影响浏览器直传，不影响后端 put）。 */
export async function ensureOssCors(): Promise<void> {
  if (!ossConfigured()) return;
  try {
    const client = ossClient();
    await client.putBucketCORS(process.env.OSS_BUCKET, [
      {
        allowedOrigin: ["*"],
        allowedMethod: ["PUT", "POST", "GET", "DELETE", "HEAD"],
        allowedHeader: ["*"],
        exposeHeader: ["ETag"],
        maxAgeSeconds: 3600,
      },
    ]);
  } catch (e: any) {
    console.warn("[oss] 配置 CORS 失败（浏览器直传可能受影响）：", e?.message || e);
  }
}

/** 服务端直接上传（后端中转用，适合小文件；大文件走 putSignatureUrl 前端直传） */
export async function ossPut(key: string, body: Buffer, contentType?: string): Promise<string> {
  const client = ossClient();
  const res = await client.put(key, body, contentType ? { mime: contentType } : {});
  return `${ossHost()}/${key}`;
}
