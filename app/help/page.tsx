"use client";

import * as React from "react";
import Link from "next/link";
import { BETA_OPEN } from "@/lib/beta";
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
    a: "进入「AI 分析」页：上传视频会真实抽取画面帧并做视觉理解（需要运行环境已安装 ffmpeg），粘贴链接 / 填写标题则基于公开信号与 AI 推断。系统生成《爆款导演拆解报告》：爆款评分、黄金 3 秒、结构拆解、情绪曲线、爆款公式、可复制分析、分镜拆解（一镜一镜怎么拍）、主题适配（换成你的主题怎么拍），共 8 段。",
  },
  {
    q: "免费版和会员有什么区别？",
    a: "当前处于 Beta 免费公测：核心创作功能全部免费开放，无需付费。正式会员上线后，会按「免费体验 → 会员解锁完整报告」的方式运行，届时会提前公告。",
  },
  {
    q: "微信登录安全吗？我的数据存在哪？",
    a: "邮箱账号走真实服务端：密码 bcrypt 加密、会话 HttpOnly Cookie、验证邮件与找回密码已上线。手机号 / QQ / 微信登录目前是演示入口，不会收集真实凭证。正式创作资产（分析报告、分镜、拍摄计划、历史）保存在账号云端，登录后跨设备可访问；浏览器本地仅作缓存。",
  },
  {
    q: "升级会员会真实扣费吗？",
    a: "不会。当前为 Beta 免费公测，所有「支付页」均为占位展示，不做真实扣费。正式收费前会接入真实支付通道并提前公告。",
  },
  {
    q: "为什么我能看到完整的拆解报告？",
    a: "因为当前是免费公测阶段，完整 8 段报告全站免费开放。正式会员上线后，完整深度报告将归入会员权益，届时会提前公告。",
  },
  {
    q: "分析报告是 AI 真实生成的吗？",
    a: "上传视频模式会真实抽取画面帧并调用视觉模型理解画面（报告中会标注「已真实理解 N 帧」）；未配置视觉模型或纯链接 / 标题模式时，分析基于 AI 推断生成。报告页会如实标注本次分析的依据，不会拿演示数据冒充真实结论。",
  },
  {
    q: "怎么验证邮箱？忘记密码怎么办？",
    a: "注册后可在「个人中心 → 账号安全」查看验证状态并重发验证邮件；登录页有「忘记密码？」入口，输入注册邮箱后会收到重置链接。验证链接与重置链接 24 小时内有效。",
  },
  {
    q: "怎么删除我的账号和数据？",
    a: "发送邮件至 hello@viralstudio.ai 并注明注册邮箱，我们会在 15 个工作日内删除账号及相关数据。正式创作资产保存在账号云端，删除账号即一并清除；浏览器本地缓存可随时在浏览器设置中清除（不影响云端资产）。",
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
  { icon: Sparkles, title: "一键复刻我的版本", desc: "选好你的行业，AI 一键生成标题 / 脚本 / 分镜，直接开拍。", tier: "进阶版" },
  { icon: Crown, title: "我的 AI 导演", desc: "结合你的账号档案，给出定位诊断与本周内容规划。", tier: "专业版" },
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
                    <Badge variant="outline" className="text-[10px]">
                      {f.tier}
                    </Badge>
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
                正式创作资产保存在云端账号；浏览器本地仅作缓存，密钥不落地前端。
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <CreditCard className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-medium">关于计费</p>
              <p className="mt-1 text-muted-foreground">
                {BETA_OPEN
                  ? "Beta 公测期间无需付费，当前不接入真实支付。"
                  : "当前为演示，支付不真实扣费；真实支付需接入微信支付 / 支付宝商户号。"}
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
                <Smartphone className="h-4 w-4" /> {BETA_OPEN ? "了解 Beta 公测" : "查看会员方案"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
