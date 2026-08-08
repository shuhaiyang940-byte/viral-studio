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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    icon: Video,
    title: "爆款导演拆解报告",
    desc: "AI 模拟十年经验导演，五段拆解爆款为什么火、结构是什么",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Target,
    title: "找对标 & 爆款套路",
    desc: "按赛道匹配流量大的对标账号与可复制的爆款公式",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: BookOpen,
    title: "爆款公式库",
    desc: "从真实案例提炼方法，你收藏的是套路，不是视频",
    color: "from-sky-500 to-blue-600",
  },
  {
    icon: PenTool,
    title: "AI 写文案",
    desc: "按参考风格生成标题、口播文案与分镜脚本",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: Wand2,
    title: "一键复刻我的版本",
    desc: "选好你的行业，AI 生成专属短视频方案，直接开拍",
    color: "from-fuchsia-500 to-pink-600",
  },
  {
    icon: UserCheck,
    title: "我的 AI 导演",
    desc: "填写账号档案，分析越来越懂你的定位与方向",
    color: "from-rose-500 to-orange-500",
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
    title: "AI 导演拆解",
    desc: "生成评分、五段拆解、情绪曲线与可复制公式",
  },
  {
    icon: Wand2,
    num: 3,
    title: "一键复刻",
    desc: "选你的行业，AI 生成标题 / 脚本 / 分镜，直接开拍",
  },
];

/* ─── 用户评价 ─── */
const TESTIMONIALS = [
  {
    name: "@小暖爱生活",
    role: "小红书博主",
    avatar: "X",
    quote: "\"帮这个工具分析了10个对标账号，很快就找到了自己的内容方向，粉丝涨了3倍！\"",
  },
  {
    name: "@摄影师阿杰",
    role: "旅行博主",
    avatar: "S",
    quote: "\"报告里的结构拆解太实用了。跟着模板拍视频，播放量稳定在10w+！\"",
  },
  {
    name: "@柠檬不酸",
    role: "美食博主",
    avatar: "N",
    quote: "\"标题推荐功能帮我解决了大难题，再也不用为起标题发愁了！\"",
  },
  {
    name: "@创业小王",
    role: "创业者",
    avatar: "C",
    quote: "\"作为新手，这个工具就像我的AI导师，让我少走了很多弯路。\"",
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
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-[52px]">
              把百万播放视频，
              <br />
              <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
                拆成你的下一条爆款
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              上传一个爆款视频，AI 爆款导演帮你拆解：为什么火、爆款结构是什么、
              哪些能复制、怎么变成你的下一条内容。
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                <Link href="/analyze">
                  <CloudUpload className="h-4 w-4" /> 立即分析爆款视频
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/library">查看爆款公式</Link>
              </Button>
            </div>

            {/* 新手摸底入口（首页醒目位置） */}
            <OnboardingCTA />

            {/* 用户头像行 */}
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                {[
                  { bg: "bg-violet-500", t: "小" },
                  { bg: "bg-blue-500", t: "摄" },
                  { bg: "bg-emerald-500", t: "柠" },
                  { bg: "bg-orange-500", t: "创" },
                ].map((u, i) => (
                  <div
                    key={i}
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${u.bg} text-xs font-bold text-white ring-2 ring-background`}
                  >
                    {u.t}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                已帮助 <span className="font-semibold text-foreground">10,000+</span> 创作者找到爆款规律
              </p>
            </div>
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
            {FEATURES.map((f) => (
              <div key={f.title} className="group flex flex-col items-center text-center">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${f.color} shadow-lg shadow-${f.color.split('-')[0]}-500/20 transition-transform group-hover:-translate-y-1`}>
                  <f.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1.5 max-w-[140px] text-xs leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 简单三步 ── */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">简单三步，获得专业分析报告</h2>
        </div>

        <div className="mt-14 grid items-center gap-4 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <>
              <div key={step.title} className="flex flex-col items-center rounded-2xl border border-border/70 bg-card p-6 text-center transition-shadow hover:shadow-lg">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/20">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="mt-1 mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {step.num}
                </div>
                <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden h-5 w-5 text-muted-foreground/50 sm:flex justify-self-center" />
              )}
            </>
          ))}
        </div>
      </section>

      {/* ── 用户评价 ── */}
      <section className="border-t border-border/50 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <p className="text-sm leading-relaxed text-foreground/85 italic">
                    &ldquo;{t.quote.replace(/^"/, "").replace(/"$/, "")}&rdquo;
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 text-sm font-bold text-white">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── 定价 CTA（完整方案见 /pricing）── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent px-6 py-12 text-center sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight">从第一次拆解，到长期陪你做爆款</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            免费版每天 1 次爆款拆解先上手；创作者版解锁完整导演报告，进阶版加上爆款复刻，
            专业版由 AI 导演长期陪你优化账号。
          </p>
          <Button asChild size="lg" variant="gradient" className="mt-6 gap-2">
            <Link href="/pricing">
              查看完整会员方案 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
