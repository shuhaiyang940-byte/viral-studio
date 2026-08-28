import { NextRequest, NextResponse } from "next/server";
import { buildAccountPreview, buildSignalsFromManual } from "@/lib/account-resolve";

export const dynamic = "force-dynamic";

/**
 * 账号解析预览：填账号名 / 主页链接后，即时返回该账号的可确认信息（粉丝/播放等），
 * 让用户判断「是不是自己的账号」，避免账号重名导致的误判。
 * 公开接口（无需登录即可预览，属于「帮我确认账号」的体验，不触发 AI 成本）。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const platform = String(body.platform ?? "").trim();
  const account = String(body.account ?? "").trim();
  if (!platform || !account) {
    return NextResponse.json({ error: "请先选择平台并填写账号名/主页链接" }, { status: 400 });
  }

  // 当前无真实平台 API：用用户已填/回填的数据作为「信号」回显，并诚实标注来源=manual。
  // 将来接入真实 adapter 后，这里优先拉平台数据（source=platform）。
  const signals = buildSignalsFromManual({
    followers: toNum(body.followers),
    engagementRate: toNum(body.engagementRate),
    avgPlays: toNum(body.avgPlays),
    avgLikes: toNum(body.avgLikes),
    avgComments: toNum(body.avgComments),
    sampleText: String(body.sampleText ?? ""),
  });
  const preview = buildAccountPreview({ platform, account, signals, source: "manual" });
  return NextResponse.json({ preview });
}

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null || `${v}`.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
