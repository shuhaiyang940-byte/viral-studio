"use client";

import * as React from "react";
import Link from "next/link";
import {
  History,
  Bookmark,
  UserCog,
  Crown,
  Sparkles,
  ArrowRight,
  Info,
  FileBarChart,
  UserCheck,
  Pencil,
  LogOut,
  Clapperboard,
  Wand2,
} from "lucide-react";
import type { AnalysisReport, OnboardingProfile, Storyboard, EditPlanRecord } from "@/lib/types";
import { MEMBERSHIP } from "@/lib/mock-data";
import { getReports, getStoryboards, getEditPlans } from "@/lib/storage";
import { getProfile, LEVEL_LABELS } from "@/lib/onboarding";
import { useSession, logout } from "@/lib/auth";
import { getQuota } from "@/lib/quota";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const [reports, setReports] = React.useState<AnalysisReport[]>([]);
  const [storyboards, setStoryboards] = React.useState<Storyboard[]>([]);
  const [editPlans, setEditPlans] = React.useState<EditPlanRecord[]>([]);
  const [profile, setProfile] = React.useState<OnboardingProfile | null>(null);
  const { session } = useSession();
  const [quota, setQuota] = React.useState<ReturnType<typeof getQuota> | null>(null);
  const [mounted, setMounted] = React.useState(false);

  /** 真实收藏（来自数据库），而不是从案例库里随便切三条 */
  type SavedCase = { id: string; title: string; category: string; cover: string };
  const [saved, setSaved] = React.useState<SavedCase[]>([]);
  const [savedState, setSavedState] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    setMounted(true);
    setReports(getReports());
    setStoryboards(getStoryboards());
    setEditPlans(getEditPlans());
    setProfile(getProfile());
  }, []);

  React.useEffect(() => {
    setQuota(getQuota(session));
  }, [session]);

  React.useEffect(() => {
    if (!session) {
      setSaved([]);
      setSavedState("ready");
      return;
    }
    let alive = true;
    setSavedState("loading");
    fetch("/api/library/saved", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("加载失败"))))
      .then((d) => {
        if (!alive) return;
        setSaved(Array.isArray(d.items) ? d.items : []);
        setSavedState("ready");
      })
      .catch(() => alive && setSavedState("error"));
    return () => {
      alive = false;
    };
  }, [session]);

  async function handleLogout() {
    await logout();
    setQuota(getQuota(null));
  }

  // 统一「创作记录」：分析 + 分镜 + 剪辑方案，按日期倒序
  type Rec = { type: "分析" | "分镜" | "剪辑"; title: string; date: string; href: string; tag?: string; score?: number };
  const records: Rec[] = [
    ...reports.map((r) => ({ type: "分析" as const, title: r.meta.title, date: r.createdAt, href: `/report?id=${r.id}`, score: r.score.overall })),
    ...storyboards.map((s) => ({ type: "分镜" as const, title: s.title, date: s.createdAt, href: `/storyboard?id=${s.id}`, tag: `${s.shots.length} 镜` })),
    ...editPlans.map((e) => ({ type: "剪辑" as const, title: e.title, date: e.createdAt, href: `/studio`, tag: `${e.segmentCount} 段` })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* 账户头部 */}
      {session ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xl font-bold text-white">
                {session.avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold">{session.name}</h1>
                  <Badge variant={session.isPro ? "success" : "secondary"}>
                    {session.isPro ? "会员" : "免费会员"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {session.isPro
                    ? "会员：无限次分析，已解锁全部高级模块"
                    : `今日剩余分析次数：${quota?.remaining ?? 1} / 1`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!session.isPro && (
                <Button asChild variant="gradient">
                  <Link href="/payment?tier=pro">
                    <Crown className="h-4 w-4" /> 升级会员
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/analyze">
                  <Sparkles className="h-4 w-4" /> 立即分析
                </Link>
              </Button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="icon"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserCog className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">你还没有登录</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                登录后即可查看分析配额、解锁高级模块，并保存你的创作档案。
              </p>
            </div>
            <Button asChild variant="gradient">
              <Link href="/login?redirect=/profile">
                <Sparkles className="h-4 w-4" /> 微信登录
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 我的创作档案（新手摸底结果） */}
      {mounted && (
        <Card className={profile ? "border-primary/30" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" /> 我的创作档案
              </span>
              {profile ? (
                <Button asChild variant="ghost" size="sm">
                  <a href="/onboarding">
                    <Pencil className="mr-1 h-3.5 w-3.5" /> 修改
                  </a>
                </Button>
              ) : (
                <Button asChild variant="gradient" size="sm">
                  <a href="/onboarding">
                    <Sparkles className="mr-1 h-3.5 w-3.5" /> 立即填写
                  </a>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile ? (
              <div className="space-y-4">
                {/* 基础水平 */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground">剪辑基础</span>
                  <Badge variant="success">{LEVEL_LABELS[profile.level]}</Badge>
                </div>
                {/* 工具 */}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">常用工具</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tools.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                    {profile.tools.length === 0 && (
                      <span className="text-xs text-muted-foreground">未选择</span>
                    )}
                  </div>
                </div>
                {/* 内容方向 */}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">内容方向</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.contentTypes.map((ct) => (
                      <Badge key={ct} variant="outline">{ct}</Badge>
                    ))}
                    {profile.contentTypes.length === 0 && (
                      <span className="text-xs text-muted-foreground">未选择</span>
                    )}
                  </div>
                </div>
                {/* 平台 + 时间 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">发布平台</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.platforms.map((p) => (
                        <Badge key={p} variant="secondary">{p}</Badge>
                      ))}
                      {profile.platforms.length === 0 && (
                        <span className="text-xs text-muted-foreground">未选择</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">每周投入时间</p>
                    <Badge variant="outline">{profile.weeklyHours}</Badge>
                  </div>
                </div>
                {/* 创作风格 + 受众 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">创作风格（写稿文风）</p>
                    <Badge variant="default" className="bg-primary/10 text-primary">{profile.style || "未设置"}</Badge>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">目标受众</p>
                    <Badge variant="outline">{profile.audience || "未设置"}</Badge>
                  </div>
                </div>
                {/* 痛点 */}
                {profile.painPoints.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">当前痛点（我们会重点解决这些）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.painPoints.map((pp) => (
                        <Badge key={pp} variant="warning">{pp}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  以上档案数据只存在你的浏览器本地，所有分析报告都会基于这些信息给出定制化建议。
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <UserCog className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">还没有填写创作档案</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  填写后，所有 AI 分析报告都会按你的剪辑基础和内容方向定制，建议更对口。
                </p>
                <Button asChild size="sm" className="mt-3">
                  <a href="/onboarding">
                    <Sparkles className="mr-1 h-3.5 w-3.5" /> 先花 30 秒认识你
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* 我的创作记录（分析 + 分镜 + 剪辑，按日期） */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" /> 我的创作记录
              <span className="text-xs font-normal text-muted-foreground">（分析 · 分镜 · 剪辑，按日期排序）</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <FileBarChart className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">还没有创作记录</p>
                <Button asChild size="sm" className="mt-3">
                  <Link href="/analyze">去分析第一个视频</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {records.map((rec, i) => {
                  const badge =
                    rec.type === "分析"
                      ? { icon: Sparkles, cls: "bg-primary/10 text-primary" }
                      : rec.type === "分镜"
                        ? { icon: Clapperboard, cls: "bg-warning/10 text-warning" }
                        : { icon: Wand2, cls: "bg-accent/10 text-accent" };
                  const Icon = badge.icon;
                  return (
                    <li key={`${rec.type}-${i}`} className="flex items-center justify-between gap-3 py-3">
                      <Link href={rec.href} className="flex min-w-0 items-center gap-2 hover:text-primary">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${badge.cls}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="line-clamp-1 text-sm font-medium">{rec.title}</span>
                        {rec.tag && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{rec.tag}</span>}
                      </Link>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        {rec.score != null && (
                          <span className="rounded bg-success/10 px-1.5 py-0.5 font-semibold text-success">{rec.score}</span>
                        )}
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px]">{rec.type}</span>
                        <span>{formatDate(rec.date)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 收藏案例 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bookmark className="h-4 w-4 text-primary" /> 收藏案例
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedState === "loading" && (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {savedState === "error" && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                收藏加载失败，请刷新页面重试
              </p>
            )}
            {savedState === "ready" && saved.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <p className="text-sm text-muted-foreground">还没有收藏任何案例</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/library">去案例库逛逛</Link>
                </Button>
              </div>
            )}
            {savedState === "ready" &&
              saved.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 shrink-0 rounded-md bg-muted"
                    style={s.cover ? { background: s.cover } : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.category}</p>
                  </div>
                  <Button asChild variant="ghost" size="icon">
                    <Link href="/library" aria-label={`在案例库查看 ${s.title}`}>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* 我的账号分析（高级会员） */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-primary" /> 我的账号分析
              <Badge variant="warning" className="gap-1">
                <Info className="h-3 w-3" /> 功能完善中
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center sm:flex-row sm:text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <Crown className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium">账号诊断 + 内容规划</p>
                <p className="text-sm text-muted-foreground">
                  基于你的历史分析与账号定位，生成诊断报告与每周内容规划。会员功能完善中，敬请期待。
                </p>
              </div>
              <Button variant="outline" disabled>
                <Info className="h-4 w-4" /> 功能完善中
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 会员状态 */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Crown className="h-5 w-5 text-primary" /> 会员状态
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {MEMBERSHIP.map((m) => {
            const current = m.tier === (session?.tier ?? "free");
            return (
              <Card
                key={m.tier}
                className={current ? "border-primary shadow-md shadow-primary/10" : ""}
              >
                <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{m.name}</h3>
                  {current && <Badge>当前</Badge>}
                  {m.comingSoon && <Badge variant="warning">功能完善中</Badge>}
                </div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-2xl font-bold">¥{m.price}</span>
                  <span className="mb-0.5 text-xs text-muted-foreground">/ {m.period}</span>
                </div>
                {m.comingSoon && (
                  <p className="mt-1 text-xs font-medium text-warning">功能完善中 · 即将开放</p>
                )}
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {m.highlights.map((h) => (
                      <li key={h}>· {h}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
