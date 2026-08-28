/**
 * 上传模式探测：Vercel Blob 2.x 采用客户端 upload() + 服务端 handleUpload()。
 * 这里只判断是否配置了 BLOB_READ_WRITE_TOKEN，决定走 Blob 直传还是本机回退。
 * - 配置 BLOB_READ_WRITE_TOKEN：客户端直传 Vercel Blob（绕开 Serverless 请求体限制），
 *   前端拿到公开 URL 后走「视频 URL 理解」（Qwen-VL 直接看视频）。
 * - 未配置：回退本机 /api/analyze/upload（开发模式，ffmpeg 抽帧）。
 */

export interface UploadTicket {
  blobMode: boolean;
  /** 兼容旧字段：自动前缀路径（不再预生成，由服务端 handleUpload 按需生成） */
  pathname?: string;
  /** 兼容旧字段：临时令牌（不再预生成） */
  token?: string;
}

export async function createVideoUploadTicket(): Promise<UploadTicket> {
  return { blobMode: !!process.env.BLOB_READ_WRITE_TOKEN };
}

/** 通用图片上传票据（账号截图 / 补充素材等） */
export async function createImageUploadTicket(_opts?: { pathPrefix?: string }): Promise<UploadTicket> {
  return { blobMode: !!process.env.BLOB_READ_WRITE_TOKEN };
}
