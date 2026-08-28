import { randomUUID } from "node:crypto";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

/**
 * 上传票据：Serverless 友好的视频上传方案。
 * - 配置 BLOB_READ_WRITE_TOKEN 时：服务端签发受限客户端令牌，
 *   前端把视频直传到 Vercel Blob 对象存储（绕开 Serverless 函数请求体限制），
 *   拿到公网 URL 后走「视频 URL 理解」（Qwen-VL 直接看视频，无需 ffmpeg）。
 * - 未配置时：回退本机 /api/analyze/upload（开发模式，ffmpeg 抽帧）。
 */

export interface UploadTicket {
  blobMode: boolean;
  /** 客户端 put 用的路径（与令牌约束一致） */
  pathname?: string;
  /** 客户端 put 需要的临时令牌 */
  token?: string;
}

export async function createVideoUploadTicket(): Promise<UploadTicket> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { blobMode: false };
  }
  try {
    const pathname = `videos/${randomUUID()}.mp4`;
    const token = await generateClientTokenFromReadWriteToken({
      pathname,
      addRandomSuffix: true,
      allowedContentTypes: [
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/x-m4v",
      ],
      maximumSizeInBytes: 200 * 1024 * 1024,
    });
    return { blobMode: true, pathname, token };
  } catch (e) {
    console.warn("[upload] Blob 令牌签发失败，回退本机上传：", e);
    return { blobMode: false };
  }
}

/** 通用图片上传票据（账号截图 / 补充素材等；比视频更小，走 Blob 或本机） */
export async function createImageUploadTicket(opts?: { pathPrefix?: string }): Promise<UploadTicket> {
  const prefix = opts?.pathPrefix || "images";
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { blobMode: false };
  }
  try {
    const pathname = `${prefix}/${randomUUID()}.png`;
    const token = await generateClientTokenFromReadWriteToken({
      pathname,
      addRandomSuffix: true,
      allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/heic"],
      maximumSizeInBytes: 20 * 1024 * 1024,
    });
    return { blobMode: true, pathname, token };
  } catch (e) {
    console.warn("[upload] 图片 Blob 令牌签发失败，回退本机上传：", e);
    return { blobMode: false };
  }
}
