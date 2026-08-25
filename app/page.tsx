"use client";

import Link from "next/link";
import * as React from "react";
import {
  Video,
  Play,
  CloudUpload,
  PenTool,
  Target,
  ArrowRight,
  Check,
  Star,
  Sparkles,
  UserCheck,
  BookOpen,
  Wand2,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BETA_OPEN } from "@/lib/beta";
import { UniversalConverter } from "@/components/universal-converter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RadarChart } from "@/components/radar-chart";
import { SAMPLE_REPORT } from "@/lib/mock-data";
import { getProfile, LEVEL_LABELS } from "@/lib/onboarding";

/* ─── Hero 右侧：报告预览卡（含雷达图）─── */
function ReportPreviewCard() {
  const r = SAMPLE_REPORT;
  const radarData = [
    { label: "开头吸引力", value: r.score.hook },
    { label: "内容价值", value: r.score.value },
    { label: "情绪感染", value: r.score.emotion },
    { label: "互动能力", value: r.score.interaction },
    { label: "可复制性", value: 88 },
  ];

  return (
    <Card className="overflow-hidden border-border/70 shadow-xl shadow-black/5">
      <CardContent className="p-5">
        {/* 标题 */}
        <h3 className="mb-4 text-sm font-semibold">分析报告示例</h3>

        {/* 视频缩略图区域 */}
        <div className="relative mb-4 flex aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900">
          {/* 模拟视频画面内容 */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjI1Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyYzJkMzUiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxYTEyMWEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2EpIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+')] bg-cover opacity-90" />
          {/* 播放按钮 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Play className="ml-1 h-6 w-6 fill-white text-white" />
            </div>
          </div>
          {/* 时长标签 */}
          <Badge className="absolute bottom-2 right-2 bg-black/60 text-white backdrop-blur-sm">
            01:12
          </Badge>
        </div>

        {/* 评分区：左侧分数 + 右侧雷达图 */}
        <div className="flex items-start gap-5">
          <div className="shrink-0 pt-1">
            <p className="text-xs font-medium text-muted-foreground">爆款评分</p>
            <p className="mt-1 text-4xl font-bold text-primary tabular-nums">{r.score.overall}<span className="text-lg font-medium">分</span></p>
          </div>
          <RadarChart data={radarData} size={150} />
        </div>

        {/* 标签 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["情感共鸣", "故事性强", "节奏紧凑", "代入感强"].map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
          ))}
        </div>

        {/* 核心亮点 + 可复制性 */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-semibold">核心亮点</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {["前3秒制造好奇，有效留住观众", "真实故事引发情感共鸣", "内容结构清晰，节奏把控优秀"].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold">可复制性</h4>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((s) => (
                <Star key={s} className="h-4 w-4 fill-primary text-primary" />
              ))}
              <Star className="h-4 w-4 fill-muted stroke-muted" />
              <span className="ml-1 text-xs font-semibold">很高</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              适合大多数同类内容创作者参考
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── 核心功能（6 卡片行）─── */
const FEATURES = [
  {
    icon: Wand2,
    title: "拆爆款复刻",
    desc: "粘贴任意爆款，AI 拆解心理结构，3 步变成你的原创镜头脚本",
    color: "from-violet-500 to-purple-600",
    href: "/studio",
  },
  {
    icon: Flame,
    title: "找对标黑马",
    desc: "按赛道匹配「小号大爆款」的黑马对标，优先抄高回报的结构",
    color: "from-emerald-500 to-teal-600",
    href: "/find-peer",
  },
  {
    icon: Target,
    title: "账号诊断所",
    desc: "输入你的账号，AI 诊断官直出红海度、同质化病灶与破局路子",
    color: "from-amber-500 to-rose-500",
    href: "/clinic",
  },
  {
    icon: Sparkles,
    title: "创意选题库",
    desc: "全网热榜实时提炼成创意题材，缺灵感时来这找下一条内容",
    color: "from-sky-500 to-cyan-600",
    href: "/ideas",
  },
];

/* ─── 简单三步流程 ─── */
const STEPS = [
  {
    icon: CloudUpload,
    num: 1,
    title: "上传爆款视频",
    desc: "粘贴链接或上传视频，AI 开始拆解它的爆款逻辑",
  },
  {
    icon: Sparkles,
    num: 2,
    title: "拆成镜头脚本",
    desc: "生成评分、逐镜头分镜拆解与可复制公式",
  },
  {
    icon: Wand2,
    num: 3,
    title: "手把手教你拍",
    desc: "换成你的主题，每一镜怎么拍都有照做清单",
    href: "/replicate",
  },
];

/* ─── 定位区块：不做一百分，先帮三十分变七十分 ─── */
const UPGRADE_PATH = [
  {
    title: "三十分 → 七十分",
    desc: "新手先别追求原创。把爆款的结构骨架搬过来，镜头照着拍，先把「像样」做出来。",
    icon: Check,
  },
  {
    title: "六十分 → 九十分",
    desc: "结构已经及格的人，卡在节奏、音效、色彩和情绪曲线——逐项补齐，精品感就出来了。",
    icon: Star,
  },
  {
    title: "每条视频都讲人话",
    desc: "不说「提升完播率」这种空话，直接告诉你：这一镜怎么拍、这句台词怎么念。",
    icon: Sparkles,
  },
];

/* ════════════════════ 页面主体 ════════════════════ */

/** 首页 Hero 中的新手摸底状态卡片（客户端检测 localStorage） */
function OnboardingCTA() {
  const [profile, setProfile] = React.useState<ReturnType<typeof getProfile> | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setProfile(getProfile());
  }, []);

  if (!mounted) return null;

  // 已做过摸底 → 显示轻量「已为你定制」条
  if (profile) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-5 py-3.5 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <UserCheck className="h-4 w-4" /> 已为你定制
        </span>
        <span className="text-muted-foreground">
          剪辑基础：{LEVEL_LABELS[profile.level]}
          {profile.contentTypes.length > 0 && ` · 方向：${profile.contentTypes.slice(0, 2).join("、")}`}
        </span>
        <a
          href="/onboarding"
          className="ml-auto text-xs text-primary hover:underline"
        >
          修改档案 →
        </a>
      </div>
    );
  }

  // 没做摸底 → 醒目引导卡
  return (
    <a
      href="/onboarding"
      className="mt-6 flex items-center gap-4 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent px-5 py-4 transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/5"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/20">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">先花 30 秒认识你</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          告诉我们你的账号定位和内容方向，后续所有分析报告都会按你的情况定制。
        </p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
    </a>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* 微妙的背景装饰 */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:gap-16">
          {/* 左侧文案 */}
          <div>
            <UniversalConverter />
          </div>

          {/* 右侧报告预览 */}
          <div className="relative">
            <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-violet-200/40 to-purple-200/30 blur-2xl dark:from-violet-900/20 dark:to-purple-900/10" />
            <ReportPreviewCard />
          </div>
        </div>
      </section>

      {/* ── 核心功能 ── */}
      <section className="border-t border-border/50 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">核心功能</h2>
            <p className="mt-3 text-muted-foreground">一站式 AI 分析，助你轻松创作优质内容</p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
            {FEATURES.map((f) => {
              const card = (
                <div className="group flex flex-col items-center text-center">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${f.color} shadow-lg shadow-${f.color.split('-')[0]}-500/20 transition-transform group-hover:-translate-y-1`}>
                    <f.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 max-w-[140px] text-xs leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              );
              return f.href ? (
                <Link key={f.title} href={f.href} className="rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-primary">
                  {card}
                </Link>
              ) : (
                <div key={f.title}>{card}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 简单三步 ── */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">简单三步，获得专业分析报告</h2>
        </div>

        <div className="mt-14 grid items-center gap-4 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => {
            const card = (
              <div className="flex h-full flex-col items-center rounded-2xl border border-border/70 bg-card p-6 text-center transition-shadow hover:shadow-lg">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/20">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="mt-1 mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {step.num}
                </div>
                <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            );
            return (
              <React.Fragment key={step.title}>
                {step.href ? (
                  <Link href={step.href} className="rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-primary">
                    {card}
                  </Link>
                ) : (
                  card
                )}
                {i < STEPS.length - 1 && (
                  <ArrowRight className="hidden h-5 w-5 text-muted-foreground/50 sm:flex justify-self-center" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* ── 定位：三十分到七十分 ── */}
      <section className="border-t border-border/50 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              不帮你做一百分，
              <br className="sm:hidden" />
              先帮你把三十分做到七十分
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              普通创作者缺的不是天赋，是一份「照着做就能拍」的说明书。我们把爆款拆到镜头级，再翻译成你的版本。
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {UPGRADE_PATH.map((u) => (
              <Card key={u.title} className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                    <u.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold">{u.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{u.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" variant="gradient" className="gap-2">
              <Link href="/demo">
                <Wand2 className="h-4 w-4" /> 免费体验：把爆款变成你的
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              无需登录 · 60 秒看完整过程
            </p>
          </div>
        </div>
      </section>

      {/* ── 商业状态 CTA：Beta 免费公测 / 正式会员方案 ── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent px-6 py-12 text-center sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight">从第一次拆解，到长期陪你做爆款</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {BETA_OPEN
              ? "Beta 公测期间，核心创作功能全部免费开放，无需购买会员。从爆款拆解到脚本、分镜、拍摄计划，直接开拍。"
              : "免费版每天 1 次爆款拆解先上手；创作者版解锁完整导演报告，进阶版加上爆款复刻，专业版由 AI 导演长期陪你优化账号。"}
          </p>
          <Button asChild size="lg" variant="gradient" className="mt-6 gap-2">
            <Link href={BETA_OPEN ? "/studio" : "/pricing"}>
              {BETA_OPEN ? "立即免费体验" : "查看完整会员方案"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {BETA_OPEN && (
            <p className="mt-3 text-xs text-muted-foreground">无需付费 · 无需开通会员 · 现在就能用</p>
          )}
        </div>
      </section>
    </div>
  );
}
