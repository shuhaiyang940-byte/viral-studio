import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 真实微信登录回调入口（骨架 / 尚未接入真实后端）。
 *
 * 线上 Demo 目前走 Mock（lib/auth.ts + /login 页的扫码模拟），
 * 本接口仅占位说明真实链路，方便上线时按 lib/auth-real.ts 的注释补齐。
 *
 * 真实流程（GET 回调）：
 *   GET /api/auth/wechat?code=xxx&state=yyy
 *     → exchangeWechatCode(code)        换 openid + access_token
 *     → 调 /sns/userinfo 拿 nickname/avatar
 *     → upsertUser(openid, userInfo)    自家用户表 upsert（首扫即注册）
 *     → issueSession(user)              签发 JWT
 *     → 下发 HttpOnly Cookie            前端不再碰明文
 *     → 若 needsPhone → 前端弹「绑定手机号」（双重注册）
 *     → 重定向回 ?redirect
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ ok: false, error: "缺少 code 参数" }, { status: 400 });
  }

  // 占位：真实环境在此完成 code → token → user → cookie
  return NextResponse.json({
    ok: false,
    stub: true,
    message:
      "真实微信登录骨架已就绪，但尚未接入后端（微信 AppID / 数据库 / JWT 密钥）。当前 Demo 使用 /login 的 Mock 登录。",
    next: "完整接入步骤见 lib/auth-real.ts 与 app/api/auth/wechat 注释",
  });
}

/**
 * 双重注册：绑定手机号（真实环境校验短信验证码 + 写入数据库 users.phone）。
 * Demo 里这一步由前端 lib/auth.ts 的 bindPhone 写 localStorage 代替。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawPhone = typeof body.phone === "string" ? body.phone : "";
  const masked = rawPhone ? rawPhone.slice(0, 3) + "****" + rawPhone.slice(-4) : null;

  // 占位：真实环境校验短信验证码，并写入当前登录用户的 phone 字段
  return NextResponse.json({
    ok: false,
    stub: true,
    message: "手机号绑定骨架已就绪，真实环境需短信服务 + 数据库写入。",
    received: { phone: masked },
  });
}
