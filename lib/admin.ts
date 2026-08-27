// 管理接口鉴权（复用现有 SEED/ADMIN token 思路）：?token= 或 Authorization Bearer。

import { NextRequest, NextResponse } from "next/server";

/** 校验管理口令；返回 NextResponse 表示已拒绝（null 表示通过）。 */
export function requireAdmin(req: NextRequest, envName = "ADMIN_TOKEN"): NextResponse | null {
  const expected = process.env[envName];
  if (!expected) {
    return NextResponse.json({ error: `${envName} 未配置，出于安全考虑拒绝执行` }, { status: 503 });
  }
  const url = new URL(req.url);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";
  if (token !== expected) {
    return NextResponse.json({ error: "token 无效" }, { status: 401 });
  }
  return null;
}
