"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ShieldCheck,
  CreditCard,
  ArrowLeft,
  Sparkles,
  Crown,
  Lock,
  Smartphone,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MEMBERSHIP, type PlanTier } from "@/lib/mock-data";
import { useSession, refreshSession } from "@/lib/auth";

type PayMethod = "wechat" | "alipay";

/** 模拟支付二维码（纯演示，不可扫描） */
function FakeQR({ brand }: { brand: PayMethod }) {
  const cells = 21;
  const dots = React.useMemo(() => {
    let seed = brand === "wechat" ? 20260805 : 668855;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: cells * cells }, () => rng() > 0.5);
  }, [brand]);

  const center =
    brand === "wechat" ? (
      <span className="text-lg font-bold">微</span>
    ) : (
      <CreditCard className="h-5 w-5" />
    );

  return (
    <div className="relative mx-auto w-[180px] rounded-lg bg-white p-3 shadow-sm">
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
      {/* 三个定位角 */}
      <div className="absolute left-3 top-3 h-8 w-8 rounded-[5px] border-[5px] border-neutral-900" />
      <div className="absolute right-3 top-3 h-8 w-8 rounded-[5px] border-[5px] border-neutral-900" />
      <div className="absolute bottom-3 left-3 h-8 w-8 rounded-[5px] border-[5px] border-neutral-900" />
      {/* 中间品牌块 */}
      <div
        className={
          "absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md text-white " +
          (brand === "wechat" ? "bg-[#07c160]" : "bg-[#1677ff]")
        }
      >
        {center}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const router = useRouter();
  const [tier, setTier] = React.useState<PlanTier>("pro");
  const [method, setMethod] = React.useState<PayMethod>("wechat");
  const { session } = useSession();
  const [mounted, setMounted] = React.useState(false);
  const [paid, setPaid] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tier");
      if (t === "free" || t === "creator" || t === "pro" || t === "studio") setTier(t);
    }
  }, []);

  const plan = MEMBERSHIP.find((m) => m.tier === tier) ?? MEMBERSHIP[1];

  /**
   * 只改前端 localStorage 是没用的：useSession 挂载时会回读 /api/auth/me，
   * 服务端等级仍是 free，本地假升级会被立刻冲掉。所以必须让服务端也改，
   * 而服务端那个接口默认关闭（ALLOW_DEMO_UPGRADE=1 才开），关着时如实报错。
   */
  async function handlePay() {
    if (paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch("/api/billing/demo-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPayError(d.error || "开通失败，请稍后重试");
        return;
      }
      await refreshSession();
      setPaid(true);
      setTimeout(() => router.push("/profile"), 900);
    } catch {
      setPayError("网络异常，请检查连接后重试");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/pricing"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> 返回方案
      </Link>

      {/* 演示横幅 */}
      <div className="mb-6 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground/90">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        演示模式：这是「会员支付占位页」，不会真实扣费。点击「模拟支付成功」仅用于在本地会话解锁对应会员能力。真实支付需接入微信支付 / 支付宝商户号。
      </div>

      {/* 免费档无需支付 */}
      {mounted && tier === "free" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">免费版无需支付</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                免费版永久免费，每天 1 次分析，直接体验即可。
              </p>
            </div>
            <Button asChild variant="gradient">
              <Link href="/analyze">去免费分析</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 未登录：先登录 */}
      {mounted && tier !== "free" && !plan.comingSoon && !session && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Lock className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">请先登录再开通会员</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                会员权益与你的账号绑定，登录后即可支付开通。
              </p>
            </div>
            <Button asChild variant="gradient">
              <Link href={`/login?redirect=${encodeURIComponent(`/payment?tier=${tier}`)}`}>
                去登录
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 已是该会员 */}
      {mounted && tier !== "free" && !plan.comingSoon && session && session.tier === tier && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Crown className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">你已是{tier === "pro" ? "普通" : "高级"}会员</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                该会员权益已生效，可在「我的」页面查看。
              </p>
            </div>
            <Button asChild variant="gradient">
              <Link href="/profile">前往个人中心</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 功能完善中（如高级会员，暂未开放） */}
      {mounted && plan.comingSoon && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
              <Info className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">会员功能正在完善中</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                「{plan.name}」暂未开放。当前最高可开通档位为「普通会员」，可直接升级体验完整分析能力与三大高级模块。
              </p>
            </div>
            <Button asChild variant="gradient">
              <Link href="/payment?tier=pro">前往开通普通会员</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 支付主流程 */}
      {mounted && tier !== "free" && !plan.comingSoon && session && session.tier !== tier && (
        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
          {/* 左：订单摘要 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold">订单确认</h1>
                <Badge variant="secondary">会员开通</Badge>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                <Crown className="h-4 w-4 text-primary" /> {plan.name}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-muted-foreground">应付</span>
                  <span className="text-2xl font-extrabold">
                    ¥{plan.price}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">
                      / {plan.period}
                    </span>
                  </span>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span className="text-foreground/90">{h}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* 右：扫码支付 */}
          <Card>
            <CardContent className="flex h-full flex-col p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="h-4 w-4 text-primary" /> 扫码支付
              </div>

              {/* 支付方式切换 */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "wechat", label: "微信支付", color: "bg-[#07c160]" },
                    { id: "alipay", label: "支付宝", color: "bg-[#1677ff]" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={
                      "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors " +
                      (method === m.id
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                  >
                    <span className={"h-2.5 w-2.5 rounded-full " + m.color} />
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-3">
                <FakeQR brand={method} />
                <p className="text-xs text-muted-foreground">
                  请使用{method === "wechat" ? "微信" : "支付宝"}扫码（演示二维码，无需真实支付）
                </p>
              </div>

              {paid ? (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-success/10 py-3 text-sm font-medium text-success">
                  <Check className="h-4 w-4" /> 支付成功，正在开通…
                </div>
              ) : (
                <>
                  <Button
                    onClick={handlePay}
                    disabled={paying}
                    className="mt-3 w-full gap-2"
                    variant="gradient"
                  >
                    <Check className="h-4 w-4" /> {paying ? "开通中…" : "模拟支付成功（演示）"}
                  </Button>
                  {payError && (
                    <p role="alert" className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
                      {payError}
                    </p>
                  )}
                </>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> 真实环境将加密传输，绝不存储你的支付密码
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
