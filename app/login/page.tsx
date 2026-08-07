"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ShieldCheck,
  ArrowRight,
  Lock,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { login, register, bindPhone } from "@/lib/auth";

/** 简易「假二维码」：用确定性的点阵摆出 QR 的样子（纯演示，不可扫描） */
function FakeQR() {
  const cells = 23;
  const dots: boolean[] = React.useMemo(() => {
    // 用固定种子生成稳定图案，避免每次渲染抖动
    let seed = 20260805;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: cells * cells }, () => rng() > 0.5);
  }, []);

  return (
    <div className="relative mx-auto w-[200px] rounded-lg bg-white p-3 shadow-sm">
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cells}, 1fr)` }}
      >
        {dots.map((on, i) => (
          <div
            key={i}
            className={on ? "bg-neutral-900" : "bg-white"}
            style={{ aspectRatio: "1 / 1" }}
          />
        ))}
      </div>
      {/* 三个定位角，更像真的二维码 */}
      <div className="absolute left-3 top-3 h-9 w-9 rounded-[6px] border-[6px] border-neutral-900" />
      <div className="absolute right-3 top-3 h-9 w-9 rounded-[6px] border-[6px] border-neutral-900" />
      <div className="absolute bottom-3 left-3 h-9 w-9 rounded-[6px] border-[6px] border-neutral-900" />
      {/* 微信绿底 logo 盖在中间 */}
      <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-[#07c160] text-white shadow">
        <WeChatMark className="h-6 w-6" />
      </div>
    </div>
  );
}

function WeChatMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8.6 4C4.9 4 2 6.6 2 9.8c0 1.8 1 3.4 2.6 4.5L3.8 16l2.3-1.2c.8.2 1.6.3 2.5.3.2 0 .4 0 .6-.03-.2-.6-.3-1.2-.3-1.9 0-3 2.7-5.4 6-5.4.2 0 .4 0 .6.03C14.9 5.9 12 4 8.6 4Zm-2.2 3.2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9Zm4.3 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9Z" />
      <path d="M22 14.2c0-2.8-2.7-5.1-6-5.1s-6 2.3-6 5.1 2.7 5.1 6 5.1c.7 0 1.4-.1 2-.3l1.9 1-.5-1.7c1.6-.9 2.6-2.3 2.6-3.9Zm-8-1.2c.4 0 .8.3.8.8s-.4.8-.8.8-.8-.3-.8-.8.4-.8.8-.8Zm4 0c.4 0 .8.3.8.8s-.4.8-.8.8-.8-.3-.8-.8.4-.8.8-.8Z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [scanning, setScanning] = React.useState(false);
  const [scanned, setScanned] = React.useState(false);
  const [nickname, setNickname] = React.useState("");
  const [redirect, setRedirect] = React.useState("/analyze");

  // 双重注册：微信登录后补绑手机号
  const [phoneOpen, setPhoneOpen] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeSent, setCodeSent] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const [phoneError, setPhoneError] = React.useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const r = new URLSearchParams(window.location.search).get("redirect");
      if (r) setRedirect(r);
    }
  }, []);

  function openScan() {
    setScanning(true);
    setScanned(false);
  }

  function finishScan() {
    // 模拟微信授权回调：登录复用旧会话，注册新建账号（首扫即注册）
    const session = mode === "register" ? register(nickname) : login();
    setScanned(true);
    setTimeout(() => {
      const target = redirect && redirect.startsWith("/") ? redirect : "/analyze";
      if (!session.phone) {
        // 双重注册：微信登录后补绑手机号（法规要求）
        setScanning(false);
        setPhoneOpen(true);
      } else {
        router.push(target);
      }
    }, 650);
  }

  function proceed() {
    const target = redirect && redirect.startsWith("/") ? redirect : "/analyze";
    router.push(target);
  }

  function sendCode() {
    // 演示：不真发短信，直接给出验证码并 60s 倒计时
    if (!/^1\d{10}$/.test(phone)) {
      setPhoneError("请输入有效的 11 位手机号");
      return;
    }
    setPhoneError("");
    setCodeSent(true);
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function completePhone() {
    if (!/^1\d{10}$/.test(phone)) {
      setPhoneError("请输入有效的 11 位手机号");
      return;
    }
    if (code !== "123456") {
      setPhoneError("验证码错误（演示验证码：123456）");
      return;
    }
    bindPhone(phone);
    setPhoneOpen(false);
    proceed();
  }

  function skipPhone() {
    // 演示便利性：暂不绑定也可继续，真实场景应按合规要求强制绑定
    setPhoneOpen(false);
    proceed();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
          爆
        </span>
        爆款研究所
      </Link>

      {/* 模式切换：登录 / 注册（均走微信） */}
      <div className="grid w-full grid-cols-2 gap-2 rounded-lg bg-muted p-1">
        {(
          [
            { id: "login", label: "登录" },
            { id: "register", label: "注册" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={
              "rounded-md py-2 text-sm font-medium transition-colors " +
              (mode === m.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      <Card className="mt-4 w-full">
        <CardContent className="p-6 text-center">
          <h1 className="text-xl font-bold">
            {mode === "login" ? "微信扫码登录" : "微信扫码注册"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "已注册用户扫码即可直接登录"
              : "首次扫码将自动为你创建账号"}
          </p>

          {mode === "register" && (
            <div className="mt-4 text-left">
              <label className="mb-1.5 block text-sm font-medium">
                微信昵称（选填）
              </label>
              <Input
                placeholder="留空则随机生成"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={openScan}
            className="mt-5 w-full gap-2 bg-[#07c160] text-white hover:bg-[#06ad56]"
            size="lg"
          >
            <WeChatMark className="h-5 w-5" />
            {mode === "login" ? "微信扫码登录" : "微信扫码注册"}
          </Button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> 支持微信注册和登录，授权即代表同意用户协议
          </p>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        演示模式：这是模拟的微信登录，不会连接真实微信、不收集任何凭证。
        <br />
        接入真实微信登录需要「微信开放平台」AppID，详见 lib/auth.ts 顶部说明。
      </p>

      {/* 模拟扫码弹窗 */}
      <Dialog open={scanning} onOpenChange={(o) => !scanned && setScanning(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WeChatMark className="h-5 w-5 text-[#07c160]" />
              微信扫码
            </DialogTitle>
            <DialogDescription>
              请使用手机微信扫描下方二维码{mode === "register" ? "完成注册" : "完成登录"}。
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="relative">
              <FakeQR />
              {!scanned && (
                <div className="pointer-events-none absolute inset-3 overflow-hidden rounded">
                  <div className="absolute left-0 right-0 h-10 animate-[scanline_1.8s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-[#07c160]/30 to-transparent" />
                </div>
              )}
            </div>

            {scanned ? (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-success/10 py-3 text-sm font-medium text-success">
                <Check className="h-4 w-4" /> 授权成功，正在进入…
              </div>
            ) : (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                这是模拟二维码，点击下方按钮即可「模拟扫码成功」。
              </p>
            )}
          </div>

          {!scanned && (
            <div className="flex flex-col gap-2">
              <Button
                onClick={finishScan}
                className="w-full gap-2 bg-[#07c160] text-white hover:bg-[#06ad56]"
              >
                <Check className="h-4 w-4" /> 模拟扫码成功
              </Button>
              <Button
                variant="ghost"
                onClick={() => setScanning(false)}
                className="w-full"
              >
                取消
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 双重注册：微信登录后补绑手机号（法规要求） */}
      <Dialog open={phoneOpen} onOpenChange={(o) => !o && skipPhone()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> 绑定手机号
            </DialogTitle>
            <DialogDescription>
              根据《网络安全法》等相关规定，账号需绑定手机号。微信登录后请完成手机号绑定（双重注册）。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div>
              <label className="mb-1.5 block text-sm font-medium">手机号</label>
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                placeholder="请输入 11 位手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">验证码</label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="演示验证码 123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={countdown > 0}
                  onClick={sendCode}
                  className="shrink-0"
                >
                  {countdown > 0 ? `${countdown}s` : codeSent ? "重新获取" : "获取验证码"}
                </Button>
              </div>
              {codeSent && (
                <p className="mt-1.5 text-xs text-muted-foreground">演示验证码已发送：123456</p>
              )}
            </div>
            {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={completePhone} variant="gradient" className="w-full">
              <Check className="h-4 w-4" /> 完成绑定
            </Button>
            <Button variant="ghost" onClick={skipPhone} className="w-full">
              暂不绑定（演示）
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 底部：未登录也能回首页 */}
      <Link
        href="/"
        className="mt-6 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        先随便逛逛 <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      <style>{`@keyframes scanline{0%{transform:translateY(0)}50%{transform:translateY(150px)}100%{transform:translateY(0)}}`}</style>
    </div>
  );
}
