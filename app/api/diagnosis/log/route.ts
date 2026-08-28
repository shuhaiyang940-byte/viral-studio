import { NextRequest, NextResponse } from "next/server";
import { writeDiagLog } from "@/lib/diag-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 前端诊断上传事件日志写入（fire-and-forget，失败不影响主流程） */
export async function POST(req: NextRequest) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }
  await writeDiagLog({
    sessionId: b.sessionId || "",
    fileName: b.fileName || "",
    fileSize: Number(b.fileSize) || 0,
    step: b.step || "",
    detail: b.detail || "",
    ok: typeof b.ok === "boolean" ? b.ok : undefined,
  });
  return NextResponse.json({ ok: true });
}
