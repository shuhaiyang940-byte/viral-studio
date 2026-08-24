"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setResult({ ok: false, message: "密码至少 6 位" });
      return;
    }
    if (password.length > 72) {
      setResult({ ok: false, message: "密码最长 72 位" });
      return;
    }
    if (password !== confirm) {
      setResult({ ok: false, message: "两次输入的密码不一致" });
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setResult({ ok: false, message: "缺少重置令牌，请从邮件中的链接进入" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error || "重置失败，请重试" });
        return;
      }
      setResult({ ok: true, message: "密码已重置，请用新密码登录。" });
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
          <h1 className="text-xl font-bold">设置新密码</h1>
          <p className="mt-2 text-sm text-muted-foreground">重置成功后，所有设备的登录会话都会失效，请使用新密码重新登录。</p>

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
                {result.ok ? "完成" : "出问题了"}
              </div>
              <p className="mt-1.5">{result.message}</p>
              {result.ok && (
                <Button asChild variant="gradient" size="sm" className="mt-4">
                  <Link href="/login">去登录</Link>
                </Button>
              )}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">新密码（至少 6 位）</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">确认新密码</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" variant="gradient" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              重置密码
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
