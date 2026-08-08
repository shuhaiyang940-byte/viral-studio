import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession, signSession, type SessionPayload } from "./jwt";

export const SESSION_COOKIE = "vs_session";

/**
 * 服务端读取当前会话（HttpOnly Cookie 中的 JWT）。
 * 路由处理器 / 服务端组件可直接调用；无会话或非法 token 返回 null。
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

/** 取当前登录用户身份（不含密码哈希等敏感字段） */
export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  name: string;
  tier: string;
} | null> {
  const s = await getSession();
  if (!s) return null;
  return { id: s.sub, email: s.email, name: s.name, tier: s.tier };
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

/** 在响应里写入会话 Cookie（签发 JWT 并存 HttpOnly Cookie） */
export async function setSession(res: NextResponse, payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
}

/** 清除会话 Cookie（登出） */
export function clearSession(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}
