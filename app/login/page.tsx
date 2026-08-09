"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Phone, MessageCircle, MessagesSquare, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { login, register, loginWithPhone, loginWithProvider, type Session } from "@/lib/auth";
import { getProfile } from "@/lib/onboarding";

type Method = "email" | "phone" | "qq" | "wechat";

const METHODS: { key: Method; label: string; demo?: boolean }[] = [
  { key: "email", label: "邮箱" },
  { key: "phone", label: "手机号" },
  { key: "qq", label: "QQ", demo: true },
  { key: "wechat", label: "微信", demo: true },
];

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = React.useState<Method>("email");
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sentCode, setSentCode] = React.useState("");
  const [countdown, setCountdown] = React.useState(0);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [redirectTo, setRedirectTo] = React.useState("/");

  React.useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("redirect");
    if (r && r.startsWith("/") && !r.startsWith("//")) setRedirectTo(r);
  }, []);

  // 登录后去向：首登且无档案 → 认识你自己；否则回 redirect 或 我的。
  // 未绑手机的方式（邮箱/QQ/微信）一律先去绑手机。
  function targetFor(hasPhone: boolean): string {
    const fallback = getProfile() ? "/profile" : "/onboarding";
    const base =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : fallback;
    return hasPhone ? base : `/bind-phone?redirect=${encodeURIComponent(base)}`;
  }

  async function afterAuth(s: Session, hasPhone: boolean) {
    void s;
    router.push(targetFor(hasPhone));
    router.refresh();
  }

  function switchMethod(m: Method) {
    setMethod(m);
    setError("");
  }

  async function handleEmail(e: React.FormEvent) {
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
      const s = mode === "register" ? await register(email, password, name) : await login(email, password);
      await afterAuth(s, false);
    } catch (err: any) {
      setError(err?.message || "操作失败，请重试");
      setLoading(false);
    }
  }

  function sendPhoneCode() {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请先输入有效的手机号");
      return;
    }
    setError("");
    const demo = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(demo);
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handlePhone(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入有效的手机号");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位验证码");
      return;
    }
    setLoading(true);
    try {
      const s = await loginWithPhone(phone, code);
      await afterAuth(s, true);
    } catch (err: any) {
      setError(err?.message || "操作失败，请重试");
      setLoading(false);
    }
  }

  async function handleProvider(p: "qq" | "wechat") {
    setError("");
    setLoading(true);
    try {
      const s = await loginWithProvider(p);
      await afterAuth(s, false);
    } catch (err: any) {
      setError(err?.message || "操作失败，请重试");
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
          {method === "email" && (mode === "register" ? "创建账号" : "登录")}
          {method === "phone" && "手机号登录 / 注册"}
          {method === "qq" && "QQ 登录"}
          {method === "wechat" && "微信登录"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          登录后即可收藏案例、追踪对标、保存你的分析记录。
          <br />
          所有方式最终都需要绑定手机号。
        </p>
      </div>

      {/* 方式切换 */}
      <div className="mt-6 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
        {METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => switchMethod(m.key)}
            className={
              "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors " +
              (method === m.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {m.label}
            {m.demo && (
              <span className="rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning">
                演示
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="p-6">
          {method === "email" && (
            <form onSubmit={handleEmail} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">昵称（选填）</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：小明" />
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
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "处理中…" : mode === "register" ? "注册" : "登录"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {mode === "register" ? (
                  <>
                    已有账号？
                    <button type="button" className="font-medium text-primary" onClick={() => setMode("login")}>
                      去登录
                    </button>
                  </>
                ) : (
                  <>
                    还没有账号？
                    <button type="button" className="font-medium text-primary" onClick={() => setMode("register")}>
                      去注册
                    </button>
                  </>
                )}
              </p>
            </form>
          )}

          {method === "phone" && (
            <form onSubmit={handlePhone} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">手机号</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="请输入手机号"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">验证码</label>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 位验证码"
                  />
                  <Button type="button" variant="outline" onClick={sendPhoneCode} disabled={countdown > 0} className="shrink-0">
                    {countdown > 0 ? `${countdown}s` : "发送验证码"}
                  </Button>
                </div>
                {sentCode && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    演示验证码：<span className="font-mono font-semibold text-foreground">{sentCode}</span>
                  </p>
                )}
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "处理中…" : "登录 / 注册"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {(method === "qq" || method === "wechat") && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {method === "qq" ? "QQ" : "微信"} 真实授权需开放平台 AppID/Secret 与服务端回调，
                <br />
                当前为<Badge variant="warning" className="mx-1">演示</Badge>模拟：点击下方按钮即视为授权成功。
              </div>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}
              <Button
                type="button"
                className="w-full"
                disabled={loading}
                onClick={() => handleProvider(method as "qq" | "wechat")}
              >
                {method === "qq" ? (
                  <MessagesSquare className="h-4 w-4" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                {loading ? "授权中…" : `使用${method === "qq" ? "QQ" : "微信"}登录`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        {method === "email"
          ? "密码经 bcrypt 加密存储，会话以 HttpOnly Cookie 保护"
          : "手机号 / QQ / 微信 为演示登录，真实接入需补充密钥与服务端"}
      </p>
    </div>
  );
}
