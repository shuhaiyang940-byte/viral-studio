"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Wand2, Copy, ChevronRight, Play, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** 内置体验爆款：一条「美食卖货」通用爆款，用来 0 门槛演示全流程 */
const DEMO_PLAYBOOK = {
  id: "demo-food",
  title: "反常识测评｜别再交智商税",
  hook: "（直球开场）「关于做饭，你可能一直都搞错了。」",
  structure: [
    { phase: "钩子", secs: 3, detail: "直球反常识，戳中「做了没用」" },
    { phase: "铺垫", secs: 8, detail: "讲一个身边人都踩的坑" },
    { phase: "展开", secs: 12, detail: "给出具体可做的 3 步" },
    { phase: "收尾", secs: 7, detail: "给行动号召，引导评论互动" },
  ],
  cameraTips: ["特写食材", "中景真人出镜", "手部演示步骤", "近景成品收尾"],
  music: ["轻快 BGM", "关键处强音"],
  shots: ["开场", "食材", "步骤", "成品"],
};

export default function DemoPage() {
  const [form, setForm] = React.useState({ myTopic: "我做的手工辣酱", myPersona: "十年路边摊主", platform: "抖音" });
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    if (!form.myTopic.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook: DEMO_PLAYBOOK,
          myTopic: form.myTopic.trim(),
          myPersona: form.myPersona.trim() || undefined,
          platform: form.platform.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成失败，请稍后重试");
        return;
      }
      setResult(data);
      setCopied(false);
    } catch {
      setError("网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }

  function copyAll() {
    if (!result) return;
    const lines = [
      `【标题】${result.title}`,
      `【钩子】${result.hook}`,
      ...(result.body || []).map((b: string) => `· ${b}`),
      `【结尾】${result.cta}`,
      "",
      "【分镜表】",
      ...(result.shots || []).map((s: any, i: number) => `${i + 1}. ${s.phase}（${s.durationSec}s）\n   画面：${s.visual}\n   台词：${s.line}\n   语调：${s.tone}\n   避坑：${s.pitfall}`),
      "",
      "【落地建议】",
      ...(result.tips || []).map((t: string) => `· ${t}`),
    ].join("\n");
    navigator.clipboard?.writeText(lines).then(() => setCopied(true)).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <Badge className="mb-3 gap-1.5">
          <Play className="h-3.5 w-3.5" /> 免费体验 · 无需注册
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">60 秒看懂：一条爆款怎么变成你的</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          不用上传、不用注册。选一条爆款，AI 提炼它的骨架，再换成你的产品，立刻拿到一份能直接开拍的脚本。
        </p>
      </div>

      {/* 步骤条 */}
      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        {["选中一条爆款", "AI 拆出骨架", "替换成你的内容", "拿到可拍脚本"].map((s, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：爆款拆解 */}
        <Card className="border-primary/30">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">这条爆款，凭什么爆？</h2>
              <Badge variant="secondary" className="text-[10px]">示例数据</Badge>
            </div>
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">
              <span className="font-medium text-primary">黄金 3 秒钩子：</span>
              {DEMO_PLAYBOOK.hook}
            </p>
            <ol className="space-y-1.5 text-sm">
              {DEMO_PLAYBOOK.structure.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.secs}s</span>
                  <span>
                    <span className="font-medium">{s.phase}</span> · {s.detail}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              拆解完才发现——爆款不是天赋，是结构。接下来把这个结构套到你身上。
            </p>
          </CardContent>
        </Card>

        {/* 右侧：变成你的 */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Wand2 className="h-5 w-5 text-primary" /> 一键变成我的视频
            </h2>
            {!result ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">你的主题 / 产品</label>
                    <Input value={form.myTopic} onChange={(e) => setForm({ ...form, myTopic: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium">我的人设</label>
                      <Input value={form.myPersona} onChange={(e) => setForm({ ...form, myPersona: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">平台</label>
                      <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
                    </div>
                  </div>
                </div>
                {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
                <Button onClick={run} disabled={busy || !form.myTopic.trim()} className="w-full gap-1.5">
                  <Sparkles className="h-4 w-4" /> {busy ? "生成中…" : "立即生成我的脚本"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/30 p-3">
                  <p className="text-lg font-semibold">{result.title}</p>
                  <p className="mt-1 text-sm text-primary"><span className="font-medium">黄金 3 秒：</span>{result.hook}</p>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {(result.body || []).map((b: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="shrink-0 font-mono text-xs text-muted-foreground">{(i + 1).toString().padStart(2, "0")}</span><span>{b}</span></li>
                  ))}
                  <li className="flex gap-2"><span className="shrink-0 font-mono text-xs text-muted-foreground">CTA</span><span className="text-primary">{result.cta}</span></li>
                </ul>
                {(result.shots || []).length > 0 && (
                  <div className="space-y-2">
                    {(result.shots as any[]).map((s, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold">{i + 1}. {s.phase} <span className="text-[10px] font-normal text-muted-foreground">({s.durationSec}s)</span></p>
                        <p className="mt-1 text-xs text-muted-foreground">画面：{s.visual}</p>
                        <p className="mt-0.5 text-sm">{s.line}</p>
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-300">避坑：{s.pitfall}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setResult(null)} className="flex-1 gap-1.5"><Wand2 className="h-4 w-4" />换个产品再试</Button>
                  <Button onClick={copyAll} className="flex-1 gap-1.5"><Copy className="h-4 w-4" />{copied ? "已复制" : "复制脚本"}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 text-center">
        <p className="mb-3 text-sm text-muted-foreground">想用自己的爆款、看真实拉胯诊断？</p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg" variant="gradient" className="gap-1.5">
            <Link href="/find-peer"><Check className="h-4 w-4" /> 找对标 / 复刻爆款</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-1.5">
            <Link href="/clinic"><ChevronRight className="h-4 w-4" /> 去账号诊所</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
