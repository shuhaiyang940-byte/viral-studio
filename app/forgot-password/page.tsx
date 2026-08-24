"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, Loader2, CheckCircle2, AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
    devLink?: string;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error || "请求失败，请重试" });
        return;
      }
      setResult({ ok: true, message: data.message || "重置链接已发送，请查收。", devLink: data.devLink });
    } catch {
      setResult({ ok: false, message: "网络异常，请稍后重试" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Card>
        <CardContent className="p-8">
          <Link
            href="/login"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> 返回登录
          </Link>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">找回密码</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            输入注册邮箱，我们会发送一封重置链接（24 小时内有效）。如果你不确定是否注册过，也可以照常提交，结果不会泄露邮箱状态。
          </p>

          {result && (
            <div
              className={
                "mt-6 rounded-lg border p-4 text-sm " +
                (result.ok
                  ? "border-success/30 bg-success/5 text-foreground/90"
                  : "border-destructive/30 bg-destructive/5 text-foreground/90")
              }
            >
              <div className={"flex items-center gap-2 font-medium " + (result.ok ? "text-success" : "text-destructive")}>
                {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {result.ok ? "已发送" : "出问题了"}
              </div>
              <p className="mt-1.5">{result.message}</p>
              {result.devLink && (
                <a href={result.devLink} className="mt-2 inline-flex items-center gap-1 break-all text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> 开发模式链接（上线后不会出现）
                </a>
              )}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">注册邮箱</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="gradient" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              发送重置链接
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
