import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 旧版「任意账号密码都成功」的 mock 已废弃，真实账号体系见 register / login。
export async function POST() {
  return NextResponse.json(
    { error: "请使用 /api/auth/register 或 /api/auth/login" },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "请使用 /api/auth/me" }, { status: 410 });
}
