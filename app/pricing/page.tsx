"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Minus,
  Crown,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MEMBERSHIP,
  ANNUAL,
  PRICING_MATRIX,
  PRICING_GROUPS,
  type PlanTier,
  type PricingCell,
} from "@/lib/mock-data";
import { useSession } from "@/lib/auth";
import { BETA_OPEN } from "@/lib/beta";

type Billing = "monthly" | "yearly";

function Cell({ value }: { value: PricingCell }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-success" />
    ) : (
      <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
    );
  }
  return <span className="text-xs font-medium text-foreground/90">{value}</span>;
}

function MemberPricing() {
  const [billing, setBilling] = React.useState<Billing>("monthly");
  const { session } = useSession();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  function priceFor(tier: PlanTier): { price: string; period: string; note?: string } {
    if (billing === "yearly") {
      const a = ANNUAL[tier];
      return { price: a.price, period: "年", note: a.save };
    }
    const plan = MEMBERSHIP.find((m) => m.tier === tier)!;
    return { price: plan.price, period: plan.period };
  }

  function ctaHrefFor(tier: PlanTier): string {
    const plan = MEMBERSHIP.find((m) => m.tier === tier)!;
    if (tier === "free") return plan.ctaHref;
    // 付费档：未登录先去登录，登录后跳支付占位
    const pay = plan.ctaHref; // /payment?tier=xxx
    if (mounted && session) return pay;
    return `/login?redirect=${encodeURIComponent(pay)}`;
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
          <Badge variant="secondary" className="mb-4 gap-1.5">
            <Crown className="h-3.5 w-3.5 text-primary" /> 会员方案
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            为「想做出爆款」的人，提供不同深度的导演能力
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            免费版每天 1 次爆款拆解先体验。创作者版解锁完整报告与 AI 写文案；进阶版解锁无限分析、爆款复刻、
            AI 导演与三段流水线（爆款搬运）；专业版再加账号诊断与长期陪跑。创意选题库、账号诊断、手机扫码提词器均已上线。
          </p>

          {/* 月付 / 年付切换 */}
          <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1">
            {(
              [
                { id: "monthly", label: "月付" },
                { id: "yearly", label: "年付（省 2 个月）" },
              ] as const
            ).map((b) => (
              <button
                key={b.id}
                onClick={() => setBilling(b.id)}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                  (billing === b.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 套餐卡 */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {MEMBERSHIP.map((m) => {
            const p = priceFor(m.tier);
            return (
              <Card
                key={m.tier}
                className={
                  m.featured
                    ? "relative border-primary shadow-lg shadow-primary/10"
                    : "border-border/70"
                }
              >
                {m.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1">推荐</Badge>
                  </div>
                )}
                <CardContent className="flex h-full flex-col p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{m.name}</h3>
                    <div className="flex items-center gap-1.5">
                      {m.comingSoon && (
                        <Badge variant="warning" className="gap-1">
                          <Info className="h-3 w-3" /> 功能完善中
                        </Badge>
                      )}
                      {m.tier !== "free" && !m.comingSoon && (
                        <Crown
                          className={
                            "h-5 w-5 " + (m.featured ? "text-primary" : "text-muted-foreground")
                          }
                        />
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.tagline}</p>

                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">¥{p.price}</span>
                    <span className="mb-1 text-sm text-muted-foreground">/ {p.period}</span>
                  </div>
                  {p.note && (
                    <p className="mt-1 text-xs font-medium text-success">{p.note}</p>
                  )}
                  {m.comingSoon && (
                    <p className="mt-1 text-xs font-medium text-warning">即将开放 · 当前最高可开通档位：普通会员</p>
                  )}

                  {m.comingSoon ? (
                    <Button className="mt-5 w-full" variant="outline" disabled>
                      <Info className="h-4 w-4" /> 功能完善中
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="mt-5 w-full"
                      variant={m.featured ? "gradient" : "outline"}
                    >
                      <Link href={ctaHrefFor(m.tier)}>{m.cta}</Link>
                    </Button>
                  )}

                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {m.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span className="text-foreground/90">{h}</span>
                      </li>
                    ))}
                  </ul>

                  {m.roadmap && m.roadmap.length > 0 && (
                    <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" /> 规划中（即将推出）
                      </p>
                      <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                        {m.roadmap.map((r) => (
                          <li key={r} className="flex items-start gap-2">
                            <span className="mt-0.5 leading-none">·</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mx-auto mt-6 flex max-w-2xl items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          演示模式：点击付费档会进入「会员支付占位页」，不会真实扣费，仅用于展示升级后的解锁效果。真实支付需接入微信支付 / 支付宝商户号（需营业执照），当前尚未接入。
        </p>
      </section>

      {/* 功能对比矩阵 */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">功能对比</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            同一套能力，按档位逐步开放；标注「规划中」的功能正在开发中，上线后自动对对应档位开放
          </p>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background px-4 py-3 text-left font-semibold text-muted-foreground">
                  功能
                </th>
                {MEMBERSHIP.map((m) => (
                  <th
                    key={m.tier}
                    className={
                      "px-4 py-3 text-center font-semibold " +
                      (m.featured ? "text-primary" : "text-foreground")
                    }
                  >
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRICING_GROUPS.map((group) => (
                <React.Fragment key={group}>
                  <tr>
                    <td
                      colSpan={4}
                      className="bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {group}
                    </td>
                  </tr>
                  {PRICING_MATRIX.filter((r) => r.group === group).map((r) => (
                    <tr key={r.label} className="border-t border-border">
                      <td className="sticky left-0 z-10 bg-background px-4 py-3 text-left text-foreground/90">
                        {r.label}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Cell value={r.free} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Cell value={r.creator} />
                      </td>
                      <td className="bg-primary/[0.03] px-4 py-3 text-center">
                        <Cell value={r.pro} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Cell value={r.studio} />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="max-w-xl text-sm text-muted-foreground">
            还在纠结？免费版每天 1 次分析先上手，觉得有用再升级——随时可在「我的」页面切换方案。
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="gradient">
              <Link href="/analyze">
                <Sparkles className="h-4 w-4" /> 免费体验一次
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/help">
                <ShieldCheck className="h-4 w-4" /> 常见问题
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Beta 公测说明页：不展示价格、不提供购买，只表达「限时免费公测」 */
function BetaPricing() {
  const { session } = useSession();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <Badge variant="secondary" className="mb-4 gap-1.5">
            <Crown className="h-3.5 w-3.5 text-primary" /> 限时免费公测
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            核心创作功能，Beta 公测期间全部免费
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            现在无需注册任何会员，即可免费体验完整的创作流程：从爆款分析，到脚本、分镜、拍摄计划，再到导出。
          </p>
        </div>
      </section>

      {/* 当前免费开放清单 */}
      <section className="mx-auto w-full max-w-4xl px-4 sm:px-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-8">
            <h2 className="text-xl font-bold">当前 Beta 免费开放</h2>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                "爆款分析（评分 / 黄金3秒 / 结构 / 情绪曲线）",
                "完整分析报告（含深度拆解）",
                "AI 脚本生成",
                "完整分镜表（一镜一镜怎么拍）",
                "拍摄计划",
                "导出（提词器 / 分镜表 / 剪映草稿）",
                "历史创作（云保存，跨设备继续）",
                "创意选题库 / 对标挖掘 / 账号诊断",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-lg bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              不需要付费，也不需要购买会员。Beta 公测期间，这些能力对你完全开放。
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 未来会员方案规划（不展示价格 / 不提供购买） */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">未来会员方案（规划中）</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            以下为正式收费后的方案规划，目前<strong className="text-foreground">尚未开放购买</strong>。
            Beta 公测期间无需付费，正式价格与权益以 Beta 结束后的公告为准。
          </p>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MEMBERSHIP.map((m) => (
            <Card key={m.tier} className="border-border/70">
              <CardContent className="flex h-full flex-col p-6">
                <h3 className="text-lg font-bold">{m.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant={m.tier === "free" ? "success" : "secondary"}>
                    {m.tier === "free" ? "长期免费" : "即将推出"}
                  </Badge>
                </div>
                <Button className="mt-5 w-full" variant="outline" disabled>
                  即将推出
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Button asChild size="lg" variant="gradient" className="gap-2">
            <Link href="/studio">
              <Sparkles className="h-4 w-4" /> 立即免费体验
            </Link>
          </Button>
          {mounted && session && (
            <p className="text-xs text-muted-foreground">
              当前已登录：{session.name} · Beta 期间无需额外开通
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function PricingPage() {
  return BETA_OPEN ? <BetaPricing /> : <MemberPricing />;
}
