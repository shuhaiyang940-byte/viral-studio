import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo } from "@/lib/ai";
import { SAMPLE_REPORT } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const report = await analyzeVideo({
    source: typeof body.source === "string" ? body.source : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    profile:
      body.profile && typeof body.profile === "object" ? body.profile : undefined,
    refType: typeof body.refType === "string" ? body.refType : undefined,
  });
  return NextResponse.json(report);
}

export async function GET(req: NextRequest) {
  // 返回示例报告，供报告页在无本地记录时回退展示
  const sample = req.nextUrl.searchParams.get("sample") === "1";
  return NextResponse.json(sample || true ? SAMPLE_REPORT : SAMPLE_REPORT);
}
