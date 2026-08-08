"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Clock,
  Calendar,
  PlayCircle,
  TrendingUp,
  ListTree,
  Copy,
  Heading,
  Video,
  PenLine,
  Music,
  ArrowRight,
  Loader2,
  RefreshCw,
  Wand2,
  Activity,
  Minus,
  Check,
  AlertTriangle,
  Zap,
  Route,
  MessageSquare,
  Tags,
  GraduationCap,
  Target,
  Lock,
  Crown,
  Clapperboard,
} from "lucide-react";
import type { AnalysisReport, OnboardingProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/score-ring";
import { getReports, saveStoryboard, setPendingAnalysis } from "@/lib/storage";
import { buildStoryboard } from "@/lib/storyboard";
import { LEVEL_LABELS } from "@/lib/onboarding";
import {
  getLearningStats,
  recordLearningEvent,
  hasContributed,
  getEvolution,
  type LearningStats,
  type EvolutionInfo,
} from "@/lib/learning";
import { useSession } from "@/lib/auth";
import { cn, formatNumber } from "@/lib/utils";

const DIMENSIONS = [
  { key: "hook", label: "开头吸引力", icon: Clock },
  { key: "value", label: "内容价值", icon: TrendingUp },
  { key: "emotion", label: "情绪感染", icon: Sparkles },
  { key: "interaction", label: "互动能力", icon: ListTree },
] as const;

export function ReportView({ id }: { id?: string }) {
  const [report, setReport] = React.useState<AnalysisReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [learning, setLearning] = React.useState<LearningStats | null>(null);
  const [evolution, setEvolution] = React.useState<EvolutionInfo | null>(null);
  const { session } = useSession();

  const router = useRouter();

  // 行动入口：从分析结果一键进入智能剪辑 / 生成导演分镜
  function goStudio() {
    if (!report) return;
    setPendingAnalysis(report.id);
    router.push("/studio");
  }
  function goStoryboard() {
    if (!report) return;
    const sb = buildStoryboard(report);
    saveStoryboard(sb);
    router.push(`/storyboard?id=${sb.id}`);
  }

  React.useEffect(() => {
    let active = true;
    async function load() {
      // 优先从本地记录读取（分析页刚保存的）
      const local = id ? getReports().find((r) => r.id === id) : undefined;
      if (local) {
        if (active) {
          setReport(local);
          setLoading(false);
        }
        return;
      }
      // 回退到示例报告
      try {
        const res = await fetch("/api/analyze?sample=1");
        const data = await res.json();
        if (active) {
          setReport(data);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  // 匿名学习飞轮：每次分析报告加载后，贡献一次（去重），并刷新本地统计
  React.useEffect(() => {
    if (!report) return;
    if (!hasContributed(report.id)) {
      recordLearningEvent({
        reportId: report.id,
        refType: report.meta.type,
        signalTags: report.signal?.tags ?? [],
        targetScore: report.scoreTarget?.target ?? 70,
        reached: (report.score?.overall ?? 0) >= 70,
      });
    }
    setLearning(getLearningStats());
    setEvolution(getEvolution());
  }, [report]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-muted-foreground">未找到报告，请重新分析。</p>
        <Button asChild className="mt-4">
          <Link href="/analyze">去分析</Link>
        </Button>
      </div>
    );
  }

  // 登录门禁：生成了报告但必须登录才能看完整内容（含具体做法建议）
  if (!session) {
    return <LoginGate report={report} id={id} />;
  }

  const locked = !session.isPro;
  const { meta, score, section } = report;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* 头部 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="success" className="mb-3 gap-1">
            <Sparkles className="h-3 w-3" /> 拆解完成
          </Badge>
          <h1 className="text-2xl font-bold leading-snug tracking-tight">{meta.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <PlayCircle className="h-4 w-4" /> {meta.platform}
            </span>
            <span className="inline-flex items-center gap-1">
              <Video className="h-4 w-4" /> {meta.type}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" /> {meta.duration}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" /> {meta.publishedAt}
            </span>
            {meta.views != null && (
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> {formatNumber(meta.views)} 播放
              </span>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/analyze">
            <RefreshCw className="h-4 w-4" /> 重新分析
          </Link>
        </Button>
      </div>

      {/* 行动入口：分析 → 智能剪辑 / 导演分镜（会员专享，免费用户引导升级） */}
      <div className="mt-5 flex flex-wrap gap-3">
        {locked ? (
          <>
            <Button asChild className="gap-2">
              <Link href="/pricing?feature=auto-edit">
                <Wand2 className="h-4 w-4" /> 智能剪辑（会员专享）
                <Badge variant="warning" className="ml-1 gap-1">
                  <Crown className="h-3 w-3" /> 升级解锁
                </Badge>
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/pricing?feature=storyboard">
                <Clapperboard className="h-4 w-4" /> 导演分镜表（会员专享）
                <Badge variant="warning" className="ml-1 gap-1">
                  <Crown className="h-3 w-3" /> 升级解锁
                </Badge>
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/pricing?feature=copywrite">
                <PenLine className="h-4 w-4" /> 写文案（会员专享）
                <Badge variant="warning" className="ml-1 gap-1">
                  <Crown className="h-3 w-3" /> 升级解锁
                </Badge>
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button className="gap-2" onClick={goStudio}>
              <Wand2 className="h-4 w-4" /> 智能剪辑（按分析自动成片）
            </Button>
            <Button variant="outline" className="gap-2" onClick={goStoryboard}>
              <Clapperboard className="h-4 w-4" /> 导演分镜表
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/copywriting?id=${report.id}`}>
                <PenLine className="h-4 w-4" /> 写文案（按参考风格）
              </Link>
            </Button>
          </>
        )}
      </div>

      {report.profile && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-foreground/90">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          军师按你的基础（{LEVEL_LABELS[report.profile.level]}）定制，重点看下方的「特效拆解」与「节奏分析」。
        </div>
      )}

      {report.mismatch && (
        <div className="mt-5 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-warning">方向不对，先别硬上</p>
            <p className="mt-1 text-sm text-foreground/90">{report.mismatch.message}</p>
            {report.mismatch.reason && (
              <p className="mt-2 rounded-md bg-background/60 p-2.5 text-sm text-foreground/80">
                {report.mismatch.reason}
              </p>
            )}
            {evolution?.blunt && (
              <p className="mt-2 rounded-md bg-warning/10 p-2.5 text-sm text-warning/90">
                军师锐度 Lv.{evolution.level} 补刀：这条赛道打法已经卷烂了，照抄只会被淹没——
                从你的真实经历里找差异点，比硬抄结构有用得多。
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              下面这份拆解只针对这条参考本身，跟你目标不对路，别直接套用。
            </p>
          </div>
          </div>
        </div>
      )}

      {/* 参考信号（链接模式抓取）：公开标签 + 高赞评论，仅作参考、不当答案 */}
      {report.signal && (
        <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Tags className="h-4 w-4 text-primary" /> 参考信号 · 来自 {report.signal.platform} 的公开标签与高赞评论
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.signal.tags.map((t) => (
              <Badge key={t} variant="secondary">
                #{t}
              </Badge>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {report.signal.comments.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-background/60 p-2.5 text-sm text-foreground/80">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1">{c.text}</span>
                {c.like != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">♥ {formatNumber(c.like)}</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{report.signal.note}</p>
        </div>
      )}

      {/* 爆款评分 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> 爆款评分
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-8 sm:flex-row">
            <ScoreRing value={score.overall} size={140} stroke={12} label="综合评分" />
            <div className="w-full flex-1 space-y-3">
              {DIMENSIONS.map((d) => (
                <div key={d.key}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <d.icon className="h-4 w-4 text-muted-foreground" /> {d.label}
                    </span>
                    <span className="font-semibold tabular-nums">{score[d.key]}</span>
                  </div>
                  <Progress value={score[d.key]} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 提分目标：帮普通人从不及格→70、及格→80 的补齐清单 */}
      {report.scoreTarget && (
        <Section
          icon={Target}
          title="提分目标 · 帮你从不及格到 70、及格到 80"
          subtitle={`当前 ${report.scoreTarget.current} 分 → 目标 ${report.scoreTarget.target} 分（${report.scoreTarget.band}）`}
        >
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground/90">你的提分路径</span>
              <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                {report.scoreTarget.current} → {report.scoreTarget.target}
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground/90">{report.scoreTarget.advice}</p>
          </div>
          {report.scoreTarget.gaps.length > 0 ? (
            <div className="mt-4 space-y-3">
              {report.scoreTarget.gaps.map((g, i) => (
                <div key={i} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-warning">
                    <Minus className="h-4 w-4" /> 还差：{g.dimension}
                  </div>
                  <p className="mt-1.5 text-sm text-foreground/85">{g.tip}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-foreground/90">
              当前各项都已达标，保持节奏即可；下一关是下方「精品化门槛」。
            </p>
          )}
        </Section>
      )}

      {/* 参考亮点拆解（Phase 3）：这条参考真正用上的手法 + 难度 + 实现 */}
      <Section
        icon={Sparkles}
        title="参考亮点 · 这条视频真正用上的手法"
        subtitle="普通人可复刻，附实现方式与难度"
      >
        <div className="space-y-3">
          {(report.effects ?? []).filter((e) => e.used).map((e, i) => (
            <div
              key={i}
              className="rounded-lg border border-primary/20 bg-primary/5 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{e.name}</span>
                <Badge variant="outline">{e.difficulty}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{e.tip}</p>
            </div>
          ))}
          {(report.effects ?? []).filter((e) => e.used).length === 0 && (
            <p className="text-sm text-muted-foreground">这条参考手法较朴素，没有检测到明显的剪辑特效。</p>
          )}
        </div>
      </Section>

      {/* 第一部分 为什么火 */}
      <Section icon={TrendingUp} title="第一部分 · 为什么这个视频火？" subtitle="AI 总结的核心成功原因">
        <ul className="space-y-3">
          {section.whyHot.map((w, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="text-foreground/90">{w}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 第二部分 结构拆解 */}
      <Section icon={ListTree} title="第二部分 · 视频结构拆解" subtitle="时间轴上的节奏设计">
        <ol className="relative space-y-5 border-l border-border pl-6">
          {section.structure.map((s, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{s.time}</Badge>
                <span className="text-sm font-semibold">{s.label}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 第三部分 特效拆解 */}
      <Section icon={Wand2} title="第三部分 · 特效拆解" subtitle="参考视频用到的剪辑手法">
        <div className="space-y-3">
          {(report.effects ?? []).map((e, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-3",
                e.used ? "border-border bg-card" : "border-dashed border-border bg-muted/30"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  {e.used ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                  {e.name}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{e.difficulty}</Badge>
                  <Badge variant={e.used ? "success" : "secondary"}>
                    {e.used ? "检测到" : "未使用"}
                  </Badge>
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{e.tip}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 第四部分 节奏分析 */}
      <Section icon={Activity} title="第四部分 · 节奏分析" subtitle="时间轴与卡点建议">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="前 3 秒钩子" value={`${report.pacing?.hookSeconds ?? 0} 秒`} />
          <Stat label="平均镜头" value={`${report.pacing?.avgShotSeconds ?? 0} 秒`} />
          <Stat label="高潮点" value={`${report.pacing?.climaxAtSec ?? 0} 秒`} />
        </div>
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium">段落节奏</div>
          <div className="flex flex-wrap gap-2">
            {(report.pacing?.segments ?? []).map((s, i) => (
              <Badge key={i} variant="outline">
                {s.time} · {s.label}
              </Badge>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <span className="font-medium text-primary">节奏建议：</span>
          <span className="text-foreground/90">{report.pacing?.suggestion}</span>
          {report.pacing?.beatSync && (
            <span className="ml-1 text-muted-foreground">
              （参考视频已做 BGM 卡点，建议对齐鼓点剪切）
            </span>
          )}
        </div>
      </Section>

      {/* 第五部分 可复制模板 */}
      <Section icon={Copy} title="第五部分 · 可复制模板" subtitle="适合普通人的改编方案">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 text-xs font-medium text-muted-foreground">原视频</div>
            <p className="text-sm font-medium">{section.replicableTemplate.original}</p>
          </div>
          <ArrowRight className="mx-auto hidden h-5 w-5 text-primary sm:block" />
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1 text-xs font-medium text-primary">复制模板</div>
            <p className="text-sm font-medium">{section.replicableTemplate.template}</p>
          </div>
        </div>
      </Section>

      {/* 第六部分 标题优化 */}
      <Section icon={Heading} title="第六部分 · 标题优化" subtitle="AI 生成的 10 个高点击标题">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {section.titles.map((t, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:border-primary/40"
            >
              <span className="font-bold text-primary">#{i + 1}</span>
              <span className="text-foreground/90">{t}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 第七部分 拍摄建议 */}
      <Section icon={Video} title="第七部分 · 拍摄建议" subtitle="镜头 / 文案 / 配乐">
        <div className="grid gap-4 md:grid-cols-3">
          <TipCard icon={Video} title="镜头建议" items={section.shootingTips.camera} />
          <TipCard icon={PenLine} title="文案建议" items={section.shootingTips.copy} />
          <TipCard icon={Music} title="配乐建议" items={section.shootingTips.music} />
        </div>
      </Section>

      {/* 精品化门槛（Phase 4）：节奏 / 音效音乐 / 色彩，点名小红书抖音精品路线 */}
      <Section
        icon={Zap}
        title="精品化门槛 · 小红书 / 抖音都这么卷"
        subtitle="节奏 / 音效音乐 / 色彩，少一样就显业余"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <TipCard icon={Activity} title="节奏" items={report.premium?.rhythm ?? []} />
          <TipCard icon={Music} title="音效 / 音乐" items={report.premium?.audio ?? []} />
          <TipCard icon={Sparkles} title="色彩" items={report.premium?.color ?? []} />
        </div>
      </Section>

      {/* 你的复现路径（Phase 5）：按用户画像给照抄 / 套模板 / 需补素材 + 清单 */}
      <Section
        icon={Route}
        title="你的复现路径 · 普通人照着做"
        subtitle={`基于你的基础，建议：${report.repro?.path ?? "套模板"}`}
      >
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {report.repro?.path}
          </span>
          <p className="mt-2 text-sm text-foreground/90">{report.repro?.advice}</p>
          {report.mismatch && (
            <p className="mt-2 text-xs text-warning">
              ⚠️ 方向不对，下面清单仅作手法参考，别套用到你的赛道。
            </p>
          )}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <AssetList title="需要的素材" items={report.repro?.shots ?? []} />
          <AssetList title="需要的音效" items={report.repro?.sfx ?? []} />
          <AssetList title="音乐方向" items={report.repro?.music ?? []} />
        </div>
      </Section>

      {/* 高级功能 · 会员专属（免费用户锁定） */}
      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Crown className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-none">高级功能 · 会员专属</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              开头吸引力深度分析、标题优化器、选题推荐、AI 自动剪辑、导演分镜——会员专享，免费不可用
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {/* 模块一：开头吸引力深度分析 */}
          <AdvancedModule
            locked={locked}
            icon={Clock}
            title="开头吸引力深度分析"
            desc="逐帧诊断前 3 秒钩子，给出可落地的钩子改造方案"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <ScoreRing value={score.hook} size={64} stroke={7} label="开头" />
                <p className="text-sm text-foreground/90">
                  前 3 秒钩子得分 {score.hook}。军师逐帧诊断：
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  开场是否直接抛冲突 / 悬念？样本 2 秒内甩出，建议你更早。
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  有没有反常识钩子？没有就容易被划走。
                </li>
                <li className="flex items-start gap-2">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  画面钩子是否具体？用「一个具体物件」当贯穿线索，比空泛关键词强。
                </li>
              </ul>
            </div>
          </AdvancedModule>

          {/* 模块二：标题优化器（A/B） */}
          <AdvancedModule
            locked={locked}
            icon={Heading}
            title="标题优化器 · A/B"
            desc="按你的赛道预测高点击标题，支持多版本同时测"
          >
            <div className="space-y-3">
              <p className="text-sm text-foreground/90">预测高点击标题 Top 3（可 A/B 分批发）：</p>
              {section.titles.slice(0, 3).map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                >
                  <span className="text-sm">{t}</span>
                  <Badge variant="success">{90 - i * 4}%+ 点击</Badge>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                同一条内容换 2-3 个标题分批发，用数据挑出真正高点击的那版。
              </p>
            </div>
          </AdvancedModule>

          {/* 模块三：选题推荐 */}
          <AdvancedModule
            locked={locked}
            icon={Target}
            title="选题推荐"
            desc="结合你的方向与平台热门缺口，推荐下一条拍什么"
          >
            <div className="space-y-2">
              {recommendTopics(report.profile).map((t, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm"
                >
                  <span className="font-bold text-primary">#{i + 1}</span>
                  <span className="text-foreground/90">{t}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                依据：你的方向（{report.profile?.contentTypes.join("、") || "未填写"}）+ 当前平台热门缺口。
              </p>
            </div>
          </AdvancedModule>
        </div>
      </section>

      {/* AI 成长飞轮：匿名学习反馈（本地演示版） */}
      {learning && (
        <Card className="mt-8 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-primary" /> AI 成长飞轮 · 匿名学习反馈
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              你这次的分析（参考信号 + 你的目标分数）会<b>匿名</b>汇入模型成长池，帮系统越用越懂「普通人怎么从不及格到 70、及格到 80」。参考信号只作参考、不当答案，也不会绑定你的账号。将来这些样本会用于 RAG 召回与模型微调（详见 lib/learning.ts 占位说明）。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">已参与 {learning.count} 次匿名反馈</Badge>
              <Badge variant="outline">达标率 {learning.reachedRate}%</Badge>
              {evolution && (
                <Badge variant="outline">AI 进化 Lv.{evolution.level} · {evolution.label}</Badge>
              )}
              {evolution && (
                <Badge variant="outline">跨平台学习 {formatNumber(evolution.totalSamples)} 次</Badge>
              )}
              {learning.topTags.map((t) => (
                <Badge key={t} variant="secondary">
                  #{t}
                </Badge>
              ))}
            </div>
            {evolution && (
              <p className="mt-2 text-xs text-muted-foreground">
                系统通过跨平台匿名样本持续训练，等级越高、对视频的见解越准、越敢说真话
                （不会只讲不温不吞的客套话）。你的每次匿名反馈都在帮它进化。
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button asChild variant="gradient">
          <Link href="/analyze">再分析一个</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/library">看爆款案例库</Link>
        </Button>
      </div>
    </div>
  );
}

/* ─── 登录门禁 ─── */
function LoginGate({ report, id }: { report: AnalysisReport; id?: string }) {
  const redirect = id
    ? `/login?redirect=${encodeURIComponent(`/report?id=${id}`)}`
    : "/login?redirect=/report";
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">登录后查看完整拆解报告</h1>
      <p className="mt-3 text-muted-foreground leading-relaxed">
        报告已生成，但完整内容（含具体做法建议与高级模块）需登录后查看。
        免费会员每天可看 1 次「分析 + 具体做法建议」，高级模块需升级解锁。
      </p>
      {/* 模糊 teaser */}
      <div className="mt-8 select-none rounded-xl border border-border bg-muted/20 p-6 text-left blur-sm">
        <p className="font-semibold">{report.meta.title}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          爆款评分 {report.score.overall} 分 · 开头吸引力 {report.score.hook} · 内容价值{" "}
          {report.score.value} · 情绪感染 {report.score.emotion} · 互动能力 {report.score.interaction}
        </p>
        <div className="mt-3 h-2 w-full rounded bg-primary/20" />
        <div className="mt-2 h-2 w-3/4 rounded bg-primary/20" />
      </div>
      <Button asChild variant="gradient" size="lg" className="mt-6 gap-2">
        <Link href={redirect}>
          <Sparkles className="h-4 w-4" /> 微信登录查看
        </Link>
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        支持微信注册和登录 · 演示模式不收集任何真实凭证
      </p>
    </div>
  );
}

/* ─── 高级模块卡片（免费锁定 / 会员解锁）─── */
function AdvancedModule({
  locked,
  icon: Icon,
  title,
  desc,
  children,
}: {
  locked: boolean;
  icon: React.ElementType;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
        {locked && (
          <Badge variant="warning" className="gap-1">
            <Lock className="h-3 w-3" /> 高级会员
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-3">{children}</div>
    </>
  );

  if (!locked) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">{inner}</div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-dashed border-border bg-muted/20 p-5">
      {inner}
      {/* 锁定遮罩 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/75 backdrop-blur-[2px]">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Lock className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">升级会员解锁</p>
        <Button asChild variant="gradient" size="sm">
          <Link href="/pricing">
            <Crown className="h-4 w-4" /> 升级
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ─── 选题推荐（基于新手画像）─── */
function recommendTopics(profile?: OnboardingProfile): string[] {
  const ct = profile?.contentTypes?.[0];
  const map: Record<string, string[]> = {
    口播: [
      "普通人最容易讲透的 3 个认知误区",
      "你以为的 X，其实全是错的",
      "用 1 分钟说清一个被误解的概念",
    ],
    探店: [
      "这家店本地人从小吃到大",
      "人均 30 吃到扶墙出",
      "老板不会告诉你的隐藏菜单",
    ],
    好物种草: [
      "我用了一个月才敢推荐",
      "这东西真不是智商税",
      "99% 人不知道的平替",
    ],
    知识科普: [
      "一个被教材删掉的真相",
      "为什么高手都在偷偷做 X",
      "把复杂的事讲成 1 分钟",
    ],
    Vlog: [
      "普通人的一天，藏着不被看见的努力",
      "我在 XX 住了三十年",
      "一个人去 XX 的孤独与自由",
    ],
    剧情: [
      "反转三次仍合理的短剧开头",
      "30 秒立住一个让人恨的角色",
      "用错位制造笑点的三段式",
    ],
    电影解说: [
      "被片名耽误的神作",
      "二刷才看懂的隐藏细节",
      "xx 分钟讲完一部高分片",
    ],
    颜值才艺: [
      "不靠滤镜也能打的神颜",
      "一段 10 秒惊艳全场的才艺",
      "素人也能练出的镜头感",
    ],
    美食制作: [
      "厨房小白也能复刻",
      "3 步搞定的下饭神器",
      "成本不到 10 块的硬菜",
    ],
    旅行记录: [
      "一个人去 XX 的孤独与自由",
      "小众到地图都找不到的秘境",
      "用 24 小时讲一座城",
    ],
    健身运动: [
      "懒人也能坚持的 4 周计划",
      "不用器械练出线条",
      "新手最容易练错的动作",
    ],
    游戏: [
      "这游戏最被低估的机制",
      "开局这样选直接赢一半",
      "菜鸟到大神的唯一差距",
    ],
  };
  if (ct && map[ct]) return map[ct];
  return [
    "从你最熟的日常下手，拍成有情绪的纪实",
    "用「一个具体场景 + 真实经历 + 一句升华」做第一条",
    "挑一个你踩过的坑，讲给后来人听",
  ];
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-none">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <div className="text-2xl font-bold tabular-nums text-primary">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TipCard({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              {it}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AssetList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
            {items.length}
          </span>
          {title}
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              {it}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
