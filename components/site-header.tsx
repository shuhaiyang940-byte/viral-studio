"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, User, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { getSession, logout, type Session } from "@/lib/auth";

export function SiteHeader() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setSession(getSession());
  }, []);

  function handleLogout() {
    logout();
    setSession(null);
    // 刷新当前页让各处登录态同步
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {[
            { label: "首页", href: "/" },
            { label: "AI分析", href: "/analyze" },
            { label: "找对标", href: "/find-peer" },
            { label: "热点追踪", href: "/hotspots" },
            { label: "AI写文案", href: "/copywriting" },
            { label: "智能剪辑", href: "/studio" },
            { label: "字体库", href: "/fonts" },
            { label: "案例库", href: "/library" },
            { label: "定价", href: "/pricing" },
            { label: "帮助中心", href: "/help" },
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
          {mounted && session ? (
            <>
              {!session.isPro && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/pricing">
                    <Crown className="h-4 w-4 text-primary" /> 升级
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
                <Link href="/analyze">免费体验</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
