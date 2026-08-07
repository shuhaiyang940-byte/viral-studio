import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Mock 登录/注册接口：演示用，任何账号密码均视为成功。
// 真实场景需接入数据库、密码哈希与 JWT/Session。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const account = typeof body.account === "string" && body.account ? body.account : "demo@viralstudio.ai";
  return NextResponse.json({
    token: "mock-token-" + Math.random().toString(36).slice(2),
    user: { id: "u-1", account, tier: "free" },
  });
}
