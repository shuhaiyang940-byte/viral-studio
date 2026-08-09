"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Copy,
  Loader2,
  Lock,
  Film,
  ListOrdered,
  Lightbulb,
  Wand2,
  Crown,
  Check,
} from "lucide-react";
import type { Category, ReplicaResult } from "@/lib/types";
import { useSession } from "@/lib/auth";
import { getProfile } from "@/lib/onboarding";
import { FORMULA_LIBRARY } from "@/lib/formula-library";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const CATEGORIES: Category[] = ["生活", "旅游", "美食", "情感", "知识", "商业"];
const PLATFORMS = ["抖音", "小红书", "视频号", "B站", "快手", "YouTube", "TikTok"];

const USAGE_KEY = "viralstudio:replica:usage";
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function getUsage(): { date: string; count: number } {
  if (typeof window === "undefined") return { date: "", count: 0 };
  try {
    const v = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    return { date: v.date ?? "", count: v.count ?? 0 };
  } catch {
    return { date: "", count: 0 };
  }
}

export function ReplicaStudio() {
  const { session } = useSession();
  const isPro = !!session?.isPro;

  const [category, setCategory] = React.useState<Category>("生活");
  const [platform, setPlatform] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ReplicaResult | null>(null);
  const [locked, setLocked] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const p = getProfile();
    if (p && p.platforms?.length) {
      setPlatform(p.platforms.find((x) => x !== "还没发过") ?? "");
    }
    const u = getUsage();
    if (!isPro && u.date === todayStr() && u.count >= 1) setLocked(true);
    // 从公式库带入的 formula 参数：自动预选对应赛道
    const params = new URLSearchParams(window.location.search);
    const fid = params.get("formula");
    if (fid) {
      const f = FORMULA_LIBRARY.find((x) => x.id === fid);
      if (f) setCategory(f.category);
    }
  }, [isPro]);

  async function handleGenerate() {
    if (locked) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/replicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, platform, topic, isPro }),
      });
      if (!res.ok) throw new Error("生成失败，请重试");
      const data = (await res.json()) as ReplicaResult;
      setResult(data);
      // 记用量（仅免费档）
      if (!isPro) {
        const u = getUsage();
        const cur = u.date === todayStr() ? u.count : 0;
        localStorage.setItem(USAGE_KEY, JSON.stringify({ date: todayStr(), count: cur + 1 }));
        if (cur + 1 >= 1) setLocked(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    const text = [
      `【爆款复刻方案】套用公式：${result.basedOnFormula.formula}`,
      `前 3 秒钩子：${result.hook}`,
      `标题：${result.titles.join(" / ")}`,
      `分镜：`,
      ...result.shots.map(
        (s) => `  ${s.index}. [${s.phase}] ${s.visual}｜台词：${s.line}｜${s.durationSec}s｜${s.sfx}`
      ),
      `复刻路径：${result.copyPath}`,
      `提示：${result.tips.join("；")}`,
    ].join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wand2 className="h-6 w-6 text-primary" /> 爆款复刻助手
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          选好你的赛道，AI 按验证过的爆款公式，一键生成标题 / 脚本 / 分镜，直接开拍。
        </p>
      </div>

      {/* 表单卡 */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">赛道</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                平台（可选）
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">不限平台</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              主题词（不填则用赛道默认主题）
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：胡同早餐店、考研避坑、新手化妆"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={loading || locked} size="lg" className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "生成中…" : "一键生成方案"}
            </Button>
            {!isPro && (
              <span className="text-xs text-muted-foreground">
                {locked ? "今日免费次数已用完" : "免费档每天 1 次"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 免费锁定提示 */}
      {locked && (
        <Card className="mt-4 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white">
              <Lock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">今日免费次数已用完</p>
              <p className="text-sm text-muted-foreground">
                升级进阶版，解锁无限次复刻 + 5 标题 + 完整 6 镜分镜。
              </p>
            </div>
            <Button asChild variant="gradient">
              <Link href="/pricing">
                <Crown className="h-4 w-4" /> 升级
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 错误 */}
      {error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 结果 */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* 套用公式 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> 套用公式
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default" className="bg-primary/10 text-primary">
                  {result.basedOnFormula.name}
                </Badge>
                <span className="text-sm font-medium">{result.basedOnFormula.formula}</span>
              </div>
              <div className="space-y-2">
                {result.basedOnFormula.factors.map((f) => (
                  <div key={f.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{f.name}</span>
                      <span className="text-muted-foreground">{f.weight}%</span>
                    </div>
                    <Progress value={f.weight} className="h-1.5" />
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">复刻路径：</span>
                {result.copyPath}
              </p>
            </CardContent>
          </Card>

          {/* 前 3 秒钩子 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Film className="h-4 w-4 text-primary" /> 前 3 秒钩子
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{result.hook}</p>
            </CardContent>
          </Card>

          {/* 标题 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListOrdered className="h-4 w-4 text-primary" /> 标题方案（{result.titles.length}）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.titles.map((t, i) => (
                  <li
                    key={t}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      i === 0 ? "border-primary/30 bg-primary/5 font-medium" : "border-border"
                    }`}
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* 分镜 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Film className="h-4 w-4 text-primary" /> 分镜脚本（{result.shots.length} 镜）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.shots.map((s) => (
                <div key={s.index} className="rounded-lg border border-border p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                      {s.index}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {s.phase}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{s.durationSec}s</span>
                  </div>
                  <p className="text-sm font-medium">画面：{s.visual}</p>
                  <p className="text-sm text-muted-foreground">台词：{s.line}</p>
                  <p className="mt-1 text-xs text-muted-foreground">音效：{s.sfx}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 落地提示 + 复制 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-primary" /> 落地提示
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {result.tips.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t}
                  </li>
                ))}
              </ul>
              <Button onClick={handleCopy} variant="outline" className="gap-2">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? "已复制" : "复制完整方案"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 空态引导 */}
      {!result && !loading && !error && !locked && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          填好赛道后点「一键生成方案」，AI 会套用对应赛道的爆款公式，给出可直接开拍的脚本。
        </div>
      )}
    </div>
  );
}
