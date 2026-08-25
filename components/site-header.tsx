"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User, Crown, Wand2, Flame, Target, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useSession, logout } from "@/lib/auth";
import { hydrateWorkspace } from "@/lib/storage";

export function SiteHeader() {
  // useSession 挂载时会回源 /api/auth/me 校准，避免本地镜像与服务端 Cookie 不一致
  const { session, loading } = useSession();
  const [mounted, setMounted] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  // 登录后把服务端已持久化的创作资产回灌到本地缓存（跨设备/清缓存也能看到）
  React.useEffect(() => {
    if (mounted && session) void hydrateWorkspace();
  }, [mounted, session]);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    // 刷新当前页让各处登录态同步
    if (typeof window !== "undefined") window.location.href = "/";
  }

  const BETA = process.env.NEXT_PUBLIC_BETA_MODE === "1";

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      {BETA && (
        <div className="bg-primary/5 px-3 py-1 text-center text-[11px] text-muted-foreground">
          Beta 公测中 · 核心创作功能限时免费开放，无需付费
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {[
            { label: "拆爆款复刻", href: "/studio" },
            { label: "找对标黑马", href: "/find-peer" },
            { label: "账号诊断所", href: "/clinic" },
            { label: "创意选题", href: "/ideas" },
            { label: "我的创作", href: "/history" },
          ].map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {!mounted || (loading && !session) ? (
            // 校准中显示占位骨架，避免已登录用户每次刷新都闪一下「登录」按钮
            <div className="h-8 w-24 animate-pulse rounded-md bg-muted" aria-hidden />
          ) : session ? (
            <>
              {!session.isPro && (
                <Button asChild variant="outline" size="sm">
                  <Link href={BETA ? "/studio" : "/pricing"}>
                    <Crown className="h-4 w-4 text-primary" /> {BETA ? "免费体验" : "升级"}
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/profile" className="gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-white">
                    {session.avatar}
                  </span>
                  <span className="hidden sm:inline">{session.name}</span>
                  <User className="h-4 w-4 sm:hidden" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-2 text-muted-foreground"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">登录</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/studio">开始创作</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
    <MobileNav />
    </>
  );
}

/** 移动端底部 Tab（4 个核心入口），手机访问不再看不到菜单 */
function MobileNav() {
  const pathname = usePathname();
  const items = [
    { label: "拆爆款复刻", href: "/studio", icon: Wand2 },
    { label: "找对标黑马", href: "/find-peer", icon: Flame },
    { label: "账号诊断", href: "/clinic", icon: Target },
    { label: "创意选题", href: "/ideas", icon: Sparkles },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-border/60 bg-background/90 backdrop-blur md:hidden lg:hidden">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-col items-center gap-1 py-2 pb-[env(safe-area-inset-bottom)] text-[11px] transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "" : ""}`} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
