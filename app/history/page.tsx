"use client";

import * as React from "react";
import Link from "next/link";
import { History, ArrowRight, FileText, Clapperboard, Film, Hammer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface HItem {
  id: string;
  type: string;
  assetId: string;
  parentAssetId?: string | null;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function Progress({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((s) => (
        <Badge key={s.label} variant={s.done ? "default" : "secondary"} className="text-[10px]">
          {s.done ? "✓ " : "○ "}
          {s.label}
        </Badge>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const [items, setItems] = React.useState<HItem[] | null>(null);
  const [error, setError] = React.useState(false);

  async function load() {
    setError(false);
    try {
      const res = await fetch("/api/history");
      const d = await res.json();
      if (!res.ok) {
        setError(true);
        setItems([]);
        return;
      }
      setItems(d.items || []);
    } catch {
      setError(true);
      setItems([]);
    }
  }
  React.useEffect(() => { load(); }, []);

  // 以 Analysis 为根组织创作链
  const analyses = (items || []).filter((i) => i.type === "analysis");
  const byParent: Record<string, HItem[]> = {};
  for (const it of items || []) {
    if (it.parentAssetId) (byParent[it.parentAssetId] ||= []).push(it);
  }
  const projects = analyses.map((a) => {
    const scripts = (byParent[a.assetId] || []).filter((x) => x.type === "script");
    const script = scripts[0] || null; // 已按 updated_at DESC
    const storyboards = script ? (byParent[script.assetId] || []).filter((x) => x.type === "storyboard") : [];
    const storyboard = storyboards[0] || null;
    const plan = storyboard ? (byParent[storyboard.assetId] || []).find((x) => x.type === "edit_plan") || null : null;
    return { analysis: a, script, storyboard, plan };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">我的创作</h1>
          <p className="mt-2 text-muted-foreground">你的爆款分析、脚本、分镜与拍摄计划都在这里，随时回来继续。</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" /> 刷新
        </Button>
      </div>

      {error ? (
        <p className="py-16 text-center text-sm text-muted-foreground">请先登录后再查看我的创作。</p>
      ) : items === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/40" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">还没有创作记录。去分析一条爆款，开始你的第一条内容吧。</p>
          <Button asChild className="mt-4 gap-1.5"><Link href="/analyze"><ArrowRight className="h-4 w-4" /> 去分析</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <Card key={p.analysis.assetId} className="hover:border-primary/40">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.analysis.title || "未命名爆款"}</p>
                    <p className="text-xs text-muted-foreground">
                      分析于 {new Date(p.analysis.createdAt).toLocaleString("zh-CN")} · 更新于 {new Date(p.analysis.updatedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <Progress
                    steps={[
                      { label: "分析", done: true },
                      { label: "脚本", done: !!p.script },
                      { label: "分镜", done: !!p.storyboard },
                      { label: "计划", done: !!p.plan },
                    ]}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  {p.script && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> 脚本×1</span>}
                  {p.storyboard && <span className="inline-flex items-center gap-1"><Clapperboard className="h-3 w-3" /> 分镜</span>}
                  {p.plan && <span className="inline-flex items-center gap-1"><Hammer className="h-3 w-3" /> 拍摄计划</span>}
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="gradient" className="gap-1.5">
                    <Link href={`/reengineer?analysisAssetId=${encodeURIComponent(p.analysis.assetId)}`}>
                      {p.plan ? <><Film className="h-3.5 w-3.5" /> 继续 / 导出</> : <><ArrowRight className="h-3.5 w-3.5" /> 继续创作</>}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/report?id=${encodeURIComponent(p.analysis.assetId)}`}>查看分析</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
