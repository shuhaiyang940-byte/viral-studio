import { NextResponse, type NextRequest } from "next/server";

/** 需要登录才能访问的页面 */
const PROTECTED = ["/profile"];

/**
 * 乐观的登录检查：只看有没有会话 Cookie，不在 Edge 里验签。
 *
 * 为什么这样够用：真正的鉴权发生在 API 层（每个接口都会 verify JWT），
 * 中间件的职责只是「别让未登录用户看到一个空壳页面」。
 * 伪造一个 Cookie 顶多能打开页面骨架，拿不到任何数据。
 */
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get("vs_session")?.value);
  const { pathname, search } = req.nextUrl;

  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // 已登录用户不需要再看登录页
  if (hasSession && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*", "/login"],
};
