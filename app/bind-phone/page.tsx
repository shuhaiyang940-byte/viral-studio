"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, ShieldCheck, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useSession, bindPhone } from "@/lib/auth";

export default function BindPhonePage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sentCode, setSentCode] = React.useState("");
  const [countdown, setCountdown] = React.useState(0);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [redirectTo, setRedirectTo] = React.useState("/onboarding");

  // 读 ?redirect=，防止开放重定向
  React.useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("redirect");
    if (r && r.startsWith("/") && !r.startsWith("//")) setRedirectTo(r);
  }, []);

  // 未登录 → 去登录；已绑手机 → 跳目标
  React.useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent("/bind-phone")}`);
      return;
    }
    if (session.phone) {
      const r = new URLSearchParams(window.location.search).get("redirect");
      router.replace(r && r.startsWith("/") && !r.startsWith("//") ? r : "/profile");
    }
  }, [loading, session, router]);

  function sendCode() {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请先输入有效的手机号");
      return;
    }
    setError("");
    // 演示：本地生成一个 6 位码展示出来，真实环境应调用短信网关下发
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

  async function handleSubmit(e: React.FormEvent) {
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
    setSubmitting(true);
    try {
      await bindPhone(phone);
      router.replace(redirectTo);
    } catch {
      setError("绑定失败，请重试");
      setSubmitting(false);
    }
  }

  if (loading || !session || session.phone) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
        <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          爆款研究所
        </Link>
        <h1 className="mt-6 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" /> 绑定手机号
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          为保障账号安全，所有登录方式都需绑定手机号。
        </p>
      </div>

      <Card className="mt-8">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="relative flex-1">
                  <Input
                    className="pl-3"
                    type="tel"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 位验证码"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={sendCode}
                  disabled={countdown > 0}
                  className="shrink-0"
                >
                  {countdown > 0 ? `${countdown}s` : "发送验证码"}
                </Button>
              </div>
              {sentCode && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  演示环境：验证码已生成为 <span className="font-mono font-semibold text-foreground">{sentCode}</span>（真实环境由短信下发）
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "绑定中…" : "验证并绑定"}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        演示环境：短信验证码为本地模拟，未真实下发
      </p>
    </div>
  );
}
