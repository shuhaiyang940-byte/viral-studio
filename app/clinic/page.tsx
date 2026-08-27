"use client";

import * as React from "react";
import Link from "next/link";
import {
  Stethoscope,
  Sparkles,
  Target,
  Check,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

const NICHES = ["生活", "旅游", "美食", "情感", "知识", "商业"];
const TYPES: { id: "sell" | "talk"; label: string }[] = [
  { id: "sell", label: "卖货 / 带货" },
  { id: "talk", label: "口播 / 知识" },
];

export default function ClinicPage() {
  const [form, setForm] = React.useState({
    niche: "生活",
    contentType: "talk" as "sell" | "talk",
    platform: "",
    account: "",
    followers: "",
    engagementRate: "",
    description: "",
    avgPlays: "",
    avgLikes: "",
    avgComments: "",
    sampleText: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);

  async function run() {
    // 空输入不给分：没填账号也没填任何数据 → 明确提示，不产出一个"健康度分数"
    const hasData =
      form.account.trim() || form.followers.trim() || form.engagementRate.trim() ||
      form.avgPlays.trim() || form.avgLikes.trim() || form.avgComments.trim() ||
      form.description.trim() || form.sampleText.trim();
    if (!hasData) {
      setError("请先填账号名 / 主页链接，或至少一项账号数据（粉丝量/互动率等），否则无法做诊断");
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: form.niche,
          contentType: form.contentType,
          platform: form.platform.trim() || undefined,
          account: form.account.trim() || undefined,
          followers: form.followers.trim() ? Number(form.followers) : undefined,
          engagementRate: form.engagementRate.trim() ? Number(form.engagementRate) : undefined,
          avgPlays: form.avgPlays.trim() ? Number(form.avgPlays) : undefined,
          avgLikes: form.avgLikes.trim() ? Number(form.avgLikes) : undefined,
          avgComments: form.avgComments.trim() ? Number(form.avgComments) : undefined,
          description: form.description.trim() || undefined,
          sampleText: form.sampleText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "诊断失败，请稍后重试");
        return;
      }
      setResult(data);
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <Badge className="mb-3 gap-1.5">
          <Stethoscope className="h-3.5 w-3.5" /> 公测期全站免费
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">账号诊所</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          输入你的账号和几个关键数据，AI 会让它和同赛道最值得抄的「黑马对标」对比，
          告诉你：为什么你的播放没对标高、差距在哪、现在怎么改。
        </p>
      </div>

      {!result ? (
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">平台</label>
                <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  {["抖音", "小红书", "视频号", "B站", "TikTok"].map((pt) => (<option key={pt} value={pt}>{pt}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">账号名称 / 主页链接</label>
                <Input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} placeholder="如：@我的美食账号 或 主页链接" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">赛道</label>
                <select value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  {NICHES.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">内容类型</label>
                <div className="flex gap-2" role="group" aria-label="内容类型">
                  {TYPES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={form.contentType === t.id} onClick={() => setForm({ ...form, contentType: t.id })} className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${form.contentType === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <details className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">补充你的账号数据（可选，让诊断更准。这里填的是你手头的数据，非平台实时抓取）</summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-medium">粉丝量·万</label><Input value={form.followers} onChange={(e) => setForm({ ...form, followers: e.target.value })} placeholder="如：12" inputMode="numeric" /></div>
                  <div><label className="mb-1 block text-xs font-medium">互动率·%</label><Input value={form.engagementRate} onChange={(e) => setForm({ ...form, engagementRate: e.target.value })} placeholder="如：3.2" inputMode="decimal" /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><label className="mb-1 block text-xs font-medium">平均播放</label><Input value={form.avgPlays} onChange={(e) => setForm({ ...form, avgPlays: e.target.value })} placeholder="如：4200" inputMode="numeric" /></div>
                  <div><label className="mb-1 block text-xs font-medium">平均点赞</label><Input value={form.avgLikes} onChange={(e) => setForm({ ...form, avgLikes: e.target.value })} placeholder="如：95" inputMode="numeric" /></div>
                  <div><label className="mb-1 block text-xs font-medium">平均评论</label><Input value={form.avgComments} onChange={(e) => setForm({ ...form, avgComments: e.target.value })} placeholder="如：12" inputMode="numeric" /></div>
                </div>
                <div><label className="mb-1 block text-xs font-medium">账号近况</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="做了 2 个月美食号，基本没人看…" rows={2} /></div>
                <div><label className="mb-1 block text-xs font-medium">文案采样</label><Textarea value={form.sampleText} onChange={(e) => setForm({ ...form, sampleText: e.target.value })} placeholder="粘贴你最近一条视频的口播文案…" rows={2} /></div>
              </div>
            </details>

            {error && (<p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>)}

            <Button onClick={run} disabled={loading} className="w-full gap-1.5">
              <Sparkles className="h-4 w-4" />
              {loading ? "深度诊断中…" : "🔍 开始深度诊断"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">只填账号/赛道就能先出初判；补充数据越全，诊断越毒辣。</p>
          </CardContent>
        </Card>
      ) : (
        <ClinicResult r={result} onReset={() => setResult(null)} />
      )}
    </div>
  );
}

function ClinicResult({ r, onReset }: { r: any; onReset: () => void }) {
  return (
    <div className="space-y-6">
      {/* 健康度 */}
      <Card className="border-primary/30">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">账号健康度</p>
              <p className="mt-1 text-3xl font-bold">
                {r.score}
                <span className="text-lg font-normal text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="max-w-md text-right">
              <p className="text-sm">{r.summary}</p>
            </div>
          </div>
          <Progress value={r.score} className="mt-4" />
          {r.sourceNote && (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-muted-foreground">
              {r.sourceNote}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 全局战略观 */}
      {(r.redOcean || r.homogen || r.differentiation) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" /> 全局战略观
          </h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium">赛道红海度</p>
                  <Badge className="mt-1 bg-primary/15 text-primary text-[10px]">{r.redOcean?.level}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">{r.redOcean?.detail}</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-300">同质化预警</p>
                  <p className="mt-1 text-sm">{r.homogen?.alert}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.homogen?.consequence}</p>
                </div>
              </div>
              {(r.differentiation || []).length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">差异化破局出路</p>
                  {(r.differentiation as string[]).map((d, i) => (
                    <p key={i} className="mt-1 flex gap-1.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {d}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 微观执行诊断 */}
      {(r.topics || r.hookDiag || r.schedule) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" /> 微观执行诊断
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="space-y-1.5 p-4">
                <p className="text-xs font-medium text-muted-foreground">选题与热点</p>
                <p className="text-sm">{r.topics}</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/30">
              <CardContent className="space-y-1.5 p-4">
                <p className="text-xs font-medium text-red-500/80">黄金 3 秒钩子</p>
                <p className="text-sm">{r.hookDiag}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1.5 p-4">
                <p className="text-xs font-medium text-muted-foreground">更新频率与时段</p>
                <p className="text-sm">{r.schedule}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 下周行动清单 */}
      {(r.todoList || []).length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="h-5 w-5 text-primary" /> 下周改版行动清单
          </h2>
          <Card>
            <CardContent className="space-y-2.5 p-5">
              {(r.todoList as string[]).map((a, i) => (
                <p key={i} className="flex gap-2 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                  <span>{a}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 维度对比 */}
      {(r.dimensions || []).length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" /> 关键指标对比
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(r.dimensions as any[]).map((d, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{d.label}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    你 <span className="font-medium text-foreground">{d.yourValue}</span> · 对标{" "}
                    {d.benchValue}
                  </p>
                  <p className="text-sm text-muted-foreground">{d.advice}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 差距清单 */}
      {(r.gaps || []).length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-5 w-5 text-primary" /> 差距诊断（为什么 + 怎么改）
          </h2>
          <div className="space-y-3">
            {(r.gaps as any[]).map((g, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <p className="font-semibold">{g.title}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">为什么：</span>
                    {g.why}
                  </p>
                  <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                    <span className="font-medium">怎么改：</span>
                    {g.how}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 对标黑马 */}
      {(r.benchmarks || []).length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" /> 建议你盯的「黑马对标」
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(r.benchmarks as any[]).map((b, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <p className="font-semibold">
                    {b.name}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{b.handle}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    粉丝 {b.followers}万 · 互动 {b.engagementRate}%
                  </p>
                  <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-300 text-[10px]">
                    黑马指数 {b.blackHorseIndex}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{b.reason}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 动作 */}
      {(r.actions || []).length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="h-5 w-5 text-primary" /> 现在就做
          </h2>
          <Card>
            <CardContent className="space-y-2.5 p-5">
              {(r.actions as string[]).map((a, i) => (
                <p key={i} className="flex gap-2 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span>{a}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/find-peer">
            <ArrowRight className="h-4 w-4" /> 去挑对标 / 复刻爆款
          </Link>
        </Button>
        <Button variant="ghost" onClick={onReset}>
          再诊断一次
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ok: { label: "正常", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
    gap: { label: "有差距", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
    danger: { label: "严重偏弱", cls: "bg-destructive/15 text-destructive" },
  };
  const m = map[status] || map.gap;
  return <Badge className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
}
