"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, CheckCircle2, AlertTriangle, Loader2, Send, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { refreshSession } from "@/lib/auth";

type State =
  | { status: "idle" }
  | { status: "working"; message: string }
  | { status: "ok"; message: string; devLink?: string }
  | { status: "error"; message: string; devLink?: string };

export default function VerifyEmailPage() {
  const [state, setState] = React.useState<State>({ status: "idle" });
  const [email, setEmail] = React.useState("");

  async function verify(token: string) {
    setState({ status: "working", message: "正在验证邮箱…" });
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: "error", message: data.error || "验证失败，请重试" });
        return;
      }
      await refreshSession().catch(() => null);
      setState({ status: "ok", message: "邮箱验证成功，感谢你的确认。" });
    } catch {
      setState({ status: "error", message: "网络异常，请稍后重试" });
    }
  }

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const em = params.get("email");
    if (em) setEmail(em);
    if (token) void verify(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setState({ status: "error", message: "请输入有效的邮箱地址" });
      return;
    }
    setState({ status: "working", message: "正在发送验证邮件…" });
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: "error", message: data.error || "发送失败，请重试" });
        return;
      }
      setState({
        status: "ok",
        message: data.message || "验证邮件已发送，请查收（含垃圾邮件箱）。",
        devLink: data.devLink,
      });
    } catch {
      setState({ status: "error", message: "网络异常，请稍后重试" });
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Card>
        <CardContent className="p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">邮箱验证</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            验证邮箱可以确认账号归属、找回密码，也是账号安全的基础。验证链接 24 小时内有效。
          </p>

          {state.status === "working" && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {state.message}
            </div>
          )}

          {state.status === "ok" && (
            <div className="mt-6 rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-foreground/90">
              <div className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> 成功
              </div>
              <p className="mt-1.5">{state.message}</p>
              {state.devLink && (
                <div className="mt-3 rounded-md bg-background p-2.5 text-xs text-muted-foreground">
                  <div className="font-medium">开发模式链接（上线后不会出现）：</div>
                  <a href={state.devLink} className="mt-1 inline-flex items-center gap-1 break-all text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> {state.devLink}
                  </a>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button asChild variant="gradient" size="sm">
                  <Link href="/profile">去个人中心</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/analyze">去分析</Link>
                </Button>
              </div>
            </div>
          )}

          {state.status === "error" && (
            <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground/90">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" /> 出问题了
              </div>
              <p className="mt-1.5">{state.message}</p>
              {state.devLink && (
                <a href={state.devLink} className="mt-2 inline-flex items-center gap-1 break-all text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> 开发模式链接
                </a>
              )}
            </div>
          )}

          <form onSubmit={resend} className="mt-6 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">邮箱</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="outline" className="w-full gap-2" disabled={state.status === "working"}>
              <Send className="h-4 w-4" /> 重新发送验证邮件
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
