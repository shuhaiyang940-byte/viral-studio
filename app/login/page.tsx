"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { login, register, type Session } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [redirectTo, setRedirectTo] = React.useState("/");

  // 用 window.location 读 ?redirect= 而不是 useSearchParams：
  // 后者会强制整页退出静态预渲染（或要求包一层 Suspense），这里没必要。
  React.useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("redirect");
    // 只接受站内相对路径，防止开放重定向（//evil.com 也要拦）
    if (r && r.startsWith("/") && !r.startsWith("//")) setRedirectTo(r);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password.length > 72) {
      setError("密码最长 72 位");
      return;
    }
    setLoading(true);
    try {
      let s: Session;
      if (mode === "register") s = await register(email, password, name);
      else s = await login(email, password);
      void s;
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          爆款研究所
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          {mode === "register" ? "创建账号" : "登录"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "register"
            ? "注册后即可收藏案例、追踪对标、保存你的分析记录。"
            : "欢迎回来，继续你的爆款创作。"}
        </p>
      </div>

      <Card className="mt-8">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-sm font-medium">昵称（选填）</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：小明"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "处理中…" : mode === "register" ? "注册" : "登录"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "register" ? (
              <>
                已有账号？
                <button
                  type="button"
                  className="font-medium text-primary"
                  onClick={() => setMode("login")}
                >
                  去登录
                </button>
              </>
            ) : (
              <>
                还没有账号？
                <button
                  type="button"
                  className="font-medium text-primary"
                  onClick={() => setMode("register")}
                >
                  去注册
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        密码经 bcrypt 加密存储，会话以 HttpOnly Cookie 保护
      </p>
    </div>
  );
}
