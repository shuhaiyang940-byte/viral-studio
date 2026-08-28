"use client";

import * as React from "react";
import { Loader2, MessageSquare, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { login, register, type Session } from "@/lib/auth";

/**
 * 登录 / 注册弹窗（全局可复用）。
 * 目的：任何「需要登录才有完整体验」的功能被触发时，就地弹窗让用户登录/注册，
 * 登录成功后关闭弹窗、回到原页面（不跳首页），并回传登录态给调用方。
 */
export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: (s: Session) => void;
}) {
  const [tab, setTab] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setLoading(true);
    try {
      const s =
        tab === "login"
          ? await login(email, password)
          : await register(email, password, name.trim() || undefined);
      onSuccess?.(s);
      onOpenChange(false);
      setPassword("");
      setEmail("");
      setName("");
    } catch (e: any) {
      setError(e?.message || (tab === "login" ? "登录失败" : "注册失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{tab === "login" ? "欢迎回来" : "创建账号"}</DialogTitle>
          <DialogDescription>
            {tab === "login"
              ? "登录后你填写的账号信息会自动保存，下次诊断更省事。"
              : "注册只需邮箱 + 密码，一步即可开始。"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-2">
            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  autoComplete="email"
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  autoComplete="current-password"
                  className="pl-9"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                {loading ? "登录中…" : "登录"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register" className="mt-2">
            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  autoComplete="email"
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="昵称（选填）"
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码（至少 6 位）"
                  autoComplete="new-password"
                  className="pl-9"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                {loading ? "注册中…" : "注册并登录"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
