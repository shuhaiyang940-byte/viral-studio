import { NextRequest, NextResponse } from "next/server";
import { createImageUploadTicket } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** 获取截图直传票据（Blob 模式）或回退标记（本机模式） */
export async function POST(req: NextRequest) {
  return NextResponse.json(await createImageUploadTicket({ pathPrefix: "screenshots" }));
}
