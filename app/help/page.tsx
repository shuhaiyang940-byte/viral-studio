"use client";

import * as React from "react";
import Link from "next/link";
import {
  HelpCircle,
  Rocket,
  Search,
  ShieldCheck,
  CreditCard,
  Lock,
  Sparkles,
  Target,
  Heading,
  Crown,
  Mail,
  ChevronDown,
  BookOpen,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    icon: Rocket,
    title: "填写创作档案（30 秒）",
    desc: "告诉我们你的剪辑基础和内容方向，报告会按你的情况定制。可在「我的」随时修改。",
    href: "/onboarding",
    cta: "去填写",
  },
  {
    icon: Search,
    title: "分析一个视频",
    desc: "进入 AI 分析页，上传 MP4 或粘贴抖音 / 小红书等平台链接，AI 自动拆解。",
    href: "/analyze",
    cta: "去分析",
  },
  {
    icon: Sparkles,
    title: "看报告，照着做",
    desc: "拿到评分、结构拆解、可复制模板与高级模块建议，直接照搬到你的创作里。",
    href: "/library",
    cta: "看案例",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "怎么分析一个视频？",
    a: "进入「AI 分析」页，粘贴抖音 / 小红书等平台视频链接（或标题）。系统会生成《爆款导演拆解报告》：爆款评分（传播 / 完播 / 互动 / 商业）、黄金 3 秒拆解、视频结构拆解、情绪曲线、爆款公式提炼，以及可复制的模板与拍摄建议。免费版仅展示第一段「爆款评分体系」，完整六段拆解在会员版解锁。",
  },
  {
    q: "免费版和会员有什么区别？",
    a: "免费版：每天 1 次分析、基础版报告（爆款评分 + 核心亮点）、浏览案例库与爆款公式库。创作者版：每日 5 次分析、完整版《爆款导演拆解报告》（六段：评分 / 黄金 3 秒 / 结构 / 情绪曲线 / 公式 / 可复制）、爆款公式库全量查阅、AI 写文案。进阶版与专业版在创作者版基础上叠加更高配额，并把「爆款复刻助手」「我的 AI 导演」「账号诊断」等能力列入开发路线（规划中）。完整对比见「价格」页。",
  },
  {
    q: "微信登录安全吗？我的数据存在哪？",
    a: "当前为 MVP Demo，登录是模拟的微信扫码（Mock），不连接真实微信、不收集任何真实凭证。你的创作档案与分析记录默认只存在浏览器本地。真实上线版会走微信开放平台 + 自家用户表 + JWT 会话（见「价格 / 帮助」中的安全说明），密钥不落地前端。",
  },
  {
    q: "升级会员会真实扣费吗？",
    a: "不会。当前所有支付都是「占位页」演示，点击「模拟支付成功」仅用于在本地会话解锁对应会员能力，不产生任何真实交易。真实支付需接入微信支付 / 支付宝商户号后才会启用。",
  },
  {
    q: "为什么免费版看不到完整的拆解报告？",
    a: "完整报告共六段：爆款评分、黄金 3 秒拆解、视频结构拆解、情绪曲线、爆款公式提炼、可复制分析。免费版仅展示第一段「爆款评分体系」，其余五段与精品化建议属于会员专属能力，升级后解锁真实内容——你也可以先免费体验评分，再决定是否升级。",
  },
  {
    q: "分析报告是 AI 真实生成的吗？",
    a: "当前 Demo 的分析结果由规则引擎模拟生成，用于完整演示产品形态与交互。真实 AI 能力（视频感知 + 推理）计划在接入对应模型密钥后启用，届时会替换模拟数据。",
  },
  {
    q: "为什么微信登录后还要绑定手机号？",
    a: "这是「双重注册」的合规要求：根据《网络安全法》《互联网用户账号信息管理规定》等，账号需绑定手机号。微信授权后我们会引导你补全手机号，未绑定也能继续体验（演示便利性），但真实环境会按合规要求强制绑定。",
  },
  {
    q: "能切换或退订会员方案吗？",
    a: "可在「我的」页面查看当前会员状态。真实环境支持按月 / 年切换与退订（含退款规则），这部分待支付与账户系统接入后开放。",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="text-sm font-medium text-foreground/90">{q}</span>
        <ChevronDown
          className={
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
            (open ? "rotate-180" : "")
          }
        />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {a}
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  { icon: Target, title: "爆款导演拆解报告", desc: "AI 模拟资深导演，输出评分与六段拆解，说清为什么火。", tier: "创作者版" },
  { icon: BookOpen, title: "爆款公式库", desc: "从真实案例提炼可复制公式，按赛道查阅与收藏。", tier: "进阶版" },
  { icon: Sparkles, title: "一键复刻我的版本", desc: "选好你的行业，AI 生成标题 / 脚本 / 分镜方案。开发中，敬请期待。", tier: "进阶版", soon: true },
  { icon: Crown, title: "我的 AI 导演", desc: "结合你的账号档案长期优化定位与内容方向。开发中，敬请期待。", tier: "专业版", soon: true },
];

export default function HelpPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[600px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
          <Badge variant="secondary" className="mb-4 gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-primary" /> 帮助中心
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">有问题，先来这看看</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            从快速上手到账号计费，常见疑问都在这里。找不到答案，文末可以直接联系我们。
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        {/* 快速开始 */}
        <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
          <Rocket className="h-5 w-5 text-primary" /> 快速开始
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <Card key={s.title}>
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {s.desc}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-3 h-auto justify-start p-0">
                  <Link href={s.href}>{s.cta} →</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 功能速览 */}
        <h2 className="mb-5 mt-12 flex items-center gap-2 text-xl font-bold">
          <BookOpen className="h-5 w-5 text-primary" /> 功能速览
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardContent className="flex items-start gap-3 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    {f.soon ? (
                      <Badge variant="warning" className="text-[10px]">
                        规划中
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        {f.tier}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 常见问题 */}
        <h2 className="mb-5 mt-12 flex items-center gap-2 text-xl font-bold">
          <HelpCircle className="h-5 w-5 text-primary" /> 常见问题
        </h2>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>

        {/* 安全与计费提示 */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
            <div className="text-sm">
              <p className="font-medium">安全与隐私</p>
              <p className="mt-1 text-muted-foreground">
                演示数据仅存浏览器本地；真实登录走微信开放平台 + JWT，密钥不落地前端。
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <CreditCard className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-medium">关于计费</p>
              <p className="mt-1 text-muted-foreground">
                当前为演示，支付不真实扣费；真实支付需接入微信支付 / 支付宝商户号。
              </p>
            </div>
          </div>
        </div>

        {/* 联系我们 */}
        <div className="mt-10 rounded-2xl border border-border bg-muted/20 p-6 text-center">
          <h3 className="flex items-center justify-center gap-2 text-lg font-semibold">
            <Mail className="h-5 w-5 text-primary" /> 还没解决？联系我们
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            商务合作、媒体咨询或功能建议，都可以发邮件。我们会在工作日回复。
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline">
              <a href="mailto:hello@viralstudio.ai">
                <Mail className="h-4 w-4" /> hello@viralstudio.ai
              </a>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/pricing">
                <Smartphone className="h-4 w-4" /> 查看会员方案
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
