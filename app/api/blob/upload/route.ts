import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".heic"];

/** 从客户端上传的 pathname（含文件名）提取扩展名 */
function extOf(pathname: string): string {
  const clean = pathname.split("?")[0].toLowerCase();
  const i = clean.lastIndexOf(".");
  return i >= 0 ? clean.slice(i) : "";
}

/**
 * 统一的客户端直传路由：Vercel Blob 2.x 标准握手。
 * - 视频：最大 50MB（符合产品上限）
 * - 图片：最大 20MB（账号截图 / 补充素材）
 * 上传完成后 onUploadCompleted 可扩展 DB 回写；当前仅消费，不做持久化。
 */
export async function POST(request: Request) {
  const body = await request.json();

  const result = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      const ext = extOf(pathname);
      if (VIDEO_EXTENSIONS.includes(ext)) {
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-m4v",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
        };
      }
      if (IMAGE_EXTENSIONS.includes(ext)) {
        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/heic",
          ],
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
        };
      }
      throw new Error("不支持的文件类型");
    },
    onUploadCompleted: async () => {},
  });

  return NextResponse.json(result);
}
