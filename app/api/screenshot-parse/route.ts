import { NextRequest, NextResponse } from "next/server";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { parseScreenshot } from "@/lib/screenshot-parse";

export const dynamic = "force-dynamic";

/**
 * 截图内容理解：用户上传账号截图后，用 Qwen-VL 读取粉丝/播放等并回填表单。
 * 复用 analyze 的 AI 限额，避免被滥用烧钱。
 */
export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "creative");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "为了您的体验，请先登录", code: "UN_AUTHED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  const platform = body.platform ? String(body.platform).trim() : undefined;
  if (!url) return NextResponse.json({ error: "缺少截图地址" }, { status: 400 });

  try {
    const result = await parseScreenshot(url, platform);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "截图读取失败，请重试" },
      { status: 502 }
    );
  }
}
